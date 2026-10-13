import { StockItem, StockOutLog, WasteLog, StockPrediction, RiskLevel } from '../types/stock';

export class MLStockPredictionService {
  /**
   * Generates ML-based predictive consumption analysis for all stock items.
   * Leverages exponential weighted moving average (EWMA), linear velocity trend estimation,
   * supplier lead-time modeling, and safety stock calculation.
   */
  public static analyzeStockPredictions(
    items: StockItem[],
    stockOutLogs: StockOutLog[],
    wasteLogs: WasteLog[] = []
  ): StockPrediction[] {
    const predictions: StockPrediction[] = [];

    // Group logs by item name (case-insensitive)
    const logsByItem = new Map<string, StockOutLog[]>();
    for (const log of stockOutLogs) {
      const key = log.itemName.toLowerCase().trim();
      const existing = logsByItem.get(key) || [];
      existing.push(log);
      logsByItem.set(key, existing);
    }

    const wasteByItem = new Map<string, WasteLog[]>();
    for (const log of wasteLogs) {
      const key = log.itemName.toLowerCase().trim();
      const existing = wasteByItem.get(key) || [];
      existing.push(log);
      wasteByItem.set(key, existing);
    }

    for (const item of items) {
      const itemOutLogs = logsByItem.get(item.name.toLowerCase().trim()) || [];
      const itemWasteLogs = wasteByItem.get(item.name.toLowerCase().trim()) || [];

      const prediction = this.predictSingleItem(item, itemOutLogs, itemWasteLogs);
      predictions.push(prediction);
    }

    // Sort by urgency: items at critical risk first, then predicted low soon, then at minimum
    return predictions.sort((a, b) => {
      const urgencyRank = (p: StockPrediction) => {
        if (p.riskLevel === 'CRITICAL_DEPLETION') return 1;
        if (p.riskLevel === 'PREDICTED_LOW_SOON') return 2;
        if (p.riskLevel === 'AT_MINIMUM') return 3;
        if (p.riskLevel === 'OPTIMAL') return 4;
        return 5;
      };
      return urgencyRank(a) - urgencyRank(b);
    });
  }

  /**
   * Performs statistical and regression prediction on a single stock item
   */
  public static predictSingleItem(
    item: StockItem,
    outLogs: StockOutLog[],
    wasteLogs: WasteLog[]
  ): StockPrediction {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // 1. Group daily consumption over the past 14 days
    const dailyConsumption: number[] = new Array(14).fill(0);
    const dayWeights: number[] = new Array(14).fill(0);

    for (const log of outLogs) {
      const logTime = new Date(log.timestamp).getTime();
      const dayDiff = Math.floor((now - logTime) / oneDayMs);
      if (dayDiff >= 0 && dayDiff < 14) {
        dailyConsumption[dayDiff] += log.qtyTaken;
      }
    }

    for (const log of wasteLogs) {
      const logTime = new Date(log.timestamp).getTime();
      const dayDiff = Math.floor((now - logTime) / oneDayMs);
      if (dayDiff >= 0 && dayDiff < 14) {
        dailyConsumption[dayDiff] += log.qtyWasted;
      }
    }

    // 2. Exponential Moving Average (EWMA) with higher recency weight
    let weightedSum = 0;
    let weightSum = 0;
    for (let d = 0; d < 14; d++) {
      // Exponential decay: recent days get higher weight
      const weight = Math.exp(-0.08 * d);
      dayWeights[d] = weight;
      weightedSum += dailyConsumption[d] * weight;
      weightSum += weight;
    }

    let dailyBurnRate = weightSum > 0 ? weightedSum / weightSum : 0;

    // Fallback benchmark heuristic if logs are minimal:
    if (dailyBurnRate <= 0.05) {
      const estimatedHistoricalDaily = (item.totalOut + item.totalWaste) / 14;
      if (estimatedHistoricalDaily > 0) {
        dailyBurnRate = estimatedHistoricalDaily;
      } else {
        // Industry baseline for cafes based on min/max levels
        dailyBurnRate = Math.max(0.5, (item.minLevel * 0.25));
      }
    }

    // Round burn rate to 1 decimal place
    dailyBurnRate = Math.round(dailyBurnRate * 10) / 10;

    // 3. Linear Regression Slope for consumption trend (Day 13 -> Day 0)
    // x values: 0 to 13 (chronological order)
    const chronoData = [...dailyConsumption].reverse(); // day 13 is index 0, day 0 (today) is index 13
    const n = 14;
    const xSum = (n * (n - 1)) / 2; // 91
    let ySum = 0;
    let xySum = 0;
    let x2Sum = 0;

    for (let i = 0; i < n; i++) {
      ySum += chronoData[i];
      xySum += i * chronoData[i];
      x2Sum += i * i;
    }

    const denominator = n * x2Sum - xSum * xSum;
    const slope = denominator !== 0 ? (n * xySum - xSum * ySum) / denominator : 0;

    let burnRateTrend: 'rising' | 'steady' | 'declining' = 'steady';
    if (slope > 0.12) burnRateTrend = 'rising';
    else if (slope < -0.12) burnRateTrend = 'declining';

    const recent7Avg = dailyConsumption.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const older7Avg = Math.max(0.1, dailyConsumption.slice(7, 14).reduce((a, b) => a + b, 0) / 7);
    const trendPercentage = Math.round(((recent7Avg - older7Avg) / older7Avg) * 100);

    // 4. Lead-Time Modeling by Category
    const categoryLower = item.category.toLowerCase();
    let supplierLeadTimeDays = 2; // Default 2 days
    if (categoryLower.includes('beans') || categoryLower.includes('roastery')) {
      supplierLeadTimeDays = 3;
    } else if (categoryLower.includes('packaging') || categoryLower.includes('disposable')) {
      supplierLeadTimeDays = 4;
    } else if (categoryLower.includes('syrup') || categoryLower.includes('powder')) {
      supplierLeadTimeDays = 3;
    } else if (categoryLower.includes('dairy') || categoryLower.includes('milk')) {
      supplierLeadTimeDays = 2;
    }

    // 5. Time Projections
    // Days until complete depletion (0 stock)
    const daysUntilZero = dailyBurnRate > 0
      ? Math.max(0, Math.round((item.currentStock / dailyBurnRate) * 10) / 10)
      : 99;

    // Days until hitting minLevel
    let daysUntilMinThreshold = 0;
    if (item.currentStock > item.minLevel && dailyBurnRate > 0) {
      daysUntilMinThreshold = Math.round(((item.currentStock - item.minLevel) / dailyBurnRate) * 10) / 10;
    } else if (item.currentStock <= item.minLevel) {
      daysUntilMinThreshold = 0;
    }

    // 6. ML Early Restock Warning (Before Hitting Minimum)
    // An item is predicted low BEFORE min if it is currently > minLevel,
    // but projected to breach minLevel within supplier lead time + safety cushion (e.g. 2-3 days)!
    const leadTimeCushion = supplierLeadTimeDays + 1.0;
    const isPredictedLowBeforeMin =
      item.currentStock > item.minLevel &&
      daysUntilMinThreshold <= leadTimeCushion &&
      dailyBurnRate > 0;

    // 7. Dynamic ML Suggested Auto-Restock Level
    // Target buffer = (Supplier Lead Time + 4 Days Safety Buffer) * dailyBurnRate + Safety Stock (StdDev)
    const variance = dailyConsumption.reduce((sum, val) => sum + Math.pow(val - dailyBurnRate, 2), 0) / 14;
    const stdDev = Math.sqrt(variance);
    const safetyStock = Math.ceil(stdDev * 1.65); // 95% service level protection
    const targetCycleDays = supplierLeadTimeDays + 5;
    const dynamicTarget = Math.max(
      item.maxLevel,
      Math.ceil(dailyBurnRate * targetCycleDays + safetyStock)
    );
    const suggestedRestockQty = Math.max(0, dynamicTarget - item.currentStock);

    // 8. Risk Level & Urgency Classification
    let riskLevel: RiskLevel = 'OPTIMAL';
    let reorderUrgency: 'immediate' | 'soon' | 'normal' | 'low' = 'low';

    if (item.currentStock <= 0 || daysUntilZero <= 1.5) {
      riskLevel = 'CRITICAL_DEPLETION';
      reorderUrgency = 'immediate';
    } else if (isPredictedLowBeforeMin) {
      riskLevel = 'PREDICTED_LOW_SOON';
      reorderUrgency = 'soon';
    } else if (item.currentStock <= item.minLevel) {
      riskLevel = 'AT_MINIMUM';
      reorderUrgency = 'immediate';
    } else if (item.currentStock > item.maxLevel * 1.3) {
      riskLevel = 'OVERSTOCKED';
      reorderUrgency = 'low';
    } else {
      riskLevel = 'OPTIMAL';
      reorderUrgency = 'normal';
    }

    // 9. ML Confidence Score (0 - 100%)
    const loggedDaysCount = dailyConsumption.filter(v => v > 0).length;
    let confidenceScore = Math.min(96, Math.max(68, 60 + loggedDaysCount * 2.5));
    if (outLogs.length > 20) confidenceScore = Math.min(98, confidenceScore + 10);

    // 10. Forecast next 7 days with day-of-week multiplier
    const forecasted7DayConsumption: number[] = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(today.getTime() + i * oneDayMs);
      const isWeekend = futureDate.getDay() === 0 || futureDate.getDay() === 6;
      const surgeMultiplier = isWeekend ? 1.35 : 1.0;
      const projectedDayBurn = Math.round(dailyBurnRate * surgeMultiplier * 10) / 10;
      forecasted7DayConsumption.push(projectedDayBurn);
    }

    // 11. Explanatory Rationale
    let recommendationReason = '';
    if (riskLevel === 'CRITICAL_DEPLETION') {
      recommendationReason = `CRITICAL: Depleting in ${daysUntilZero} days at current burn (${dailyBurnRate} ${item.unit}/day). Immediate order required!`;
    } else if (riskLevel === 'PREDICTED_LOW_SOON') {
      recommendationReason = `PREDICTED RESTOCK: Currently ${item.currentStock} ${item.unit} (above min ${item.minLevel}), but projected to hit minimum in ${daysUntilMinThreshold} days. Lead time is ${supplierLeadTimeDays} days. Reorder now to avoid stockout!`;
    } else if (riskLevel === 'AT_MINIMUM') {
      recommendationReason = `Below minimum threshold (${item.currentStock}/${item.minLevel} ${item.unit}). Restock ${suggestedRestockQty} units immediately.`;
    } else if (riskLevel === 'OVERSTOCKED') {
      recommendationReason = `Surplus inventory (${item.currentStock} ${item.unit}). Sufficient for ${daysUntilZero} days. Pause new orders.`;
    } else {
      recommendationReason = `Healthy inventory runway (${daysUntilZero} days remaining until stockout). Next reorder suggested in ${Math.max(1, Math.round(daysUntilMinThreshold))} days.`;
    }

    return {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      minLevel: item.minLevel,
      maxLevel: item.maxLevel,
      dailyBurnRate,
      burnRateTrend,
      trendPercentage,
      daysUntilZero,
      daysUntilMinThreshold,
      isPredictedLowBeforeMin,
      suggestedRestockQty,
      supplierLeadTimeDays,
      confidenceScore,
      riskLevel,
      reorderUrgency,
      forecasted7DayConsumption,
      recommendationReason
    };
  }
}
