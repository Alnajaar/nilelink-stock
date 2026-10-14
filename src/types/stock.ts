export type UserRole = 'superadmin' | 'admin' | 'manager' | 'teamlead' | 'staff';

export interface Employee {
  id: string;
  name: string;
  pin: string;
  role: UserRole;
  active: boolean;
  payType?: 'hourly' | 'salary';
  payRateMinor?: number;
  payPeriod?: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'annual';
  currency?: string;
  permissions?: string[]; // e.g. ['take', 'stockin', 'waste', 'count', 'autoorder', 'team']
  lastLogin?: string;
  branchName?: string;
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  openingStock: number;
  currentStock: number;
  minLevel: number;
  maxLevel: number;
  totalIn: number;
  totalOut: number;
  totalWaste: number;
  unitCost?: number;
  supplierId?: string;
  barcode?: string; // QR or Barcode value e.g. 'NL-MILK-01'
  sku?: string;
  lastUpdated: string;
}

export interface StockOutLog {
  id: string;
  timestamp: string;
  itemName: string;
  category: string;
  qtyTaken: number;
  remainingAfter: number;
  takenBy: string;
  destination?: string; // 'Bar / Espresso Station' | 'Kitchen / Cook Line' | 'Bakery & Prep' | 'Dining Room'
  notes?: string;
}

export interface StockInLog {
  id: string;
  timestamp: string;
  itemName: string;
  category: string;
  qtyReceived: number;
  supplier: string;
  receivedBy: string;
  invoiceNo?: string;
  unitCost?: number;
}

export interface WasteLog {
  id: string;
  timestamp: string;
  itemName: string;
  category: string;
  qtyWasted: number;
  reason: string;
  recordedBy: string;
  estimatedLoss?: number;
  shift?: 'Morning' | 'Afternoon' | 'Night';
}

export interface BranchTransfer {
  id: string;
  transferNumber: string;
  timestamp: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  items: {
    itemId: string;
    itemName: string;
    category: string;
    unit: string;
    qtyTransferred: number;
    unitCost?: number;
  }[];
  totalUnits: number;
  totalValue: number;
  status: 'COMPLETED' | 'IN_TRANSIT' | 'CANCELLED';
  initiatedBy: string;
  receivedBy?: string;
  notes?: string;
}

export interface StockCountRecord {
  id: string;
  type: 'night' | 'week';
  date: string;
  itemName: string;
  systemQty: number;
  physicalQty: number;
  difference: number;
  countedBy: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  paymentTerms: string;
  deliveryDays: string;
  minimumOrder?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency?: string;
  billingPeriod: 'monthly' | 'quarterly' | 'annual' | 'lifetime';
  maxTerminals: number;
  maxItems: number;
  maxBranches: number; // 1 for Solo, 2 for Pro, 10+ for Enterprise
  features: string[];
  description: string;
  popular?: boolean;
  badge?: string;
  idealFor?: string;
}

export interface CafeTenant {
  id: string;
  name: string;
  adminEmail: string;
  adminPhone?: string;
  city?: string;
  plan: string;
  planId: string;
  accessCode?: string; // Development/demo access codes are not used by the production tenant API.
  specialLink?: string;
  paidUntil: string; // YYYY-MM-DD
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'SUSPENDED';
  currency: string; // ISO 4217 code in production; demo data may use a display symbol.
  created: string;
  organizationId?: string; // Grouping for multi-branch organizations
  isMultiBranch?: boolean; // When true, owner can switch between branches in their group
}

export interface LicenseInfo {
  cafeId: string;
  cafeName: string;
  ownerEmail: string;
  tier: 'Starter' | 'Pro' | 'Enterprise' | 'Lifetime';
  status: 'active' | 'warning' | 'expired' | 'revoked';
  expiryDate: string; // ISO date string
  daysLeft: number;
  warnDays: number;
  contact: string;
  signature?: string;
  features: {
    liveDashboard: boolean;
    autoOrder: boolean;
    wasteAnalytics: boolean;
    multiTerminal: boolean;
    barcodeScanner: boolean;
    whatsappOrders: boolean;
    excelImportExport: boolean;
  };
}

export type SyncActionType =
  | 'STOCK_OUT'
  | 'STOCK_IN'
  | 'WASTE'
  | 'STOCK_COUNT'
  | 'UPDATE_ITEM'
  | 'ADD_ITEM'
  | 'IMPORT_ITEMS'
  | 'BRANCH_TRANSFER';

export interface PendingSyncAction {
  id: string;
  cafeId: string;
  actionType: SyncActionType;
  payload: any;
  summary: string; // Human readable summary e.g. "Take to Bar: 4x Full Fat Fresh Milk"
  timestamp: string; // ISO string
  offlineTimestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
}

export type RiskLevel =
  | 'CRITICAL_DEPLETION' // Will hit 0 in < 48 hours
  | 'PREDICTED_LOW_SOON' // Above minLevel now, but ML predicts breach before next delivery
  | 'AT_MINIMUM' // Already at or below minLevel
  | 'OPTIMAL' // Sufficient runway
  | 'OVERSTOCKED'; // In excess

export interface StockPrediction {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  currentStock: number;
  minLevel: number;
  maxLevel: number;
  dailyBurnRate: number; // Consumption velocity (units/day)
  burnRateTrend: 'rising' | 'steady' | 'declining';
  trendPercentage: number; // e.g. +14%
  daysUntilZero: number; // Days until complete stockout
  daysUntilMinThreshold: number; // Days until reaching minLevel
  isPredictedLowBeforeMin: boolean; // Flag for early warning
  suggestedRestockQty: number; // Smart ML suggested order qty
  supplierLeadTimeDays: number;
  confidenceScore: number; // 0 - 100%
  riskLevel: RiskLevel;
  reorderUrgency: 'immediate' | 'soon' | 'normal' | 'low';
  forecasted7DayConsumption: number[];
  recommendationReason: string;
}

export type ShrinkageSeverity = 'critical' | 'warning' | 'overage' | 'normal';

export interface ShrinkageAuditItem {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  unitCost: number;
  expectedStock: number; // Theoretical stock from logs (opening + in - out - waste)
  currentStock: number;  // Current system / physical recorded count
  varianceUnits: number; // currentStock - expectedStock (negative means missing/theft)
  variancePercent: number; // % deviation
  dollarImpact: number;  // Financial loss or surplus ($)
  severity: ShrinkageSeverity;
  suspectedTheft: boolean;
  unrecordedTakeAlert: boolean;
  probableCause: string;
  recommendedAction: string;
  lastCountDate?: string;
  historicalDailyBurn: number;
}

export interface InventoryAuditSummary {
  totalItemsAudited: number;
  flaggedItemsCount: number;
  criticalTheftRiskCount: number;
  warningDiscrepancyCount: number;
  reconciledCount: number;
  totalShrinkageLoss: number; // $ lost to negative variance
  totalSurplusValue: number; // $ gained from positive variance
  inventoryAccuracyRate: number; // % e.g. 94.2%
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  auditTimestamp: string;
}

export interface PushNotificationSettings {
  enabled: boolean;
  alertOnMinLevel: boolean;
  alertOnZeroStock: boolean;
  alertOnTheftFlag: boolean;
  browserPermission: NotificationPermission | 'unsupported';
  soundAlerts: boolean;
  quietHoursEnabled: boolean;
}

export interface PushNotificationLog {
  id: string;
  timestamp: string;
  title: string;
  body: string;
  type: 'CRITICAL_STOCK' | 'THEFT_ALERT' | 'EXPIRY_ALERT' | 'SYSTEM';
  itemId?: string;
  read: boolean;
}

export interface PDFReportOptions {
  reportType: 'INVENTORY_AUDIT' | 'STOCK_VALUATION' | 'PAYROLL_USAGE';
  cafeName: string;
  branchName?: string;
  currency: string;
  taxRegistrationNumber?: string;
  startDate?: string;
  endDate?: string;
  auditorName: string;
  auditorRole: string;
  includeSignatures: boolean;
}
