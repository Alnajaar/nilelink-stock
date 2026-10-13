import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ShrinkageAuditItem,
  InventoryAuditSummary,
  StockOutLog,
  StockItem,
  PDFReportOptions
} from '../types/stock';

export class PDFReportService {
  /**
   * Generates a formatted branded PDF for Inventory Audit & Loss Prevention
   */
  public static generateAuditPDF(
    auditItems: ShrinkageAuditItem[],
    summary: InventoryAuditSummary,
    options: PDFReportOptions
  ): void {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. BRANDED HEADER BANNER
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Accent line
    doc.setFillColor(217, 119, 6); // amber-600
    doc.rect(0, 38, pageWidth, 2.5, 'F');

    // Company Name & Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(options.cafeName.toUpperCase(), 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(
      `SMART INVENTORY AUDIT & LOSS PREVENTION REPORT · ${options.branchName || 'Central Branch'}`,
      14,
      23
    );

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Doc Ref: BSK-AUD-${Date.now().toString().slice(-6)} | Date: ${generatedDate}`,
      14,
      30
    );

    if (options.taxRegistrationNumber) {
      doc.text(`Tax / Commercial Reg No: ${options.taxRegistrationNumber}`, pageWidth - 14, 30, {
        align: 'right'
      });
    }

    // 2. EXECUTIVE KPI SUMMARY CARDS
    let yPos = 48;
    const cardWidth = (pageWidth - 28 - 9) / 4;
    const cardHeight = 18;

    // Card 1: Total Audited
    this.drawMetricCard(
      doc,
      14,
      yPos,
      cardWidth,
      cardHeight,
      'ITEMS AUDITED',
      `${summary.totalItemsAudited}`,
      [15, 23, 42]
    );

    // Card 2: Accuracy Rate
    const accColor = summary.inventoryAccuracyRate >= 95 ? [16, 185, 129] : [239, 68, 68];
    this.drawMetricCard(
      doc,
      14 + cardWidth + 3,
      yPos,
      cardWidth,
      cardHeight,
      'ACCURACY RATE',
      `${summary.inventoryAccuracyRate.toFixed(1)}%`,
      accColor
    );

    // Card 3: Potential Shrinkage
    this.drawMetricCard(
      doc,
      14 + (cardWidth + 3) * 2,
      yPos,
      cardWidth,
      cardHeight,
      'SHRINKAGE LOSS',
      `-$${summary.totalShrinkageLoss.toFixed(2)}`,
      [220, 38, 38]
    );

    // Card 4: Discrepancies
    this.drawMetricCard(
      doc,
      14 + (cardWidth + 3) * 3,
      yPos,
      cardWidth,
      cardHeight,
      'DISCREPANCIES',
      `${summary.flaggedItemsCount} Items`,
      summary.flaggedItemsCount > 0 ? [217, 119, 6] : [16, 185, 129]
    );

    yPos += cardHeight + 8;

    // 3. AUDIT ITEMS TABLE
    const tableBody = auditItems.map(item => [
      item.itemName,
      item.category,
      `${item.expectedStock} ${item.unit}`,
      `${item.currentStock} ${item.unit}`,
      item.varianceUnits === 0 ? '0' : `${item.varianceUnits > 0 ? '+' : ''}${item.varianceUnits}`,
      `$${item.unitCost.toFixed(2)}`,
      item.varianceUnits < 0
        ? `-$${item.dollarImpact.toFixed(2)}`
        : item.varianceUnits > 0
        ? `+$${item.dollarImpact.toFixed(2)}`
        : '$0.00',
      item.severity.toUpperCase(),
      item.suspectedTheft ? 'YES (Flagged)' : 'No'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [
        [
          'Item Name',
          'Category',
          'Expected',
          'Physical',
          'Variance',
          'Unit Cost',
          'Dollar Impact',
          'Severity',
          'Theft Alert'
        ]
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
        7: { halign: 'center' },
        8: { halign: 'center' }
      },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 6) {
          const text = String(data.cell.raw);
          if (text.startsWith('-')) {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (text.startsWith('+')) {
            data.cell.styles.textColor = [16, 185, 129];
          }
        }
        if (data.section === 'body' && data.column.index === 8) {
          if (String(data.cell.raw).includes('YES')) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    // 4. SIGNATURE AND CERTIFICATION BLOCK
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 60;
    const signY = Math.min(finalY + 14, 250);

    // If near bottom of page, add page
    if (finalY > 245) {
      doc.addPage();
      this.drawSignatures(doc, 30, options);
    } else {
      this.drawSignatures(doc, signY, options);
    }

    // 5. FOOTER
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `NileLink BarStock Enterprise · Formal Audit Document · Page ${i} of ${pageCount}`,
        pageWidth / 2,
        290,
        { align: 'center' }
      );
    }

    doc.save(`${options.cafeName.replace(/\s+/g, '_')}_Audit_Report_${Date.now()}.pdf`);
  }

  /**
   * Generates a formatted branded PDF for History & Payroll Shift Replenishment
   */
  public static generateHistoryPDF(
    logs: StockOutLog[],
    items: StockItem[],
    options: PDFReportOptions
  ): void {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. BRANDED HEADER
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setFillColor(217, 119, 6);
    doc.rect(0, 38, pageWidth, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(options.cafeName.toUpperCase(), 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `SHIFT REPLENISHMENT & USAGE LOG · PAYROLL & TAX DOCUMENTATION`,
      14,
      23
    );

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Auditor/Manager: ${options.auditorName} (${options.auditorRole}) · Generated: ${generatedDate}`,
      14,
      30
    );

    if (options.taxRegistrationNumber) {
      doc.text(`Tax ID: ${options.taxRegistrationNumber}`, pageWidth - 14, 30, { align: 'right' });
    }

    // 2. METRIC CARDS
    const totalTransactions = logs.length;
    const totalQty = logs.reduce((sum, l) => sum + l.qtyTaken, 0);
    const uniqueStaff = Array.from(new Set(logs.map(l => l.takenBy))).length;

    let yPos = 48;
    const cardWidth = (pageWidth - 28 - 6) / 3;
    const cardHeight = 18;

    this.drawMetricCard(
      doc,
      14,
      yPos,
      cardWidth,
      cardHeight,
      'TOTAL REPLENISHMENTS',
      `${totalTransactions} Events`,
      [15, 23, 42]
    );

    this.drawMetricCard(
      doc,
      14 + cardWidth + 3,
      yPos,
      cardWidth,
      cardHeight,
      'TOTAL UNITS TO BAR',
      `${totalQty} Units`,
      [217, 119, 6]
    );

    this.drawMetricCard(
      doc,
      14 + (cardWidth + 3) * 2,
      yPos,
      cardWidth,
      cardHeight,
      'ACTIVE STAFF',
      `${uniqueStaff} Team Members`,
      [16, 185, 129]
    );

    yPos += cardHeight + 8;

    // 3. TABLE BODY
    const tableBody = logs.map(l => {
      const match = items.find(i => i.name === l.itemName);
      const estCost = match?.unitCost ? `$${(match.unitCost * l.qtyTaken).toFixed(2)}` : 'N/A';
      return [
        new Date(l.timestamp).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        l.itemName,
        l.category,
        l.takenBy,
        `-${l.qtyTaken}`,
        `${l.remainingAfter}`,
        estCost
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [
        [
          'Timestamp',
          'Product Name',
          'Category',
          'Barista / Staff',
          'Qty Taken',
          'Shelf Balance',
          'Est. Value'
        ]
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { fontStyle: 'bold', halign: 'left' },
        4: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
        5: { halign: 'right' },
        6: { halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    // 4. SIGNATURES
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 60;
    const signY = Math.min(finalY + 14, 250);

    if (finalY > 245) {
      doc.addPage();
      this.drawSignatures(doc, 30, options);
    } else {
      this.drawSignatures(doc, signY, options);
    }

    // 5. FOOTER
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `NileLink BarStock Enterprise · Shift Usage Verification · Page ${i} of ${pageCount}`,
        pageWidth / 2,
        290,
        { align: 'center' }
      );
    }

    doc.save(`${options.cafeName.replace(/\s+/g, '_')}_Shift_History_${Date.now()}.pdf`);
  }

  private static drawMetricCard(
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    value: string,
    color: number[]
  ): void {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(x, y, width, height, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(title, x + 3.5, y + 5.5);

    doc.setFontSize(10.5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 3.5, y + 13.5);
  }

  private static drawSignatures(doc: jsPDF, y: number, options: PDFReportOptions): void {
    const pageWidth = doc.internal.pageSize.getWidth();

    // Box outline
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, pageWidth - 28, 30, 2, 2, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('OFFICIAL VERIFICATION & MANAGEMENT CERTIFICATION', 18, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'I hereby certify under penalty of internal audit that this stock log is verified and true for company payroll and tax records.',
      18,
      y + 11
    );

    // Signature 1
    doc.setDrawColor(148, 163, 184);
    doc.line(18, y + 24, 75, y + 24);
    doc.setFontSize(7);
    doc.text(`Authorized Store Manager (${options.auditorName})`, 18, y + 28);

    // Signature 2
    doc.line(85, y + 24, 140, y + 24);
    doc.text('Shift Supervisor / Auditor', 85, y + 28);

    // Official Stamp
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(pageWidth - 55, y + 5, 37, 20, 1.5, 1.5, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(217, 119, 6);
    doc.text('VERIFIED & AUDITED', pageWidth - 53, y + 11);
    doc.setFontSize(5.5);
    doc.text('BARSTOCK CLOUD ENGINE', pageWidth - 53, y + 15);
    doc.text(`DATE: ${new Date().toISOString().slice(0, 10)}`, pageWidth - 53, y + 20);
  }
}
