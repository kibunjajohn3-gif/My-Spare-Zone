import { OrderStatus, VirtualReceipt } from '../types';

function normalizeOrderStatusForExport(status?: string): OrderStatus {
  if (status === 'Delivered' || status === 'Completed') return 'Delivered';
  if (status === 'Shipped' || status === 'Dispatched') return 'Shipped';
  return 'Pending';
}

function getServiceModeLabel(order: VirtualReceipt): string {
  if (order.deliveryRegion === 'garage_fitting') return 'In-Garage Fitting';
  if (order.deliveryRegion === 'pickup') return 'Counter Pickup';
  if (order.deliveryRegion === 'outside_nairobi') return 'Outside Nairobi Courier';
  return 'Nairobi & Surrounding Delivery';
}

function getFulfillmentReference(order: VirtualReceipt): string {
  const parts: string[] = [];
  if (order.pickupCode) {
    parts.push(`Pickup ${order.pickupCode}${order.pickupStatus ? ` (${order.pickupStatus})` : ''}`);
  }
  if (order.courierName) {
    parts.push(`Courier: ${order.courierName}`);
  }
  if (order.riderName || order.riderPhone || order.riderPlateNumber) {
    const riderSummary = [
      order.riderName ? `Rider: ${order.riderName}` : '',
      order.riderPhone || '',
      order.riderPlateNumber ? `Plate: ${order.riderPlateNumber}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (riderSummary) parts.push(riderSummary);
  }
  return parts.join(' | ');
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  const str = String(value);
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

export function buildOrderHistoryCsv(
  ordersToExport: VirtualReceipt[],
  options?: { filterSummary?: string },
): string {
  const headers = [
    'Receipt No.',
    'Order ID',
    'Issued Date',
    'Issued Timestamp',
    'Order Status',
    'Tracking Stage',
    'Sale Confirmed',
    'Confirmed At',
    'Customer Name',
    'Customer Phone',
    'Customer Email',
    'Service Mode',
    'Delivery Address / Destination',
    'Courier / Rider / Pickup Ref',
    'Vehicle Details',
    'Fitting Schedule',
    'Payment Method',
    'Payment Status',
    'Transaction Ref (M-Pesa / Card)',
    'Units Sold',
    'Items Purchased',
    'Subtotal (KSh)',
    'Delivery / Rider Fee (KSh)',
    'Discount Amount (KSh)',
    'Discount / Bargain Details',
    'Referral Credit Applied (KSh)',
    'Referral Code / Partner',
    'Referral Commission (KSh)',
    'Total (KSh)',
  ];

  let totalUnits = 0;
  let totalSubtotal = 0;
  let totalDeliveryFee = 0;
  let totalDiscount = 0;
  let totalReferralApplied = 0;
  let totalReferralCommission = 0;
  let grandTotal = 0;

  const dataRows = ordersToExport.map((order) => {
    const status = normalizeOrderStatusForExport(order.status);
    const isConfirmed = Boolean(order.saleConfirmed || status !== 'Pending');
    const units = order.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
    const deliveryFee = Math.max(0, Number(order.deliveryFee) || 0);
    const discountAmount = Math.max(0, Number(order.discountAmount) || 0);
    const referralApplied = Math.max(0, Number(order.referralCreditApplied) || 0);
    const referralCommission = Math.max(0, Number(order.referralCreditAmount) || 0);
    const subtotal = Number(order.subtotal) || 0;
    const total = Number(order.total) || 0;

    totalUnits += units;
    totalSubtotal += subtotal;
    totalDeliveryFee += deliveryFee;
    totalDiscount += discountAmount;
    totalReferralApplied += referralApplied;
    totalReferralCommission += referralCommission;
    grandTotal += total;

    const paymentRef = order.mpesaReceiptNumber || order.cardTransactionRef || '';
    const paymentStatus =
      order.paymentStatus || (paymentRef || isConfirmed ? 'Paid' : 'Pending');
    const itemsSummary = order.items
      .map(
        (item) =>
          `${item.quantity}x ${item.name} (${item.sku}) @ KSh ${Number(item.unitPrice || 0).toLocaleString('en-KE')}`,
      )
      .join('; ');
    const fittingSchedule = order.fittingDate
      ? `${order.fittingDate}${order.fittingSlotLabel ? ` ${order.fittingSlotLabel}` : ''} (${order.fittingStatus || 'Scheduled'})`
      : '';
    const discountDetails = [
      order.discountLabel || '',
      order.bargainCode ? `Bargain ${order.bargainCode}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const referralPartner = order.referralCodeUsed
      ? `${order.referralCodeUsed}${order.referralPartnerName ? ` (${order.referralPartnerName})` : ''}${order.referralCreditStatus ? ` [${order.referralCreditStatus}]` : ''}`
      : '';

    const cells: Array<string | number> = [
      order.receiptNumber,
      order.id,
      (order.issuedAt || '').slice(0, 10),
      order.issuedAt || '',
      status,
      order.trackingStage || '',
      isConfirmed ? 'Confirmed' : 'Pending',
      order.confirmedAt || '',
      order.customerName,
      order.customerPhone,
      order.customerEmail || '',
      getServiceModeLabel(order),
      order.deliveryDestination || order.deliveryAddress,
      getFulfillmentReference(order),
      order.vehicleDetails || '',
      fittingSchedule,
      order.paymentMethod,
      paymentStatus,
      paymentRef,
      units,
      itemsSummary,
      subtotal,
      deliveryFee,
      discountAmount,
      discountDetails,
      referralApplied,
      referralPartner,
      referralCommission,
      total,
    ];

    return cells.map(escapeCsvCell).join(',');
  });

  const summaryCells: Array<string | number> = [
    'TOTALS',
    `Orders: ${ordersToExport.length}`,
    options?.filterSummary ? `Filter: ${options.filterSummary}` : 'All Visible Orders',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalUnits,
    '',
    totalSubtotal,
    totalDeliveryFee,
    totalDiscount,
    '',
    totalReferralApplied,
    '',
    totalReferralCommission,
    grandTotal,
  ];

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...dataRows,
    summaryCells.map(escapeCsvCell).join(','),
  ];

  return `\uFEFF${lines.join('\n')}`;
}

export function downloadOrderHistoryCsv(
  ordersToExport: VirtualReceipt[],
  options?: {
    dateFilter?: string;
    isFiltered?: boolean;
    isSelection?: boolean;
    filterSummary?: string;
  },
): void {
  if (ordersToExport.length === 0) return;

  const csvContent = buildOrderHistoryCsv(ordersToExport, {
    filterSummary: options?.filterSummary,
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStamp = options?.dateFilter || new Date().toISOString().slice(0, 10);
  const suffix = options?.isSelection
    ? '-selected'
    : options?.isFiltered
      ? '-filtered'
      : '';
  link.href = url;
  link.download = `my-spare-zone-order-history${suffix}-${dateStamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
