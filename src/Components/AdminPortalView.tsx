import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  Plus,
  Trash2,
  Pencil,
  Send,
  Receipt,
  MessageSquare,
  Package,
  X,
  Check,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Download,
  Search,
  Bell,
  LogOut,
  Droplets,
  Calendar,
  CheckCircle2,
  Star,
  Wrench,
  Percent,
  Smartphone,
  LayoutGrid,
  List,
  Tag,
  FileText,
  ShieldCheck,
  Clock,
  ExternalLink,
  Eye,
  XCircle,
  ClipboardList,
  Filter,
  Printer,
  Activity,
  Handshake,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BrowserNotificationState } from '../utils/chatNotifications';
import { downloadOrderHistoryCsv } from '../utils/orderCsvExport';
import type {
  BargainOffer,
  BargainSettings,
  BargainStatus,
  BodyPartConditionGrade,
  CarBrand,
  ChatMessage,
  ChatThreadSummary,
  CustomerReview,
  DeliveryRegion,
  FittingAppointmentStatus,
  GaragePartnerProfile,
  GaragePartnerStatus,
  OrderStatus,
  OrderTrackingStage,
  PartSourceType,
  PartSourcingLog,
  PrimaryCategory,
  SearchLogEntry,
  SmsNotificationRecord,
  SparePart,
  VirtualReceipt,
} from '../types';
import {
  BARGAIN_MAX_DISCOUNT_PCT,
  BARGAIN_PRESET_DISCOUNTS,
  BODY_PART_CONDITION_GRADES,
  CATEGORY_SUBCATEGORIES,
  detectGearboxType,
  FITTING_APPOINTMENT_STATUSES,
  formatCurrency,
  formatFittingDateLabel,
  getBodyPartConditionInfo,
  getGarageSlotLabel,
  getPartImageGallery,
  getPartOfferDetails,
  getPartnerLoyaltyItemsCount,
  getPartnerTierDiscountPct,
  getWhatsAppPhoneUrl,
  isGearboxPart,
  isJoinedPartnerProgram,
  normalizeOrderStatus,
  normalizeTrackingStage,
  ORDER_STATUSES,
  ORDER_TRACKING_STAGES,
  PART_BRAND_OPTIONS,
  PARTNER_BASE_DISCOUNT_PCT,
  PARTNER_BULK_BONUS_PCT,
  PARTNER_BULK_MIN_QTY,
  PARTNER_MAX_DISCOUNT_PCT,
  PARTNER_REGULAR_3_DISCOUNT_PCT,
  PARTNER_REGULAR_6_DISCOUNT_PCT,
  PICKUP_RESERVATION_HOURS,
  PRIMARY_CATEGORIES,
} from '../constants/catalog';
import { PartImage } from './PartImage';
import { SalesTrendChart, type DailySalesTrendPoint } from './SalesTrendChart';
import { PartSourcingChart } from './PartSourcingChart';
import { SalesDashboardPanel } from './SalesDashboardPanel';

export type AdminTab =
  | 'inventory'
  | 'salesDashboard'
  | 'weeklySales'
  | 'receipts'
  | 'partLogs'
  | 'reviews'
  | 'partners'
  | 'bargains'
  | 'orderSms'
  | 'searchLogs'
  | 'inbox';

interface AdminPortalViewProps {
  parts: SparePart[];
  authToken: string;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  selectedSessionId?: string | null;
  onSelectedSessionChange?: (sessionId: string | null) => void;
  unreadBySession?: Record<string, number>;
  totalUnreadChats?: number;
  latestChatMessage?: ChatMessage | null;
  latestBargainEvent?: BargainOffer | null;
  onMarkSessionRead?: (sessionId: string) => void;
  notificationPermission?: BrowserNotificationState;
  onRequestNotificationPermission?: () => void;
  onPartsChanged: () => Promise<void>;
  onReviewsChanged?: () => Promise<void> | void;
  onViewReceipt: (receipt: VirtualReceipt) => void;
  onOrderUpdated?: (receipt: VirtualReceipt) => void;
  onBackToStorefront: () => void;
  onLogout?: () => Promise<void> | void;
}

type SalesReportPeriod = 'weekly' | 'monthly' | 'yearly';

interface CompiledSalesBreakdownRow {
  key: string;
  label: string;
  subLabel: string;
  drillPeriod?: SalesReportPeriod;
  drillValue?: string;
  ordersCount: number;
  confirmedOrdersCount: number;
  unitsSold: number;
  revenue: number;
}

interface CompiledSaleItem {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  status: OrderStatus;
  saleConfirmed: boolean;
  confirmedAt?: string;
  unitsCount: number;
  itemsSummary: string;
  total: number;
}

interface CompiledSalesReport {
  period: SalesReportPeriod;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  selectedMonth: string;
  selectedYear: string;
  availableMonths: string[];
  availableYears: string[];
  rollupTotals: {
    weekly: { totalRevenue: number; totalOrders: number; confirmedOrders: number; totalUnitsSold: number };
    monthly: { totalRevenue: number; totalOrders: number; confirmedOrders: number; totalUnitsSold: number; key: string };
    yearly: { totalRevenue: number; totalOrders: number; confirmedOrders: number; totalUnitsSold: number; key: string };
  };
  dailyTrend30Days?: DailySalesTrendPoint[];
  summary: {
    totalRevenue: number;
    totalOrders: number;
    confirmedOrders: number;
    totalUnitsSold: number;
    averageOrderValue: number;
  };
  breakdown: CompiledSalesBreakdownRow[];
  topSellingParts: Array<{
    partId: string;
    name: string;
    sku: string;
    category: string;
    unitsSold: number;
    revenue: number;
  }>;
  paymentMethods: Array<{
    method: string;
    ordersCount: number;
    revenue: number;
  }>;
  sales: CompiledSaleItem[];
}

export function AdminPortalView({
  parts,
  authToken,
  activeTab: controlledTab,
  onTabChange,
  selectedSessionId: controlledSessionId,
  onSelectedSessionChange,
  unreadBySession = {},
  totalUnreadChats = 0,
  latestChatMessage = null,
  latestBargainEvent = null,
  onMarkSessionRead,
  notificationPermission = 'default',
  onRequestNotificationPermission,
  onPartsChanged,
  onReviewsChanged,
  onViewReceipt,
  onOrderUpdated,
  onBackToStorefront,
  onLogout,
}: AdminPortalViewProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [downloadingSource, setDownloadingSource] = useState(false);
  const [internalTab, setInternalTab] = useState<AdminTab>('inventory');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: AdminTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isOffer, setIsOffer] = useState(false);
  const [previousPrice, setPreviousPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<PrimaryCategory>('Body parts');
  const [subcategory, setSubcategory] = useState<string>(
    CATEGORY_SUBCATEGORIES['Body parts'][0],
  );
  const [brand, setBrand] = useState<CarBrand>('Toyota');
  const [carModel, setCarModel] = useState('');
  const [yearOfMake, setYearOfMake] = useState('');
  const [conditionGrade, setConditionGrade] = useState<BodyPartConditionGrade | ''>('');
  const [gearboxOilType, setGearboxOilType] = useState('');
  const [floorPrice, setFloorPrice] = useState('');
  const [createImages, setCreateImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Edit modal state
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<PrimaryCategory>('Body parts');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editBrand, setEditBrand] = useState<CarBrand>('Toyota');
  const [editCarModel, setEditCarModel] = useState('');
  const [editYearOfMake, setEditYearOfMake] = useState('');
  const [editConditionGrade, setEditConditionGrade] = useState<BodyPartConditionGrade | ''>('');
  const [editGearboxOilType, setEditGearboxOilType] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editFloorPrice, setEditFloorPrice] = useState('');
  const [editIsOffer, setEditIsOffer] = useState(false);
  const [editPreviousPrice, setEditPreviousPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editImageUrlInput, setEditImageUrlInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // One-tap inline Re-list state
  const [relistingPartId, setRelistingPartId] = useState<string | null>(null);
  const [relistPriceDraft, setRelistPriceDraft] = useState('');
  const [relistSaving, setRelistSaving] = useState(false);
  const [relistError, setRelistError] = useState<string | null>(null);
  const [relistNotice, setRelistNotice] = useState<string | null>(null);

  const isCreateGearbox =
    category !== 'Gearbox Oil' &&
    (subcategory === 'Gearboxes' || /\bgearbox(?:es)?\b/i.test(name));
  const isEditGearbox =
    editCategory !== 'Gearbox Oil' &&
    (editSubcategory === 'Gearboxes' || /\bgearbox(?:es)?\b/i.test(editName));

  // Posted Inventory real-time filters & view state
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<'All' | PrimaryCategory>('All');
  const [inventorySubcategoryFilter, setInventorySubcategoryFilter] = useState<string>('All');
  const [inventoryOffersOnly, setInventoryOffersOnly] = useState(false);
  const [inventoryViewMode, setInventoryViewMode] = useState<'table' | 'cards'>('table');

  // Customer Care Inbox state
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [internalSelectedSessionId, setInternalSelectedSessionId] = useState<string | null>(null);
  const selectedSessionId = controlledSessionId !== undefined ? controlledSessionId : internalSelectedSessionId;
  const setSelectedSessionId = (nextId: string | null) => {
    setInternalSelectedSessionId(nextId);
    onSelectedSessionChange?.(nextId);
  };
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Orders / Receipts Ledger state
  const [orders, setOrders] = useState<VirtualReceipt[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [receiptSearchField, setReceiptSearchField] = useState<
    'all' | 'customer' | 'phone' | 'receipt'
  >('all');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<'All' | OrderStatus>('All');
  const [receiptServiceFilter, setReceiptServiceFilter] = useState<
    'All' | 'garage_fitting' | 'delivery_pickup'
  >('All');
  const [receiptFittingStatusFilter, setReceiptFittingStatusFilter] = useState<
    'All' | FittingAppointmentStatus
  >('All');
  const [receiptConfirmationFilter, setReceiptConfirmationFilter] = useState<
    'all' | 'confirmed' | 'unconfirmed'
  >('all');
  const [receiptDateFilter, setReceiptDateFilter] = useState('');
  const [showAllGarageAppointments, setShowAllGarageAppointments] = useState(false);
  const [updatingFittingOrderId, setUpdatingFittingOrderId] = useState<string | null>(null);
  const [releasingCreditOrderId, setReleasingCreditOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkOrderStatusTarget, setBulkOrderStatusTarget] = useState<OrderStatus>('Shipped');
  const [bulkUpdatingOrders, setBulkUpdatingOrders] = useState(false);
  const [bulkOrderUpdateNotice, setBulkOrderUpdateNotice] = useState<{
    updatedCount: number;
    status: OrderStatus;
    smsNotifications: SmsNotificationRecord[];
    totalRecipients: number;
  } | null>(null);
  const [bulkOrderUpdateError, setBulkOrderUpdateError] = useState<string | null>(null);
  const [activeOrderDetails, setActiveOrderDetails] = useState<VirtualReceipt | null>(null);
  const [riderNameInput, setRiderNameInput] = useState('');
  const [riderPhoneInput, setRiderPhoneInput] = useState('');
  const [riderPlateInput, setRiderPlateInput] = useState('');
  const [riderPhotoUrlInput, setRiderPhotoUrlInput] = useState('');
  const [riderLiveLocationUrlInput, setRiderLiveLocationUrlInput] = useState('');
  const [savingRiderDetails, setSavingRiderDetails] = useState(false);
  const [riderSaveNotice, setRiderSaveNotice] = useState<string | null>(null);
  const [riderSaveError, setRiderSaveError] = useState<string | null>(null);
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [pickupLookupLoading, setPickupLookupLoading] = useState(false);
  const [pickupLookupError, setPickupLookupError] = useState<string | null>(null);
  const [pickupLookupOrder, setPickupLookupOrder] = useState<VirtualReceipt | null>(null);
  const [claimingPickupId, setClaimingPickupId] = useState<string | null>(null);
  const [pickupActionNotice, setPickupActionNotice] = useState<string | null>(null);

  // Popular Search Logs state
  const [searchLogs, setSearchLogs] = useState<SearchLogEntry[]>([]);
  const [loadingSearchLogs, setLoadingSearchLogs] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  // Compiled Sales Reports state (Weekly -> Monthly -> Yearly)
  const [salesReport, setSalesReport] = useState<CompiledSalesReport | null>(null);
  const [loadingWeeklySales, setLoadingWeeklySales] = useState(false);
  const [weeklySalesError, setWeeklySalesError] = useState<string | null>(null);
  const [reportPeriod, setReportPeriod] = useState<SalesReportPeriod>('weekly');
  const [reportWeekEnd, setReportWeekEnd] = useState('');
  const [reportMonth, setReportMonth] = useState('');
  const [reportYear, setReportYear] = useState('');
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  // Customer & Mechanic Reviews Moderation state
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  // Garage / Mechanic Partners state
  const [partners, setPartners] = useState<GaragePartnerProfile[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<'all' | GaragePartnerStatus>('all');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'all' | 'mechanic' | 'garage'>('all');
  const [updatingPartnerId, setUpdatingPartnerId] = useState<string | null>(null);
  const [previewingProofPartner, setPreviewingProofPartner] = useState<GaragePartnerProfile | null>(null);
  const [rejectingPartner, setRejectingPartner] = useState<GaragePartnerProfile | null>(null);
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState('');
  const [partnerActionNotice, setPartnerActionNotice] = useState<string | null>(null);

  // Automated & Manual Order Status SMS Notifications state (Sent directly from Admin Number -> Customer/Mechanic/Garage)
  const [adminSenderPhone, setAdminSenderPhone] = useState('+254706130014');
  const [adminSenderPhoneDraft, setAdminSenderPhoneDraft] = useState('+254706130014');
  const [autoOrderSmsEnabled, setAutoOrderSmsEnabled] = useState(true);
  const [savingSmsSettings, setSavingSmsSettings] = useState(false);
  const [smsSettingsNotice, setSmsSettingsNotice] = useState<string | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsNotificationRecord[]>([]);
  const [loadingSms, setLoadingSms] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [receiptSmsNotice, setReceiptSmsNotice] = useState<SmsNotificationRecord | null>(null);
  const [confirmClearSmsLogs, setConfirmClearSmsLogs] = useState(false);
  const [smsComposerMode, setSmsComposerMode] = useState<'manual' | 'test'>('test');
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [testSmsRecipientName, setTestSmsRecipientName] = useState('');
  const [testSmsRecipientRole, setTestSmsRecipientRole] = useState<'Customer' | 'Mechanic' | 'Garage'>('Customer');
  const [testSmsStatus, setTestSmsStatus] = useState<'Pending' | 'Shipped' | 'Delivered' | 'In Bay' | 'Completed' | 'Custom'>('Shipped');
  const [testSmsReceiptRef, setTestSmsReceiptRef] = useState('');
  const [testSmsCustomMessage, setTestSmsCustomMessage] = useState('');
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [testSmsError, setTestSmsError] = useState<string | null>(null);
  const [testSmsResult, setTestSmsResult] = useState<{
    entry: SmsNotificationRecord;
    phone: string;
    message: string;
  } | null>(null);

  // SMS Log filter & search state
  const [smsLogScopeFilter, setSmsLogScopeFilter] = useState<'manual' | 'all' | 'automated'>('all');
  const [smsLogChannelFilter, setSmsLogChannelFilter] = useState<'all' | 'admin_direct' | 'phone_sms_app' | 'test'>('all');
  const [smsLogSearchQuery, setSmsLogSearchQuery] = useState('');

  // Admin-only Fillable Part Sourcing & Mechanic Fitting Log state
  const [partSourcingLogs, setPartSourcingLogs] = useState<PartSourcingLog[]>([]);
  const [loadingPartLogs, setLoadingPartLogs] = useState(false);
  const [partLogSearchQuery, setPartLogSearchQuery] = useState('');
  const [partLogSourceFilter, setPartLogSourceFilter] = useState<
    'all' | 'in_store' | 'outside_shop' | 'fitted_by_us' | 'not_fitted_by_us'
  >('all');
  const [partLogStaffFilter, setPartLogStaffFilter] = useState<string>('all');
  const [partLogMechanicFilter, setPartLogMechanicFilter] = useState<string>('all');
  const [partLogDateFrom, setPartLogDateFrom] = useState('');
  const [partLogDateTo, setPartLogDateTo] = useState('');
  const [addingPartLogRow, setAddingPartLogRow] = useState(false);
  const [syncingPartLogs, setSyncingPartLogs] = useState(false);
  const [savingPartLogIds, setSavingPartLogIds] = useState<Record<string, boolean>>({});
  const [dirtyPartLogIds, setDirtyPartLogIds] = useState<Record<string, boolean>>({});
  const [partLogNotice, setPartLogNotice] = useState<string | null>(null);
  const [quickAddPartSelection, setQuickAddPartSelection] = useState('');

  // Customer Bargains & Price Negotiation state
  const [bargains, setBargains] = useState<BargainOffer[]>([]);
  const [loadingBargains, setLoadingBargains] = useState(false);
  const [bargainSettings, setBargainSettings] = useState<BargainSettings>({
    autoAcceptMaxDiscountPct: 0,
  });
  const [autoAcceptDraftPct, setAutoAcceptDraftPct] = useState('0');
  const [savingBargainSettings, setSavingBargainSettings] = useState(false);
  const [bargainStatusFilter, setBargainStatusFilter] = useState<
    'all' | 'pending' | 'countered' | 'accepted' | 'redeemed' | 'closed'
  >('all');
  const [bargainSearchQuery, setBargainSearchQuery] = useState('');
  const [updatingBargainId, setUpdatingBargainId] = useState<string | null>(null);
  const [counteringBargainId, setCounteringBargainId] = useState<string | null>(null);
  const [counterPriceDraft, setCounterPriceDraft] = useState('');
  const [bargainAdminNoteDraft, setBargainAdminNoteDraft] = useState<Record<string, string>>({});
  const [bargainSendSms, setBargainSendSms] = useState(true);
  const [bargainNotice, setBargainNotice] = useState<string | null>(null);
  const [bargainError, setBargainError] = useState<string | null>(null);
  const [expandedBargainHistoryIds, setExpandedBargainHistoryIds] = useState<
    Record<string, boolean>
  >({});

  const {
    recentPurchasedOptions,
    inventoryCatalogOptions,
    partOptionByKey,
    partOptionByLowerName,
  } = useMemo(() => {
    interface QuickPickPartOption {
      key: string;
      name: string;
      category: string;
      sku: string;
      receiptNumber?: string;
      stock?: number;
    }

    const partById = new Map<string, SparePart>();
    const partBySku = new Map<string, SparePart>();
    const partByLowerName = new Map<string, SparePart>();
    for (const part of parts) {
      partById.set(part.id, part);
      if (part.sku) partBySku.set(part.sku.trim().toLowerCase(), part);
      if (part.name) partByLowerName.set(part.name.trim().toLowerCase(), part);
    }

    const recentList: QuickPickPartOption[] = [];
    const seenRecent = new Set<string>();
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime(),
    );

    for (const order of sortedOrders) {
      for (const item of order.items) {
        const cleanName = (item.name || '').trim();
        if (!cleanName) continue;
        const dedupeKey =
          item.partId || item.sku?.trim().toLowerCase() || cleanName.toLowerCase();
        if (seenRecent.has(dedupeKey)) continue;
        seenRecent.add(dedupeKey);

        const catalogMatch =
          partById.get(item.partId) ||
          (item.sku ? partBySku.get(item.sku.trim().toLowerCase()) : undefined) ||
          partByLowerName.get(cleanName.toLowerCase());

        recentList.push({
          key: `recent:${dedupeKey}`,
          name: cleanName,
          category: item.category || catalogMatch?.category || '',
          sku: item.sku || catalogMatch?.sku || '',
          receiptNumber: order.receiptNumber,
        });
        if (recentList.length >= 25) break;
      }
      if (recentList.length >= 25) break;
    }

    const inventoryList: QuickPickPartOption[] = [...parts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        key: `inv:${p.id}`,
        name: p.name,
        category: p.category,
        sku: p.sku || '',
        stock: p.stock,
      }));

    const byKey = new Map<string, QuickPickPartOption>();
    const byLowerName = new Map<string, QuickPickPartOption>();
    for (const opt of recentList) {
      byKey.set(opt.key, opt);
      byLowerName.set(opt.name.toLowerCase(), opt);
    }
    for (const opt of inventoryList) {
      byKey.set(opt.key, opt);
      if (!byLowerName.has(opt.name.toLowerCase())) {
        byLowerName.set(opt.name.toLowerCase(), opt);
      }
    }

    return {
      recentPurchasedOptions: recentList,
      inventoryCatalogOptions: inventoryList,
      partOptionByKey: byKey,
      partOptionByLowerName: byLowerName,
    };
  }, [orders, parts]);

  const handleCategoryChange = (nextCategory: PrimaryCategory) => {
    setCategory(nextCategory);
    setSubcategory(CATEGORY_SUBCATEGORIES[nextCategory][0]);
    if (nextCategory !== 'Body parts') {
      setConditionGrade('');
    }
    if (nextCategory === 'Gearbox Oil') {
      setBrand('Universal');
      setGearboxOilType('');
    } else if (brand === 'Universal') {
      setBrand('Toyota');
    }
  };

  const readImageFile = (file: File, onLoaded: (result: string) => void, onError: (msg: string) => void) => {
    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file (PNG, JPG, WEBP, or GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError('Image file must be under 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const appendCreateImage = (src: string) => {
    setCreateImages((prev) => {
      if (prev.length >= 3) {
        setFormError('Maximum 3 pictures allowed per item. Remove one before adding another.');
        return prev;
      }
      setFormError(null);
      return [...prev, src];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 3 - createImages.length);
    if (remainingSlots <= 0) {
      setFormError('Maximum 3 pictures allowed per item. Remove one first to replace.');
      return;
    }
    files.slice(0, remainingSlots).forEach((file) => {
      readImageFile(
        file,
        (result) => appendCreateImage(result),
        (msg) => setFormError(msg),
      );
    });
    e.target.value = '';
  };

  const handleDropFile = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 3 - createImages.length);
    if (remainingSlots <= 0) {
      setFormError('Maximum 3 pictures allowed per item. Remove one first to replace.');
      return;
    }
    files.slice(0, remainingSlots).forEach((file) => {
      readImageFile(
        file,
        (result) => appendCreateImage(result),
        (msg) => setFormError(msg),
      );
    });
  };

  const handleAddCreateImageUrl = () => {
    const clean = imageUrlInput.trim();
    if (!clean) return;
    if (createImages.length >= 3) {
      setFormError('Maximum 3 pictures allowed per item.');
      return;
    }
    appendCreateImage(clean);
    setImageUrlInput('');
  };

  const clearSelectedImage = (index?: number) => {
    if (typeof index === 'number') {
      setCreateImages((prev) => prev.filter((_, idx) => idx !== index));
    } else {
      setCreateImages([]);
      setImageUrlInput('');
      if (createFileInputRef.current) {
        createFileInputRef.current.value = '';
      }
    }
  };

  const setCreateCoverIndex = (idx: number) => {
    setCreateImages((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      return [picked, ...next];
    });
  };

  const handleCreatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!name.trim() || !description.trim() || !price.trim()) {
      setFormError(
        isOffer
          ? 'Please provide an item name, short description, previous price, and offer price.'
          : 'Please provide an item name, short description, and price.',
      );
      return;
    }
    const numericPrice = Number(price);
    const numericPreviousPrice = Number(previousPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setFormError(
        isOffer
          ? 'Please enter a valid offer price greater than zero.'
          : 'Please enter a valid item price greater than zero.',
      );
      return;
    }

    let numericFloorPrice: number | undefined;
    if (floorPrice.trim()) {
      const parsedFloor = Number(floorPrice);
      if (!Number.isFinite(parsedFloor) || parsedFloor <= 0) {
        setFormError('Bargaining floor price must be a positive amount greater than zero.');
        return;
      }
      if (Math.round(parsedFloor) > Math.round(numericPrice)) {
        setFormError('Bargaining floor price cannot exceed the selling price.');
        return;
      }
      numericFloorPrice = Math.round(parsedFloor);
    }

    if (isOffer) {
      if (!previousPrice.trim() || !Number.isFinite(numericPreviousPrice) || numericPreviousPrice <= 0) {
        setFormError('Please enter the previous price before posting this item in offers.');
        return;
      }
      if (Math.round(numericPreviousPrice) <= Math.round(numericPrice)) {
        setFormError('Offer price must be lower than the previous price.');
        return;
      }
    }
    if (isCreateGearbox && !gearboxOilType.trim()) {
      setFormError('Please type in the type of gearbox oil this gearbox uses.');
      return;
    }

    const finalImages = [...createImages];
    if (imageUrlInput.trim() && finalImages.length < 3) {
      finalImages.push(imageUrlInput.trim());
    }
    if (finalImages.length === 0) {
      setFormError('Please upload at least 1 cover picture of the spare part (up to 3 pictures).');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/parts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          price: numericPrice,
          floorPrice: numericFloorPrice,
          isOffer,
          previousPrice: isOffer ? numericPreviousPrice : undefined,
          stock: Number(stock) || 10,
          sku: sku.trim(),
          category,
          subcategory,
          brand,
          carModel: carModel.trim() || undefined,
          yearOfMake: yearOfMake.trim() || undefined,
          conditionGrade: category === 'Body parts' && conditionGrade ? conditionGrade : undefined,
          gearboxOilType: isCreateGearbox ? gearboxOilType.trim() : undefined,
          imageUrl: finalImages[0],
          imageUrls: finalImages.slice(0, 3),
        }),
      });
      const data = (await res.json()) as { part?: SparePart; error?: string };
      if (!res.ok || !data.part) {
        setFormError(data.error || 'Failed to publish spare part.');
        return;
      }

      setName('');
      setDescription('');
      setPrice('');
      setFloorPrice('');
      setIsOffer(false);
      setPreviousPrice('');
      setStock('10');
      setSku('');
      setCarModel('');
      setYearOfMake('');
      setConditionGrade('');
      setGearboxOilType('');
      setCreateImages([]);
      setImageUrlInput('');
      if (createFileInputRef.current) {
        createFileInputRef.current.value = '';
      }
      const publishedOffer = getPartOfferDetails(data.part);
      setFormSuccess(
        publishedOffer.hasOffer && publishedOffer.previousPrice !== null
          ? `Published Offer "${data.part.name}" (Now ${formatCurrency(data.part.price)} · Was ${formatCurrency(publishedOffer.previousPrice)}, ${publishedOffer.discountPercent}% OFF) to ${data.part.brand || brand} · ${data.part.category} · ${data.part.subcategory}.`
          : `Published "${data.part.name}" (${formatCurrency(data.part.price)}) to ${data.part.brand || brand} · ${data.part.category} · ${data.part.subcategory}.`,
      );
      await onPartsChanged();
    } catch {
      setFormError('Network error while saving spare part.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePart = async (part: SparePart) => {
    const res = await fetch(`/api/parts/${encodeURIComponent(part.id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      await onPartsChanged();
    }
  };

  const openEditModal = (part: SparePart) => {
    const offer = getPartOfferDetails(part);
    setEditingPart(part);
    setEditName(part.name);
    setEditCategory(part.category);
    setEditSubcategory(part.subcategory);
    setEditBrand(part.brand || (part.category === 'Gearbox Oil' ? 'Universal' : 'Toyota'));
    setEditCarModel(part.carModel || '');
    setEditYearOfMake(part.yearOfMake || '');
    setEditConditionGrade(
      part.category === 'Body parts' && part.conditionGrade ? part.conditionGrade : '',
    );
    setEditGearboxOilType(part.gearboxOilType || '');
    setEditPrice(String(part.price));
    setEditFloorPrice(
      typeof part.floorPrice === 'number' && part.floorPrice > 0 ? String(part.floorPrice) : '',
    );
    setEditIsOffer(offer.hasOffer);
    setEditPreviousPrice(offer.previousPrice !== null ? String(offer.previousPrice) : '');
    setEditStock(String(part.stock));
    setEditDescription(part.description);
    setEditImages(getPartImageGallery(part));
    setEditImageUrlInput('');
    setEditError(null);
  };

  const handleEditCategoryChange = (nextCategory: PrimaryCategory) => {
    setEditCategory(nextCategory);
    setEditSubcategory(CATEGORY_SUBCATEGORIES[nextCategory][0]);
    if (nextCategory !== 'Body parts') {
      setEditConditionGrade('');
    }
    if (nextCategory === 'Gearbox Oil') {
      setEditGearboxOilType('');
    }
  };

  const openQuickRelist = (part: SparePart) => {
    setRelistingPartId(part.id);
    setRelistPriceDraft(String(part.price));
    setRelistError(null);
    setRelistNotice(null);
  };

  const handleQuickRelistSubmit = async (part: SparePart) => {
    const numericPrice = Number(relistPriceDraft);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setRelistError('Enter a valid price greater than zero to re-list.');
      return;
    }
    setRelistSaving(true);
    setRelistError(null);
    setRelistNotice(null);
    try {
      const res = await fetch(`/api/parts/${encodeURIComponent(part.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          price: Math.round(numericPrice),
          relist: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        part?: SparePart;
        error?: string;
      };
      if (!res.ok || !data.part) {
        setRelistError(data.error || 'Could not re-list spare part.');
        return;
      }
      setRelistingPartId(null);
      setRelistNotice(
        `Re-listed "${data.part.name}" at ${formatCurrency(data.part.price)} and moved it to the top of inventory.`,
      );
      await onPartsChanged();
    } catch {
      setRelistError('Network error while re-listing spare part.');
    } finally {
      setRelistSaving(false);
    }
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 3 - editImages.length);
    if (remainingSlots <= 0) {
      setEditError('Maximum 3 pictures allowed per item. Remove one first to add another.');
      return;
    }
    files.slice(0, remainingSlots).forEach((file) => {
      readImageFile(
        file,
        (result) => {
          setEditImages((prev) => (prev.length >= 3 ? prev : [...prev, result]));
          setEditError(null);
        },
        (msg) => setEditError(msg),
      );
    });
    e.target.value = '';
  };

  const handleAddEditImageUrl = () => {
    const clean = editImageUrlInput.trim();
    if (!clean) return;
    if (editImages.length >= 3) {
      setEditError('Maximum 3 pictures allowed per item.');
      return;
    }
    setEditImages((prev) => [...prev, clean]);
    setEditImageUrlInput('');
    setEditError(null);
  };

  const setEditCoverIndex = (idx: number) => {
    setEditImages((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      return [picked, ...next];
    });
  };

  const removeEditImage = (idx: number) => {
    setEditImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;
    if (isEditGearbox && !editGearboxOilType.trim()) {
      setEditError('Please type in the type of gearbox oil this gearbox uses.');
      return;
    }
    const numericEditPrice = Number(editPrice);
    const numericEditPreviousPrice = Number(editPreviousPrice);
    if (!Number.isFinite(numericEditPrice) || numericEditPrice <= 0) {
      setEditError('Please enter a valid price greater than zero.');
      return;
    }

    let resolvedEditFloor: number | null = null;
    if (editFloorPrice.trim()) {
      const parsedFloor = Number(editFloorPrice);
      if (!Number.isFinite(parsedFloor) || parsedFloor <= 0) {
        setEditError('Bargaining floor price must be a positive amount greater than zero.');
        return;
      }
      if (Math.round(parsedFloor) > Math.round(numericEditPrice)) {
        setEditError('Bargaining floor price cannot exceed the selling price.');
        return;
      }
      resolvedEditFloor = Math.round(parsedFloor);
    }

    if (editIsOffer) {
      if (
        !editPreviousPrice.trim() ||
        !Number.isFinite(numericEditPreviousPrice) ||
        numericEditPreviousPrice <= 0
      ) {
        setEditError('Please enter a valid previous price for this offer.');
        return;
      }
      if (Math.round(numericEditPreviousPrice) <= Math.round(numericEditPrice)) {
        setEditError('Offer price must be lower than the previous price.');
        return;
      }
    }

    const finalEditImages = [...editImages];
    if (editImageUrlInput.trim() && finalEditImages.length < 3) {
      finalEditImages.push(editImageUrlInput.trim());
    }
    if (finalEditImages.length === 0) {
      setEditError('At least 1 cover picture is required for the spare part.');
      return;
    }

    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/parts/${encodeURIComponent(editingPart.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory,
          subcategory: editSubcategory,
          brand: editBrand,
          carModel: editCarModel.trim(),
          yearOfMake: editYearOfMake.trim(),
          conditionGrade: editCategory === 'Body parts' ? editConditionGrade : '',
          gearboxOilType: isEditGearbox ? editGearboxOilType.trim() : '',
          price: numericEditPrice,
          floorPrice: resolvedEditFloor,
          isOffer: editIsOffer,
          previousPrice: editIsOffer ? numericEditPreviousPrice : undefined,
          stock: Number(editStock),
          description: editDescription.trim(),
          imageUrl: finalEditImages[0],
          imageUrls: finalEditImages.slice(0, 3),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(data.error || 'Could not save changes.');
        return;
      }
      setEditingPart(null);
      await onPartsChanged();
    } catch {
      setEditError('Network error while updating spare part.');
    } finally {
      setEditSaving(false);
    }
  };

  const loadThreads = async () => {
    try {
      const res = await fetch('/api/chat/threads', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { threads?: ChatThreadSummary[] };
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
        if (!selectedSessionId && data.threads.length > 0) {
          setSelectedSessionId(data.threads[0].sessionId);
        }
      }
    } catch {
      // ignore transient polling failure
    }
  };

  const loadThreadMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      if (Array.isArray(data.messages)) {
        setThreadMessages(data.messages);
      }
    } catch {
      // ignore
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { orders?: VirtualReceipt[] };
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
        const validIds = new Set(data.orders.map((o) => o.id));
        setSelectedOrderIds((prev) => prev.filter((id) => validIds.has(id)));
        setActiveOrderDetails((prev) =>
          prev ? data.orders!.find((o) => o.id === prev.id) || prev : null,
        );
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLookupPickupCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = pickupCodeInput.trim().toUpperCase();
    if (!cleaned) {
      setPickupLookupError('Enter a counter pickup code (e.g. PKP-XXXXXX).');
      return;
    }
    setPickupLookupLoading(true);
    setPickupLookupError(null);
    setPickupActionNotice(null);
    try {
      const res = await fetch(
        `/api/admin/pickup-lookup?code=${encodeURIComponent(cleaned)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        order?: VirtualReceipt;
        error?: string;
      };
      if (!res.ok || !data.order) {
        setPickupLookupOrder(null);
        setPickupLookupError(data.error || `No counter pickup reservation matched code "${cleaned}".`);
        return;
      }
      setPickupLookupOrder(data.order);
      void loadOrders();
    } catch {
      setPickupLookupError('Network error while looking up counter pickup code.');
    } finally {
      setPickupLookupLoading(false);
    }
  };

  const handleClaimPickupOrder = async (orderId: string) => {
    setClaimingPickupId(orderId);
    setPickupLookupError(null);
    setPickupActionNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/claim-pickup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = (await res.json().catch(() => ({}))) as {
        receipt?: VirtualReceipt;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        setPickupLookupError(data.error || 'Could not complete counter handover.');
        return;
      }
      const updated = data.receipt;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setPickupLookupOrder((prev) => (prev && prev.id === orderId ? updated : prev));
      setActiveOrderDetails((prev) => (prev && prev.id === orderId ? updated : prev));
      onOrderUpdated?.(updated);
      setPickupActionNotice(
        `Handover confirmed for ${updated.pickupCode || updated.receiptNumber} (${updated.customerName}). Status updated to Delivered.`,
      );
      void loadSalesReport();
    } catch {
      setPickupLookupError('Network error while marking pickup claimed.');
    } finally {
      setClaimingPickupId(null);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };

  const handleBulkUpdateOrderStatus = async () => {
    if (selectedOrderIds.length === 0 || bulkUpdatingOrders) return;
    setBulkUpdatingOrders(true);
    setBulkOrderUpdateError(null);
    try {
      const res = await fetch('/api/orders/bulk-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          status: bulkOrderStatusTarget,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        updatedReceipts?: VirtualReceipt[];
        smsNotifications?: SmsNotificationRecord[];
        updatedCount?: number;
      };
      if (!res.ok) {
        setBulkOrderUpdateError(data.error || 'Could not bulk-update selected orders.');
        return;
      }

      const updatedReceipts = Array.isArray(data.updatedReceipts) ? data.updatedReceipts : [];
      const smsNotifications = Array.isArray(data.smsNotifications) ? data.smsNotifications : [];
      if (updatedReceipts.length > 0) {
        const updatedById = new Map(updatedReceipts.map((r) => [r.id, r]));
        setOrders((prev) => prev.map((o) => updatedById.get(o.id) || o));
        setActiveOrderDetails((prev) => (prev ? updatedById.get(prev.id) || prev : null));
        updatedReceipts.forEach((receipt) => onOrderUpdated?.(receipt));
      }
      if (smsNotifications.length > 0) {
        setSmsLogs((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const fresh = smsNotifications.filter((item) => !existingIds.has(item.id));
          return [...fresh, ...prev];
        });
      }

      const totalRecipients = smsNotifications.reduce(
        (sum, entry) => sum + (entry.recipients?.length || 0),
        0,
      );
      setReceiptSmsNotice(null);
      setBulkOrderUpdateNotice({
        updatedCount: data.updatedCount ?? updatedReceipts.length,
        status: bulkOrderStatusTarget,
        smsNotifications,
        totalRecipients,
      });
      setSelectedOrderIds([]);
      void loadSalesReport();
      void loadSmsDashboard();
    } catch {
      setBulkOrderUpdateError('Network error while bulk-updating order statuses.');
    } finally {
      setBulkUpdatingOrders(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      receipt?: VirtualReceipt;
      smsNotification?: SmsNotificationRecord | null;
    };
    if (data.receipt) {
      const updated = data.receipt;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setActiveOrderDetails((prev) => (prev && prev.id === orderId ? updated : prev));
      onOrderUpdated?.(updated);
      if (data.smsNotification) {
        const smsEntry = data.smsNotification;
        setSmsLogs((prev) =>
          prev.some((item) => item.id === smsEntry.id) ? prev : [smsEntry, ...prev],
        );
        setBulkOrderUpdateNotice(null);
        setReceiptSmsNotice(smsEntry);
      }
      void loadSalesReport();
      void loadSmsDashboard();
    }
  };

  const handleUpdateOrderTracking = async (
    orderId: string,
    nextStage: OrderTrackingStage,
  ) => {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ trackingStage: nextStage }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      receipt?: VirtualReceipt;
      smsNotification?: SmsNotificationRecord | null;
    };
    if (data.receipt) {
      const updated = data.receipt;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setActiveOrderDetails((prev) => (prev && prev.id === orderId ? updated : prev));
      onOrderUpdated?.(updated);
      if (data.smsNotification) {
        const smsEntry = data.smsNotification;
        setSmsLogs((prev) =>
          prev.some((item) => item.id === smsEntry.id) ? prev : [smsEntry, ...prev],
        );
        setBulkOrderUpdateNotice(null);
        setReceiptSmsNotice(smsEntry);
      }
      void loadSalesReport();
      void loadSmsDashboard();
    }
  };

  useEffect(() => {
    if (!activeOrderDetails) {
      setRiderNameInput('');
      setRiderPhoneInput('');
      setRiderPlateInput('');
      setRiderPhotoUrlInput('');
      setRiderLiveLocationUrlInput('');
      setRiderSaveNotice(null);
      setRiderSaveError(null);
      return;
    }
    setRiderNameInput(activeOrderDetails.riderName || '');
    setRiderPhoneInput(activeOrderDetails.riderPhone || '');
    setRiderPlateInput(activeOrderDetails.riderPlateNumber || '');
    setRiderPhotoUrlInput(activeOrderDetails.riderPhotoUrl || '');
    setRiderLiveLocationUrlInput(activeOrderDetails.riderLiveLocationUrl || '');
    setRiderSaveNotice(null);
    setRiderSaveError(null);
  }, [activeOrderDetails?.id]);

  const handleSaveRiderDetails = async (order: VirtualReceipt) => {
    setSavingRiderDetails(true);
    setRiderSaveNotice(null);
    setRiderSaveError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/tracking`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          trackingStage: normalizeTrackingStage(order.trackingStage, normalizeOrderStatus(order.status)),
          riderName: riderNameInput.trim(),
          riderPhone: riderPhoneInput.trim(),
          riderPlateNumber: riderPlateInput.trim().toUpperCase(),
          riderPhotoUrl: riderPhotoUrlInput.trim(),
          riderLiveLocationUrl: riderLiveLocationUrlInput.trim(),
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        setRiderSaveError(errBody.error || 'Could not update Nairobi rider details.');
        return;
      }
      const data = (await res.json()) as {
        receipt?: VirtualReceipt;
        smsNotification?: SmsNotificationRecord | null;
      };
      if (data.receipt) {
        const updated = data.receipt;
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        setActiveOrderDetails((prev) => (prev && prev.id === order.id ? updated : prev));
        onOrderUpdated?.(updated);
        if (data.smsNotification) {
          const smsEntry = data.smsNotification;
          setSmsLogs((prev) =>
            prev.some((item) => item.id === smsEntry.id) ? prev : [smsEntry, ...prev],
          );
          setBulkOrderUpdateNotice(null);
          setReceiptSmsNotice(smsEntry);
        }
        setRiderSaveNotice('Rider photo, number plate & live location shared with customer.');
      }
    } catch {
      setRiderSaveError('Network error while saving rider live tracking details.');
    } finally {
      setSavingRiderDetails(false);
    }
  };

  const handleUpdateFittingStatus = async (
    orderId: string,
    nextFittingStatus: FittingAppointmentStatus,
  ) => {
    setUpdatingFittingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/fitting-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fittingStatus: nextFittingStatus }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        receipt?: VirtualReceipt;
        smsNotification?: SmsNotificationRecord | null;
      };
      if (data.receipt) {
        const updated = data.receipt;
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        setActiveOrderDetails((prev) => (prev && prev.id === orderId ? updated : prev));
        onOrderUpdated?.(updated);
        if (data.smsNotification) {
          const smsEntry = data.smsNotification;
          setSmsLogs((prev) =>
            prev.some((item) => item.id === smsEntry.id) ? prev : [smsEntry, ...prev],
          );
          setReceiptSmsNotice(smsEntry);
        }
        void loadSalesReport();
        void loadSmsDashboard();
      }
    } finally {
      setUpdatingFittingOrderId(null);
    }
  };

  const handleConfirmSale = async (orderId: string) => {
    setConfirmingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/confirm`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { receipt?: VirtualReceipt };
      if (data.receipt) {
        const updated = data.receipt;
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        onOrderUpdated?.(updated);
        await loadSalesReport();
      }
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleReleaseReferralCredit = async (orderId: string) => {
    setReleasingCreditOrderId(orderId);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/release-referral-credit`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        receipt?: VirtualReceipt;
        partner?: GaragePartnerProfile;
      };
      if (data.receipt) {
        const updated = data.receipt;
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        onOrderUpdated?.(updated);
      }
      if (data.partner) {
        const updatedPartner = data.partner;
        setPartners((prev) => prev.map((p) => (p.id === updatedPartner.id ? updatedPartner : p)));
      }
      void loadSalesReport();
      void loadSmsDashboard();
    } finally {
      setReleasingCreditOrderId(null);
    }
  };

  const loadSearchLogs = async () => {
    setLoadingSearchLogs(true);
    try {
      const res = await fetch('/api/admin/search-logs', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { logs?: SearchLogEntry[] };
      if (Array.isArray(data.logs)) {
        setSearchLogs(data.logs);
      }
    } finally {
      setLoadingSearchLogs(false);
    }
  };

  const handleDismissSearchLog = async (normalizedTerm: string) => {
    const res = await fetch(`/api/admin/search-logs/${encodeURIComponent(normalizedTerm)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      setSearchLogs((prev) => prev.filter((item) => item.normalizedTerm !== normalizedTerm));
    }
  };

  const handleClearSearchLogs = async () => {
    const res = await fetch('/api/admin/search-logs', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      setSearchLogs([]);
      setConfirmClearLogs(false);
    }
  };

  const handleStockFromSearchTerm = (term: string) => {
    const titleCased = term
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    setName(titleCased);
    setFormError(null);
    setFormSuccess(null);
    setActiveTab('inventory');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadSalesReport = async (overrides?: {
    period?: SalesReportPeriod;
    weekEnd?: string;
    month?: string;
    year?: string;
    confirmedOnly?: boolean;
  }) => {
    const targetPeriod = overrides?.period ?? reportPeriod;
    const targetWeekEnd = overrides?.weekEnd !== undefined ? overrides.weekEnd : reportWeekEnd;
    const targetMonth = overrides?.month !== undefined ? overrides.month : reportMonth;
    const targetYear = overrides?.year !== undefined ? overrides.year : reportYear;
    const targetConfirmedOnly =
      overrides?.confirmedOnly !== undefined ? overrides.confirmedOnly : confirmedOnly;

    setLoadingWeeklySales(true);
    setWeeklySalesError(null);
    try {
      const params = new URLSearchParams();
      params.set('period', targetPeriod);
      if (targetPeriod === 'weekly' && targetWeekEnd) params.set('weekEnd', targetWeekEnd);
      if (targetPeriod === 'monthly' && targetMonth) params.set('month', targetMonth);
      if (targetPeriod === 'yearly' && targetYear) params.set('year', targetYear);
      if (targetConfirmedOnly) params.set('confirmedOnly', 'true');

      const res = await fetch(`/api/admin/sales-report?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        setWeeklySalesError('Could not load compiled sales report.');
        return;
      }
      const data = (await res.json()) as CompiledSalesReport;
      setSalesReport(data);
    } catch {
      setWeeklySalesError('Network error while loading compiled sales report.');
    } finally {
      setLoadingWeeklySales(false);
    }
  };

  const handleExportSalesReportCsv = () => {
    if (!salesReport) return;
    const periodTitle =
      salesReport.period === 'yearly'
        ? 'Yearly Sales Report'
        : salesReport.period === 'monthly'
          ? 'Monthly Sales Report'
          : 'Weekly Sales Report';
    const breakdownHeading =
      salesReport.period === 'yearly'
        ? 'Month'
        : salesReport.period === 'monthly'
          ? 'Week'
          : 'Day';
    const rows = [
      [`My Spare Zone - ${periodTitle}`],
      ['Period', `${salesReport.periodLabel} (${salesReport.periodStart} to ${salesReport.periodEnd})`],
      ['Filter', confirmedOnly ? 'Confirmed Sales Only' : 'All Sales'],
      ['Total Revenue (KSh)', String(salesReport.summary.totalRevenue)],
      ['Total Orders', String(salesReport.summary.totalOrders)],
      ['Confirmed Orders', String(salesReport.summary.confirmedOrders)],
      ['Units Sold', String(salesReport.summary.totalUnitsSold)],
      ['Average Order Value (KSh)', String(salesReport.summary.averageOrderValue)],
      [],
      [breakdownHeading, 'Range / Key', 'Orders', 'Confirmed Orders', 'Units Sold', 'Revenue (KSh)'],
      ...salesReport.breakdown.map((b) => [
        `"${b.label.replace(/"/g, '""')}"`,
        `"${b.subLabel.replace(/"/g, '""')}"`,
        String(b.ordersCount),
        String(b.confirmedOrdersCount),
        String(b.unitsSold),
        String(b.revenue),
      ]),
      [],
      ['Sales & Confirmed Orders Reference', 'Sale Date', 'Receipt No.', 'Customer', 'Phone', 'Items Sold', 'Status', 'Confirmed', 'Amount (KSh)'],
      ...salesReport.sales.map((s) => [
        s.saleDate,
        s.issuedAt,
        s.receiptNumber,
        `"${s.customerName.replace(/"/g, '""')}"`,
        s.customerPhone,
        `"${s.itemsSummary.replace(/"/g, '""')}"`,
        s.status,
        s.saleConfirmed ? 'Yes' : 'Pending',
        String(s.total),
      ]),
      [],
      ['Top Selling Parts', 'SKU', 'Category', 'Units Sold', 'Revenue (KSh)'],
      ...salesReport.topSellingParts.map((p) => [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        `"${p.category.replace(/"/g, '""')}"`,
        String(p.unitsSold),
        String(p.revenue),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-spare-zone-${salesReport.period}-sales-${salesReport.periodEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      const res = await fetch('/api/reviews');
      if (!res.ok) return;
      const data = (await res.json()) as { reviews?: CustomerReview[] };
      if (Array.isArray(data.reviews)) {
        setReviews(data.reviews);
      }
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    setDeletingReviewId(reviewId);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        await onReviewsChanged?.();
      }
    } finally {
      setDeletingReviewId(null);
    }
  };

  const loadPartners = async () => {
    setLoadingPartners(true);
    try {
      const res = await fetch('/api/admin/partners', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { partners?: GaragePartnerProfile[] };
      if (Array.isArray(data.partners)) {
        setPartners(data.partners);
      }
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleUpdatePartner = async (
    partnerId: string,
    updates: {
      status?: GaragePartnerStatus;
      rejectionReason?: string;
      discountTierPercent?: number;
    },
  ) => {
    setUpdatingPartnerId(partnerId);
    setPartnerActionNotice(null);
    try {
      const res = await fetch(`/api/admin/partners/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        partner?: GaragePartnerProfile;
        smsNotification?: SmsNotificationRecord;
      };
      if (data.partner) {
        const updatedPartner = data.partner;
        setPartners((prev) =>
          prev.map((p) => (p.id === partnerId ? updatedPartner : p)),
        );
        if (previewingProofPartner?.id === partnerId) {
          setPreviewingProofPartner(updatedPartner);
        }
        if (data.smsNotification) {
          setPartnerActionNotice(
            `${updatedPartner.businessName} approved! Approval SMS sent from ${data.smsNotification.senderPhone || adminSenderPhone} to ${updatedPartner.phone}.`,
          );
          void loadSmsDashboard();
        } else if (updates.status === 'rejected') {
          setPartnerActionNotice(
            `Application for ${updatedPartner.businessName} marked as rejected.`,
          );
        }
      }
    } finally {
      setUpdatingPartnerId(null);
    }
  };

  const loadSmsDashboard = async () => {
    setLoadingSms(true);
    try {
      const res = await fetch('/api/admin/sms', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        autoOrderSmsEnabled?: boolean;
        adminSenderPhone?: string;
        logs?: SmsNotificationRecord[];
      };
      if (typeof data.autoOrderSmsEnabled === 'boolean') {
        setAutoOrderSmsEnabled(data.autoOrderSmsEnabled);
      }
      if (data.adminSenderPhone) {
        setAdminSenderPhone(data.adminSenderPhone);
        setAdminSenderPhoneDraft(data.adminSenderPhone);
      }
      if (Array.isArray(data.logs)) setSmsLogs(data.logs);
    } finally {
      setLoadingSms(false);
    }
  };

  const handleSaveSmsSettings = async (updates: {
    autoOrderSmsEnabled?: boolean;
    adminSenderPhone?: string;
  }) => {
    setSmsError(null);
    setSmsSettingsNotice(null);
    setSavingSmsSettings(true);
    try {
      const res = await fetch('/api/admin/sms/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updates),
      });
      const data = (await res.json()) as {
        autoOrderSmsEnabled?: boolean;
        adminSenderPhone?: string;
        error?: string;
      };
      if (!res.ok) {
        setSmsError(data.error || 'Could not update automated SMS settings.');
        return;
      }
      if (typeof data.autoOrderSmsEnabled === 'boolean') {
        setAutoOrderSmsEnabled(data.autoOrderSmsEnabled);
      }
      if (data.adminSenderPhone) {
        setAdminSenderPhone(data.adminSenderPhone);
        setAdminSenderPhoneDraft(data.adminSenderPhone);
      }
      setSmsSettingsNotice(
        `Automated SMS settings updated (Sender: ${data.adminSenderPhone || adminSenderPhone} · ${data.autoOrderSmsEnabled !== false ? 'Active' : 'Paused'}).`,
      );
    } catch {
      setSmsError('Network error while saving automated SMS settings.');
    } finally {
      setSavingSmsSettings(false);
    }
  };

  const handleDeleteSmsLog = async (id: string) => {
    const res = await fetch(`/api/admin/sms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      setSmsLogs((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleClearSmsLogs = async () => {
    const res = await fetch('/api/admin/sms', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      setSmsLogs([]);
      setConfirmClearSmsLogs(false);
    }
  };

  const buildManualOrderSmsTemplate = (
    status: 'Pending' | 'Shipped' | 'Delivered' | 'In Bay' | 'Completed' | 'Custom',
    receiptRef?: string,
    mode: 'manual' | 'test' = 'manual',
    orderTotal?: number,
  ): string => {
    const cleanRef = receiptRef?.trim() || (mode === 'test' ? 'MSZ-TEST-001' : 'your order');
    const totalSuffix =
      typeof orderTotal === 'number' && orderTotal > 0
        ? ` Total ${formatCurrency(orderTotal)}.`
        : mode === 'test'
          ? ' Total KSh 4,500.'
          : '';
    if (status === 'Shipped') {
      return `My Spare Zone: Order ${cleanRef} has been SHIPPED.${totalSuffix} Care: ${adminSenderPhone}.`;
    }
    if (status === 'Delivered') {
      return `My Spare Zone: Order ${cleanRef} has been DELIVERED. Thank you for trusting My Spare Zone (Seventies Plaza, Kirinyaga Rd). Care: ${adminSenderPhone}.`;
    }
    if (status === 'In Bay') {
      return `My Spare Zone: Vehicle for ${cleanRef} is now IN THE GARAGE BAY at Seventies Plaza, Kirinyaga Rd. Fitting is underway. Care: ${adminSenderPhone}.`;
    }
    if (status === 'Completed') {
      return `My Spare Zone: Part fitting & testing for ${cleanRef} is COMPLETED! Ready for pickup at Seventies Plaza, Kirinyaga Rd. Care: ${adminSenderPhone}.`;
    }
    if (status === 'Custom') {
      return `My Spare Zone: Update regarding ${cleanRef}. Please reach us on ${adminSenderPhone} for assistance.`;
    }
    return `My Spare Zone: Order ${cleanRef} status is Pending.${totalSuffix} Care: ${adminSenderPhone}.`;
  };

  const logManualSmsDispatch = async (payload: {
    phone: string;
    recipientName?: string;
    recipientRole: 'Customer' | 'Mechanic' | 'Garage';
    statusLabel: string;
    receiptNumber?: string;
    message: string;
    deliveryChannel: 'admin_direct' | 'phone_sms_app';
  }): Promise<{ entry?: SmsNotificationRecord; error?: string }> => {
    try {
      const res = await fetch('/api/admin/sms/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        entry?: SmsNotificationRecord;
        error?: string;
      };
      if (!res.ok || !data.entry) {
        return { error: data.error || 'Could not record manual SMS status.' };
      }
      setSmsLogs((prev) => [data.entry!, ...prev]);
      return { entry: data.entry };
    } catch {
      return { error: 'Network error while logging manual SMS status.' };
    }
  };

  const handleSendTestOrderSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestSmsError(null);
    setTestSmsResult(null);

    if (!testSmsPhone.trim()) {
      setTestSmsError('Enter a destination phone number (e.g. 0712345678 or +254712345678).');
      return;
    }

    const activeMessage =
      testSmsCustomMessage.trim() ||
      buildManualOrderSmsTemplate(testSmsStatus, testSmsReceiptRef, smsComposerMode);

    setSendingTestSms(true);
    try {
      if (smsComposerMode === 'test') {
        const normalizedTestStatus: OrderStatus =
          testSmsStatus === 'Pending' || testSmsStatus === 'Delivered'
            ? testSmsStatus
            : 'Shipped';
        const res = await fetch('/api/admin/sms/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            phone: testSmsPhone.trim(),
            recipientName: testSmsRecipientName.trim(),
            recipientRole: testSmsRecipientRole,
            status: normalizedTestStatus,
            receiptNumber: testSmsReceiptRef.trim() || undefined,
            customMessage: testSmsCustomMessage.trim() || undefined,
          }),
        });
        const data = (await res.json()) as {
          entry?: SmsNotificationRecord;
          error?: string;
        };
        if (!res.ok || !data.entry) {
          setTestSmsError(data.error || 'Could not send test order status SMS.');
          return;
        }

        setSmsLogs((prev) => [data.entry!, ...prev]);
        const targetPhone = data.entry.recipients[0]?.phone || testSmsPhone.trim();
        setTestSmsResult({
          entry: data.entry,
          phone: targetPhone,
          message: data.entry.message,
        });
      } else {
        const result = await logManualSmsDispatch({
          phone: testSmsPhone.trim(),
          recipientName: testSmsRecipientName.trim(),
          recipientRole: testSmsRecipientRole,
          statusLabel: testSmsStatus,
          receiptNumber: testSmsReceiptRef.trim() || undefined,
          message: activeMessage,
          deliveryChannel: 'admin_direct',
        });
        if (!result.entry) {
          setTestSmsError(result.error || 'Could not send manual SMS status.');
          return;
        }
        const targetPhone = result.entry.recipients[0]?.phone || testSmsPhone.trim();
        setTestSmsResult({
          entry: result.entry,
          phone: targetPhone,
          message: result.entry.message,
        });
      }
    } catch {
      setTestSmsError('Network error while sending SMS status.');
    } finally {
      setSendingTestSms(false);
    }
  };

  const handleOpenPhoneSmsAndLog = async (params: {
    phone: string;
    recipientName?: string;
    recipientRole: 'Customer' | 'Mechanic' | 'Garage';
    statusLabel: string;
    receiptNumber?: string;
    message: string;
  }) => {
    setTestSmsError(null);
    if (!params.phone.trim()) {
      setTestSmsError('Enter a destination phone number before launching Phone SMS App.');
      return;
    }
    const result = await logManualSmsDispatch({
      ...params,
      deliveryChannel: 'phone_sms_app',
    });
    if (!result.entry) {
      setTestSmsError(result.error || 'Could not log Phone SMS App dispatch.');
      return;
    }
    const targetPhone = result.entry.recipients[0]?.phone || params.phone.trim();
    setTestSmsResult({
      entry: result.entry,
      phone: targetPhone,
      message: result.entry.message,
    });
  };

  const handleExportSmsLogCsv = (logsToExport: SmsNotificationRecord[]) => {
    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const headers = [
      'Timestamp',
      'Recipient Number',
      'Recipient Name',
      'Status / Type',
      'Receipt Ref',
      'Channel',
      'Sender (Admin)',
      'Message Content',
      'Triggered By',
    ];
    const rows = logsToExport.map((log) => {
      const recipientNumbers = log.recipients.map((r) => r.phone).join('; ');
      const recipientNames = log.recipients.map((r) => r.name || '').filter(Boolean).join('; ');
      const channelLabel =
        log.deliveryChannel === 'phone_sms_app'
          ? 'Phone SMS App'
          : log.createdBy.includes('Connectivity Test')
            ? 'Connectivity Test'
            : log.isManual
              ? 'Manual Admin SMS'
              : 'Automated Order SMS';
      return [
        new Date(log.createdAt).toISOString(),
        recipientNumbers,
        recipientNames || log.audienceLabel,
        log.orderStatusLabel || log.type,
        log.receiptNumber || '',
        channelLabel,
        log.senderPhone || adminSenderPhone,
        log.message,
        log.createdBy,
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-spare-zone-sms-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadPartSourcingLogs = async () => {
    setLoadingPartLogs(true);
    try {
      const res = await fetch('/api/admin/part-sourcing', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { logs?: PartSourcingLog[] };
      if (Array.isArray(data.logs)) {
        setPartSourcingLogs(data.logs);
        setDirtyPartLogIds({});
      }
    } finally {
      setLoadingPartLogs(false);
    }
  };

  const handleAddBlankPartLogRow = async () => {
    setAddingPartLogRow(true);
    setPartLogNotice(null);
    try {
      const res = await fetch('/api/admin/part-sourcing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          partName: '',
          category: '',
          quantity: 1,
          sourceType: 'in_store',
          handledBy: '',
          fittedByOurMechanic: false,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { entry?: PartSourcingLog };
      if (data.entry) {
        setPartSourcingLogs((prev) => [data.entry!, ...prev]);
        setPartLogNotice('New fillable row added at the top of the table.');
      }
    } finally {
      setAddingPartLogRow(false);
    }
  };

  const handleAddPartLogFromCatalogSelection = async (optionKey: string) => {
    const picked = partOptionByKey.get(optionKey);
    if (!picked) return;
    setAddingPartLogRow(true);
    setPartLogNotice(null);
    try {
      const res = await fetch('/api/admin/part-sourcing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          partName: picked.name,
          category: picked.category,
          sku: picked.sku,
          quantity: 1,
          sourceType: 'in_store',
          handledBy: '',
          fittedByOurMechanic: false,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { entry?: PartSourcingLog };
      if (data.entry) {
        setPartSourcingLogs((prev) => [data.entry!, ...prev]);
        setPartLogNotice(
          `Added "${picked.name}"${picked.category ? ` (${picked.category})` : ''} to the sourcing log.`,
        );
      }
    } finally {
      setQuickAddPartSelection('');
      setAddingPartLogRow(false);
    }
  };

  const handleSyncPartLogsFromOrders = async () => {
    setSyncingPartLogs(true);
    setPartLogNotice(null);
    try {
      const res = await fetch('/api/admin/part-sourcing/sync-orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        addedCount?: number;
        logs?: PartSourcingLog[];
      };
      if (Array.isArray(data.logs)) {
        setPartSourcingLogs(data.logs);
        setDirtyPartLogIds({});
      }
      const added = data.addedCount ?? 0;
      setPartLogNotice(
        added > 0
          ? `Synced ${added} spare part ${added === 1 ? 'item' : 'items'} from customer orders into the table.`
          : 'All existing order items are already documented in the table.',
      );
    } finally {
      setSyncingPartLogs(false);
    }
  };

  const updateLocalPartLogField = <K extends keyof PartSourcingLog>(
    id: string,
    field: K,
    value: PartSourcingLog[K],
  ) => {
    setPartSourcingLogs((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
    setDirtyPartLogIds((prev) => ({ ...prev, [id]: true }));
  };

  const persistPartLogRow = async (
    id: string,
    overrideUpdates?: Partial<PartSourcingLog>,
  ) => {
    const current = partSourcingLogs.find((r) => r.id === id);
    if (!current && !overrideUpdates) return;
    const payload = { ...current, ...overrideUpdates };
    setSavingPartLogIds((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/part-sourcing/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          date: payload.date,
          receiptNumber: payload.receiptNumber ?? '',
          partName: payload.partName ?? '',
          category: payload.category ?? '',
          sku: payload.sku ?? '',
          quantity: payload.quantity ?? 1,
          sourceType: payload.sourceType ?? 'in_store',
          sourceShopName: payload.sourceShopName ?? '',
          clientName: payload.clientName ?? '',
          handledBy: payload.handledBy ?? '',
          fittedByOurMechanic: Boolean(payload.fittedByOurMechanic),
          mechanicName: payload.mechanicName ?? '',
          notes: payload.notes ?? '',
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { entry?: PartSourcingLog };
      if (data.entry) {
        setPartSourcingLogs((prev) =>
          prev.map((row) => (row.id === id ? data.entry! : row)),
        );
        setDirtyPartLogIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } finally {
      setSavingPartLogIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDeletePartLogRow = async (id: string) => {
    const res = await fetch(`/api/admin/part-sourcing/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      setPartSourcingLogs((prev) => prev.filter((row) => row.id !== id));
    }
  };

  const handleExportPartLogsCsv = (rowsToExport: PartSourcingLog[]) => {
    const header = [
      'Date',
      'Receipt No.',
      'Spare Part Bought',
      'Category',
      'Qty',
      'Sourced From',
      'Outside Shop Name',
      'Client / Vehicle',
      'Handled By (Client Handler)',
      'Fitted By Our Mechanic',
      'Mechanic Name',
      'Notes',
    ];
    const csvRows = [
      header,
      ...rowsToExport.map((row) => [
        row.date,
        `"${(row.receiptNumber || '').replace(/"/g, '""')}"`,
        `"${(row.partName || '').replace(/"/g, '""')}"`,
        `"${(row.category || '').replace(/"/g, '""')}"`,
        String(row.quantity || 1),
        row.sourceType === 'outside_shop' ? 'Outside Shop' : 'In Store',
        `"${(row.sourceType === 'outside_shop' ? row.sourceShopName || '' : 'My Spare Zone').replace(/"/g, '""')}"`,
        `"${(row.clientName || '').replace(/"/g, '""')}"`,
        `"${(row.handledBy || '').replace(/"/g, '""')}"`,
        row.fittedByOurMechanic ? 'Yes' : 'No',
        `"${(row.fittedByOurMechanic ? row.mechanicName || '' : '').replace(/"/g, '""')}"`,
        `"${(row.notes || '').replace(/"/g, '""')}"`,
      ]),
    ];
    const csv = csvRows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-spare-zone-parts-sourcing-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSourceZip = async () => {
    setDownloadingSource(true);
    try {
      const res = await fetch('/api/admin/export-source', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-spare-zone-source-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingSource(false);
    }
  };

  const handleExportPartLogsPdf = (rowsToExport: PartSourcingLog[]) => {
    if (rowsToExport.length === 0) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedAt = new Date().toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const inStoreTotal = rowsToExport.filter((r) => r.sourceType === 'in_store').length;
    const outsideTotal = rowsToExport.filter((r) => r.sourceType === 'outside_shop').length;
    const fittedTotal = rowsToExport.filter((r) => r.fittedByOurMechanic).length;

    const activeFilterLabels: string[] = [];
    if (partLogSearchQuery.trim()) activeFilterLabels.push(`Search: "${partLogSearchQuery.trim()}"`);
    if (partLogSourceFilter !== 'all') {
      const sourceLabels: Record<typeof partLogSourceFilter, string> = {
        in_store: 'In Store Only',
        outside_shop: 'Outside Shop Only',
        fitted_by_us: 'Fitted by Our Mechanic',
        not_fitted_by_us: 'No Fitment',
      };
      activeFilterLabels.push(`View: ${sourceLabels[partLogSourceFilter]}`);
    }
    if (partLogStaffFilter !== 'all') {
      activeFilterLabels.push(
        `Staff: ${partLogStaffFilter === '__unassigned__' ? 'Unassigned' : partLogStaffFilter}`,
      );
    }
    if (partLogMechanicFilter !== 'all') {
      activeFilterLabels.push(
        `Mechanic: ${partLogMechanicFilter === '__unassigned__' ? 'Unassigned' : partLogMechanicFilter}`,
      );
    }
    if (partLogDateFrom || partLogDateTo) {
      activeFilterLabels.push(
        `Dates: ${partLogDateFrom || 'Start'} to ${partLogDateTo || 'Today'}`,
      );
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('My Spare Zone — Parts Sourcing & Mechanic Fitting Report', 12, 14);

    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.7);
    doc.line(12, 17, pageWidth - 12, 17);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Generated: ${generatedAt}  |  Records: ${rowsToExport.length}  |  In Store: ${inStoreTotal}  |  Outside Shop: ${outsideTotal}  |  Fitted by Our Mechanic: ${fittedTotal}`,
      12,
      22.5,
    );

    const filterLine =
      activeFilterLabels.length > 0
        ? `Filters Applied: ${activeFilterLabels.join('  •  ')}`
        : 'Filters Applied: None (Full Maintenance & Sourcing Log)';
    doc.text(filterLine, 12, 27, { maxWidth: pageWidth - 24 });

    const tableBody = rowsToExport.map((row) => [
      row.receiptNumber ? `${row.date}\n${row.receiptNumber}` : row.date,
      row.category
        ? `${row.partName || '—'}\n[${row.category}]`
        : row.partName || '—',
      row.sku ? `${row.quantity || 1} pcs\n${row.sku}` : `${row.quantity || 1} pcs`,
      row.clientName || '—',
      row.sourceType === 'outside_shop'
        ? `Outside Shop:\n${row.sourceShopName || 'Unspecified shop'}`
        : 'In Store\n(My Spare Zone)',
      row.handledBy || 'Unassigned',
      row.fittedByOurMechanic
        ? `Yes — ${row.mechanicName || 'Mechanic unassigned'}`
        : 'No fitment',
      row.notes || '—',
    ]);

    autoTable(doc, {
      startY: 31,
      margin: { left: 12, right: 12, bottom: 14 },
      head: [
        [
          'Date & Ref',
          'Spare Part & Category',
          'Qty / SKU',
          'Client / Vehicle',
          'Sourced From',
          'Handled By',
          'Our Mechanic Fitting',
          'Notes',
        ],
      ],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [15, 23, 42],
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 44 },
        2: { cellWidth: 22 },
        3: { cellWidth: 36 },
        4: { cellWidth: 38 },
        5: { cellWidth: 28 },
        6: { cellWidth: 39 },
        7: { cellWidth: 40 },
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          'My Spare Zone · Seventies Plaza, Kirinyaga Rd · Tel: +254706130014',
          12,
          pageHeight - 6,
        );
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 12,
          pageHeight - 6,
          { align: 'right' },
        );
      },
    });

    doc.save(`my-spare-zone-parts-sourcing-log-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const formatDeliveryRegionLabel = (region?: DeliveryRegion): string => {
    if (region === 'outside_nairobi') return 'Outside Nairobi (Courier Dispatch)';
    if (region === 'pickup') return 'Store Counter Pickup (Seventies Plaza, Kirinyaga Rd)';
    if (region === 'garage_fitting') {
      return 'In-Garage Fitting Appointment (Seventies Plaza, Kirinyaga Rd)';
    }
    return 'Delivery within Nairobi & Surrounds';
  };

  const handleDownloadPackingSlipPdf = (order: VirtualReceipt) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const orderStatus = normalizeOrderStatus(order.status);
    const issuedFormatted = new Date(order.issuedAt).toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('MY SPARE ZONE — PACKING SLIP', 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Seventies Plaza, Kirinyaga Rd, Nairobi  ·  Customer Care: +254 706 130 014', 14, 21.5);

    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.7);
    doc.line(14, 24.5, pageWidth - 14, 24.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('ORDER SUMMARY', 14, 31);
    doc.text('SHIPPING & FULFILLMENT DETAILS', pageWidth / 2 + 4, 31);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(51, 65, 85);
    const leftLines = [
      `Receipt No.: ${order.receiptNumber}`,
      `Order ID: ${order.id}`,
      `Issued: ${issuedFormatted}`,
      `Order Status: ${orderStatus}`,
      `Payment: ${order.paymentMethod}`,
      `Pay Status: ${order.paymentStatus || (order.saleConfirmed ? 'Confirmed' : 'Pending')}`,
    ];
    doc.text(leftLines, 14, 36.5, { lineHeightFactor: 1.45 });

    const rightLines = [
      `Customer: ${order.customerName}`,
      `Phone: ${order.customerPhone}`,
      ...(order.customerEmail ? [`Email: ${order.customerEmail}`] : []),
      `Method: ${formatDeliveryRegionLabel(order.deliveryRegion)}`,
      `Ship To: ${order.deliveryAddress}`,
      ...(order.deliveryRegion === 'nairobi' && order.deliveryFee
        ? [
            `Delivery Fee: ${formatCurrency(order.deliveryFee)}${typeof order.deliveryDistanceKm === 'number' ? ` (~${order.deliveryDistanceKm.toFixed(1)} km · KSh 500/10km)` : ''}`,
          ]
        : []),
      ...(order.pickupCode
        ? [
            `Pickup Code: ${order.pickupCode} (${order.pickupStatus === 'claimed' ? 'Claimed' : order.pickupStatus === 'expired_restocked' ? 'Expired & Restocked' : `Reserved ${PICKUP_RESERVATION_HOURS}h`})`,
          ]
        : []),
      ...(order.courierName ? [`Courier: ${order.courierName}`] : []),
      ...(order.fittingDate
        ? [
            `Garage Slot: ${formatFittingDateLabel(order.fittingDate)} · ${order.fittingSlotLabel || getGarageSlotLabel(order.fittingTimeSlot)} (${order.fittingStatus || 'Scheduled'})`,
          ]
        : []),
      ...(order.vehicleDetails ? [`Vehicle: ${order.vehicleDetails}`] : []),
    ];
    doc.text(rightLines, pageWidth / 2 + 4, 36.5, {
      maxWidth: pageWidth / 2 - 18,
      lineHeightFactor: 1.45,
    });

    const startY = Math.max(36.5 + leftLines.length * 4.6, 36.5 + rightLines.length * 4.6) + 6;

    autoTable(doc, {
      startY,
      margin: { left: 14, right: 14, bottom: 26 },
      head: [['Pack', '#', 'Spare Part & Category', 'SKU', 'Qty', 'Unit Price', 'Line Total']],
      body: order.items.map((item, idx) => [
        '[  ]',
        String(idx + 1),
        `${item.name}\n${item.category}${item.subcategory ? ` / ${item.subcategory}` : ''}`,
        item.sku,
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.lineTotal),
      ]),
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 9, halign: 'center' },
        3: { cellWidth: 28 },
        4: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' },
      },
    });

    const finalY =
      (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
      startY + 40;
    const summaryY = Math.min(doc.internal.pageSize.getHeight() - 32, finalY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Items: ${order.items.length} line(s)  ·  Total Units to Pack: ${totalUnits}`, 14, summaryY);
    doc.text(`Order Total: ${formatCurrency(order.total)}`, pageWidth - 14, summaryY, {
      align: 'right',
    });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, summaryY + 6, pageWidth - 14, summaryY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Packed By: ________________________    Verified By: ________________________    Date: ____________',
      14,
      summaryY + 14,
    );

    doc.save(`my-spare-zone-packing-slip-${order.receiptNumber}.pdf`);
  };

  const handlePrintPackingSlip = () => {
    window.print();
  };

  const loadAdminBargains = async () => {
    setLoadingBargains(true);
    setBargainError(null);
    try {
      const res = await fetch('/api/admin/bargains', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        bargains?: BargainOffer[];
        settings?: BargainSettings;
      };
      if (Array.isArray(data.bargains)) {
        setBargains(data.bargains);
      }
      if (data.settings) {
        setBargainSettings(data.settings);
        setAutoAcceptDraftPct(String(data.settings.autoAcceptMaxDiscountPct ?? 0));
      }
    } catch {
      setBargainError('Unable to load customer bargain offers.');
    } finally {
      setLoadingBargains(false);
    }
  };

  const handleSaveAutoAcceptThreshold = async (nextPctOverride?: number) => {
    const rawPct =
      nextPctOverride !== undefined ? nextPctOverride : Number(autoAcceptDraftPct);
    const clampedPct = Math.min(
      BARGAIN_MAX_DISCOUNT_PCT,
      Math.max(0, Math.round(Number.isFinite(rawPct) ? rawPct : 0)),
    );
    setSavingBargainSettings(true);
    setBargainNotice(null);
    setBargainError(null);
    try {
      const res = await fetch('/api/admin/bargains/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ autoAcceptMaxDiscountPct: clampedPct }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        settings?: BargainSettings;
        error?: string;
      };
      if (!res.ok) {
        setBargainError(data.error || 'Could not update bargain auto-accept limit.');
        return;
      }
      if (data.settings) {
        setBargainSettings(data.settings);
        setAutoAcceptDraftPct(String(data.settings.autoAcceptMaxDiscountPct));
        setBargainNotice(
          data.settings.autoAcceptMaxDiscountPct === 0
            ? 'Auto-accept disabled. All new customer bargains will wait for manual review.'
            : `Auto-accept updated: offers within ${data.settings.autoAcceptMaxDiscountPct}% off listed price will be accepted automatically.`,
        );
      }
    } catch {
      setBargainError('Network error while saving auto-accept limit.');
    } finally {
      setSavingBargainSettings(false);
    }
  };

  const handleAdminBargainAction = async (
    bargain: BargainOffer,
    action: 'accept' | 'counter' | 'reject',
    customTotal?: number,
  ) => {
    setUpdatingBargainId(bargain.id);
    setBargainNotice(null);
    setBargainError(null);

    let counterTotalPayload: number | undefined;
    if (action === 'counter') {
      const parsed = Math.round(Number(customTotal ?? counterPriceDraft));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > bargain.listedSubtotal) {
        setBargainError(
          `Counter-offer must be between KSh 1 and ${formatCurrency(bargain.listedSubtotal)}.`,
        );
        setUpdatingBargainId(null);
        return;
      }
      counterTotalPayload = parsed;
    } else if (action === 'accept' && customTotal !== undefined) {
      counterTotalPayload = customTotal;
    }

    const adminNote = (bargainAdminNoteDraft[bargain.id] || '').trim();

    try {
      const res = await fetch(`/api/admin/bargains/${bargain.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          action,
          ...(counterTotalPayload !== undefined ? { counterTotal: counterTotalPayload } : {}),
          ...(adminNote ? { adminNote } : {}),
          sendSms: bargainSendSms,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        bargain?: BargainOffer;
        error?: string;
      };
      if (!res.ok || !data.bargain) {
        setBargainError(data.error || 'Could not update bargain offer.');
        return;
      }

      const updated = data.bargain;
      setBargains((prev) =>
        [updated, ...prev.filter((item) => item.id !== updated.id)].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
      setCounteringBargainId((curr) => (curr === bargain.id ? null : curr));
      if (action === 'counter') {
        setCounterPriceDraft('');
      }
      setBargainAdminNoteDraft((prev) => {
        const next = { ...prev };
        delete next[bargain.id];
        return next;
      });
      setBargainNotice(
        action === 'accept'
          ? `Deal ${updated.bargainCode} accepted at ${formatCurrency(updated.agreedTotal ?? updated.offeredTotal)}.`
          : action === 'counter'
            ? `Counter-offer of ${formatCurrency(updated.counterTotal ?? 0)} sent for ${updated.bargainCode}.`
            : `Bargain ${updated.bargainCode} declined.`,
      );
      if (bargainSendSms) {
        void loadSmsDashboard();
      }
    } catch {
      setBargainError('Network error while updating bargain offer.');
    } finally {
      setUpdatingBargainId(null);
    }
  };

  useEffect(() => {
    void loadOrders();
    void loadPartSourcingLogs();
    void loadSearchLogs();
    void loadSalesReport();
    void loadThreads();
    void loadReviews();
    void loadPartners();
    void loadAdminBargains();
    void loadSmsDashboard();
  }, [authToken]);

  useEffect(() => {
    if (activeTab === 'inbox') {
      void loadThreads();
      if (selectedSessionId) {
        onMarkSessionRead?.(selectedSessionId);
      }
      return undefined;
    }
    if (activeTab === 'receipts') {
      void loadOrders();
    }
    if (activeTab === 'partLogs') {
      void loadPartSourcingLogs();
      void loadOrders();
    }
    if (activeTab === 'searchLogs') {
      void loadSearchLogs();
    }
    if (activeTab === 'salesDashboard') {
      void loadOrders();
    }
    if (activeTab === 'weeklySales') {
      void loadSalesReport();
    }
    if (activeTab === 'reviews') {
      void loadReviews();
    }
    if (activeTab === 'partners') {
      void loadPartners();
    }
    if (activeTab === 'bargains') {
      void loadAdminBargains();
    }
    if (activeTab === 'orderSms') {
      void loadSmsDashboard();
    }
    return undefined;
  }, [activeTab, selectedSessionId, reportPeriod, reportWeekEnd, reportMonth, reportYear, confirmedOnly]);

  useEffect(() => {
    if (activeTab === 'inbox' && selectedSessionId) {
      onMarkSessionRead?.(selectedSessionId);
      void loadThreadMessages(selectedSessionId);
    }
  }, [activeTab, selectedSessionId]);

  useEffect(() => {
    if (!latestChatMessage) return;
    void loadThreads();
    if (selectedSessionId === latestChatMessage.sessionId) {
      setThreadMessages((prev) =>
        prev.some((m) => m.id === latestChatMessage.id)
          ? prev
          : [...prev, latestChatMessage],
      );
      if (activeTab === 'inbox') {
        onMarkSessionRead?.(latestChatMessage.sessionId);
      }
    }
  }, [latestChatMessage]);

  useEffect(() => {
    if (!latestBargainEvent) return;
    setBargains((prev) =>
      [latestBargainEvent, ...prev.filter((item) => item.id !== latestBargainEvent.id)].sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
  }, [latestBargainEvent]);

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !replyDraft.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          customerName: 'My Spare Zone Support',
          sender: 'support',
          text: replyDraft.trim(),
        }),
      });
      if (res.ok) {
        setReplyDraft('');
        await loadThreadMessages(selectedSessionId);
        await loadThreads();
      }
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header & Workspace Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Admin Console
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage spare part inventory, review weekly sales reports, track top-searched parts, and view full receipt history.
            </p>
          </div>
          {onLogout && (
            <button
              type="button"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await onLogout();
                } finally {
                  setLoggingOut(false);
                }
              }}
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-60 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'Logging out...' : 'Log Out'}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'inventory'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventory ({parts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('salesDashboard')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'salesDashboard'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Sales Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('weeklySales')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'weeklySales'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Sales Reports</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'receipts'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Receipts ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('partLogs')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'partLogs'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Part Log ({partSourcingLogs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'reviews'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Reviews ({reviews.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'partners'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Partners ({partners.length})</span>
            {partners.some((p) => p.status === 'pending') && (
              <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                {partners.filter((p) => p.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bargains')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'bargains'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Handshake className="w-4 h-4" />
            <span>Bargains ({bargains.length})</span>
            {bargains.some((b) => b.status === 'pending') && (
              <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                {bargains.filter((b) => b.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orderSms')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'orderSms'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>
              Order SMS &amp; Log ({smsLogs.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('searchLogs')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'searchLogs'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Most Searched</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'inbox'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chats ({threads.length})</span>
            {totalUnreadChats > 0 && (
              <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                {totalUnreadChats}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={downloadingSource}
            onClick={() => void handleDownloadSourceZip()}
            title="Download full source code (.zip) including Android AAB build workflow"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingSource ? 'Packaging...' : 'Source Code (.zip)'}</span>
          </button>

          {onLogout && (
            <button
              type="button"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await onLogout();
                } finally {
                  setLoggingOut(false);
                }
              }}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'Logging out...' : 'Log Out'}</span>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* TAB 1: INVENTORY MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Post New Item Form */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Post New Spare Part
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Upload a picture, short description, price, and category. Items appear in the storefront immediately.
            </p>

            <form onSubmit={handleCreatePart} className="mt-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onBackToStorefront}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-900 hover:underline"
                  >
                    <span>View in Storefront</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 3-Picture Upload (Slot 1 = Cover Photo) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Item Pictures ({createImages.length}/3 · 1st is Cover Photo)
                  </label>
                  {createImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearSelectedImage()}
                      className="text-[11px] font-medium text-slate-500 hover:text-red-600"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {createImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {createImages.map((imgSrc, idx) => (
                      <div
                        key={`create-img-${idx}`}
                        className="relative rounded-lg overflow-hidden border border-slate-200 bg-white group"
                      >
                        <div className="aspect-4/3 bg-slate-100">
                          <img
                            src={imgSrc}
                            alt={`Item photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="px-1.5 py-1 flex items-center justify-between gap-1 bg-slate-50 border-t border-slate-200 text-[10px]">
                          {idx === 0 ? (
                            <span className="font-bold text-orange-700">Cover</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCreateCoverIndex(idx)}
                              className="font-semibold text-slate-700 hover:text-orange-700 underline"
                            >
                              Make Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => clearSelectedImage(idx)}
                            className="text-slate-400 hover:text-red-600 font-semibold"
                            aria-label={`Remove picture ${idx + 1}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {createImages.length < 3 && (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleDropFile}
                    className={`flex flex-col items-center justify-center border border-dashed rounded-lg p-3.5 cursor-pointer transition-colors ${
                      isDraggingFile
                        ? 'border-orange-600 bg-orange-50/60'
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
                    }`}
                  >
                    <Upload className="w-5 h-5 text-slate-400 mb-1.5" />
                    <span className="text-xs font-medium text-slate-700 text-center">
                      {createImages.length === 0
                        ? 'Upload Cover Photo & up to 2 extra photos (PNG, JPG, WEBP)'
                        : `Add picture ${createImages.length + 1} of 3`}
                    </span>
                    <input
                      ref={createFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                )}

                {createImages.length < 3 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Or paste image URL and click Add"
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                    <button
                      type="button"
                      disabled={!imageUrlInput.trim()}
                      onClick={handleAddCreateImageUrl}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg border border-slate-200 transition-colors whitespace-nowrap"
                    >
                      Add URL
                    </button>
                  </div>
                )}
              </div>

              {/* Item Name */}
              <div>
                <label htmlFor="part-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Name
                </label>
                <input
                  id="part-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rear LED Tail Light Assembly"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              {/* 1. Car Type FIRST, Car Model & Year of Make, then 2. Part Category & Part Type */}
              <div>
                <label htmlFor="part-brand" className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Car Type / Brand
                </label>
                <select
                  id="part-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value as CarBrand)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                >
                  {PART_BRAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b === 'Universal' ? 'Universal / Multi-Brand' : b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="part-car-model" className="block text-xs font-semibold text-slate-700 mb-1">
                    Car Model (Optional)
                  </label>
                  <input
                    id="part-car-model"
                    type="text"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    placeholder="e.g. Fielder, Premio, Note E12"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="part-year-of-make" className="block text-xs font-semibold text-slate-700 mb-1">
                    Year of Make (Optional)
                  </label>
                  <input
                    id="part-year-of-make"
                    type="text"
                    value={yearOfMake}
                    onChange={(e) => setYearOfMake(e.target.value)}
                    placeholder="e.g. 2015 or 2012-2018"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="part-category" className="block text-xs font-semibold text-slate-700 mb-1">
                    2. Part Category
                  </label>
                  <select
                    id="part-category"
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as PrimaryCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  >
                    {PRIMARY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="part-subcategory" className="block text-xs font-semibold text-slate-700 mb-1">
                    3. Part Type (Subcategory)
                  </label>
                  <select
                    id="part-subcategory"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  >
                    {CATEGORY_SUBCATEGORIES[category].map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {category === 'Body parts' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Body Part Condition Grade
                    </span>
                    {conditionGrade && (
                      <button
                        type="button"
                        onClick={() => setConditionGrade('')}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                      >
                        Clear grade
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BODY_PART_CONDITION_GRADES.map((item) => {
                      const active = conditionGrade === item.grade;
                      return (
                        <button
                          key={item.grade}
                          type="button"
                          onClick={() =>
                            setConditionGrade((curr) => (curr === item.grade ? '' : item.grade))
                          }
                          aria-pressed={active}
                          className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                            active
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          <span className="block text-xs font-bold">{item.title}</span>
                          <span
                            className={`block text-[10px] leading-tight mt-0.5 ${
                              active ? 'text-orange-100' : 'text-slate-500'
                            }`}
                          >
                            {item.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isCreateGearbox && (
                <div className="bg-orange-50/70 border border-orange-200 rounded-lg p-3 space-y-1.5">
                  <label
                    htmlFor="part-gearbox-oil-type"
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-900"
                  >
                    <Droplets className="w-3.5 h-3.5 text-orange-600" />
                    <span>Recommended Gearbox Oil Type *</span>
                  </label>
                  <input
                    id="part-gearbox-oil-type"
                    type="text"
                    required
                    value={gearboxOilType}
                    onChange={(e) => setGearboxOilType(e.target.value)}
                    placeholder="e.g. CVT FE, CVT TC, ATF WS, or SAE 75W-90"
                    className="w-full px-3 py-2 text-sm bg-white border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Required for all gearboxes. Customers will see this exact oil type so they buy the appropriate gearbox oil.
                  </p>
                </div>
              )}

              {/* Listing Mode + Price, Offer Pricing, Stock, SKU */}
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Tag className="w-3.5 h-3.5 text-orange-600" />
                    <span>Pricing Mode</span>
                  </span>
                  <div
                    className="inline-flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg"
                    role="group"
                    aria-label="Listing pricing mode"
                  >
                    <button
                      type="button"
                      onClick={() => setIsOffer(false)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        !isOffer
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Standard Price
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOffer(true)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        isOffer
                          ? 'bg-orange-600 text-white shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Post in Offers
                    </button>
                  </div>
                </div>

                {isOffer ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="part-previous-price"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Previous Price (KSh)
                        </label>
                        <input
                          id="part-previous-price"
                          type="number"
                          min="2"
                          required
                          value={previousPrice}
                          onChange={(e) => setPreviousPrice(e.target.value)}
                          placeholder="18500"
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="part-price"
                          className="block text-xs font-semibold text-orange-800 mb-1"
                        >
                          Offer Price (KSh)
                        </label>
                        <input
                          id="part-price"
                          type="number"
                          min="1"
                          required
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="14500"
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {(() => {
                      const prevNum = Number(previousPrice);
                      const offerNum = Number(price);
                      if (
                        previousPrice.trim() &&
                        price.trim() &&
                        Number.isFinite(prevNum) &&
                        Number.isFinite(offerNum) &&
                        prevNum > 0 &&
                        offerNum > 0
                      ) {
                        if (prevNum > offerNum) {
                          const saved = Math.round(prevNum - offerNum);
                          const pct = Math.max(1, Math.round((saved / prevNum) * 100));
                          return (
                            <p className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                              Offer preview: <span className="line-through text-slate-500 font-mono">{formatCurrency(Math.round(prevNum))}</span>{' '}
                              → <strong className="font-mono">{formatCurrency(Math.round(offerNum))}</strong> · Save{' '}
                              <strong className="font-mono">{formatCurrency(saved)}</strong> ({pct}% OFF)
                            </p>
                          );
                        }
                        return (
                          <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                            Offer price must be lower than the previous price.
                          </p>
                        );
                      }
                      return (
                        <p className="text-[11px] text-slate-500">
                          Customers will see the previous price crossed out beside the new offer price in Offers and the catalog.
                        </p>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="part-stock" className="block text-xs font-semibold text-slate-700 mb-1">
                          Stock Qty
                        </label>
                        <input
                          id="part-stock"
                          type="number"
                          min="0"
                          value={stock}
                          onChange={(e) => setStock(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label htmlFor="part-sku" className="block text-xs font-semibold text-slate-700 mb-1">
                          SKU (Optional)
                        </label>
                        <input
                          id="part-sku"
                          type="text"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          placeholder="Auto"
                          className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="part-price" className="block text-xs font-semibold text-slate-700 mb-1">
                        Price (KSh)
                      </label>
                      <input
                        id="part-price"
                        type="number"
                        min="1"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="15000"
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label htmlFor="part-stock" className="block text-xs font-semibold text-slate-700 mb-1">
                        Stock Qty
                      </label>
                      <input
                        id="part-stock"
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label htmlFor="part-sku" className="block text-xs font-semibold text-slate-700 mb-1">
                        SKU (Optional)
                      </label>
                      <input
                        id="part-sku"
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="Auto"
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Secret Admin-Only Floor Price */}
                <div className="pt-2.5 border-t border-slate-200/90 space-y-1">
                  <label
                    htmlFor="part-floor-price"
                    className="flex items-center justify-between text-xs font-semibold text-slate-800"
                  >
                    <span>Bargain Floor Price (KSh · Admin Only)</span>
                    <span className="text-[10px] font-medium text-slate-500">Hidden from buyers</span>
                  </label>
                  <input
                    id="part-floor-price"
                    type="number"
                    min="1"
                    value={floorPrice}
                    onChange={(e) => setFloorPrice(e.target.value)}
                    placeholder="Optional minimum acceptable bargain price"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Never shown to customers, mechanics, or garages. Bargains ≥ floor auto-accept; bargains below floor auto-decline.
                  </p>
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label htmlFor="part-description" className="block text-xs font-semibold text-slate-700 mb-1">
                  Short Description
                </label>
                <textarea
                  id="part-description"
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Condition, vehicle model fitment, and key specifications..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {saving
                    ? 'Publishing...'
                    : isOffer
                      ? 'Publish Offer Listing'
                      : 'Publish Spare Part'}
                </span>
              </button>
            </form>
          </section>

          {/* Existing Inventory List */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            {(() => {
              const availableSubcategories =
                inventoryCategoryFilter === 'All'
                  ? Array.from(
                      new Set([
                        ...PRIMARY_CATEGORIES.flatMap((cat) => CATEGORY_SUBCATEGORIES[cat]),
                        ...parts.map((p) => p.subcategory).filter(Boolean),
                      ]),
                    )
                  : Array.from(
                      new Set([
                        ...CATEGORY_SUBCATEGORIES[inventoryCategoryFilter],
                        ...parts
                          .filter((p) => p.category === inventoryCategoryFilter)
                          .map((p) => p.subcategory)
                          .filter(Boolean),
                      ]),
                    );

              const offersCount = parts.filter((p) => getPartOfferDetails(p).hasOffer).length;
              const normalizedInvQuery = inventorySearchQuery.trim().toLowerCase();
              const filteredInventoryParts = parts.filter((part) => {
                if (inventoryOffersOnly && !getPartOfferDetails(part).hasOffer) {
                  return false;
                }
                if (
                  inventoryCategoryFilter !== 'All' &&
                  part.category !== inventoryCategoryFilter
                ) {
                  return false;
                }
                if (
                  inventorySubcategoryFilter !== 'All' &&
                  part.subcategory !== inventorySubcategoryFilter
                ) {
                  return false;
                }
                if (!normalizedInvQuery) return true;
                const hay =
                  `${part.name} ${part.sku} ${part.brand ?? ''} ${part.carModel ?? ''} ${part.yearOfMake ?? ''} ${part.conditionGrade ? `grade ${part.conditionGrade}` : ''} ${part.category} ${part.subcategory} ${part.description}`.toLowerCase();
                return hay.includes(normalizedInvQuery);
              });

              const hasActiveInventoryFilters =
                Boolean(normalizedInvQuery) ||
                inventoryCategoryFilter !== 'All' ||
                inventorySubcategoryFilter !== 'All' ||
                inventoryOffersOnly;

              return (
                <>
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900">
                          Posted Inventory
                        </h2>
                        <p className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                          {hasActiveInventoryFilters
                            ? `Showing ${filteredInventoryParts.length} of ${parts.length} listings`
                            : `${parts.length} active listings${offersCount > 0 ? ` · ${offersCount} on offer` : ''} · Tap an item to one-tap re-list`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setInventoryOffersOnly((prev) => !prev)}
                          aria-pressed={inventoryOffersOnly}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                            inventoryOffersOnly
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:text-orange-700'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>Offers ({offersCount})</span>
                        </button>
                        {hasActiveInventoryFilters && (
                          <button
                            type="button"
                            onClick={() => {
                              setInventorySearchQuery('');
                              setInventoryCategoryFilter('All');
                              setInventorySubcategoryFilter('All');
                              setInventoryOffersOnly(false);
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Reset Filters
                          </button>
                        )}
                        <div
                          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                          role="group"
                          aria-label="Inventory layout view"
                        >
                          <button
                            type="button"
                            onClick={() => setInventoryViewMode('table')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              inventoryViewMode === 'table'
                                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            aria-pressed={inventoryViewMode === 'table'}
                          >
                            <List className="w-3.5 h-3.5" />
                            <span>Table</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInventoryViewMode('cards')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              inventoryViewMode === 'cards'
                                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            aria-pressed={inventoryViewMode === 'cards'}
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Cards</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Real-Time Search, Category & Subcategory Filter Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="relative sm:col-span-5">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={inventorySearchQuery}
                          onChange={(e) => setInventorySearchQuery(e.target.value)}
                          placeholder="Search name, model, year, SKU, brand..."
                          aria-label="Search posted inventory"
                          className="w-full pl-8 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        />
                        {inventorySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setInventorySearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                            aria-label="Clear inventory search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="sm:col-span-4">
                        <select
                          value={inventoryCategoryFilter}
                          onChange={(e) => {
                            const nextCat = e.target.value as 'All' | PrimaryCategory;
                            setInventoryCategoryFilter(nextCat);
                            setInventorySubcategoryFilter('All');
                          }}
                          aria-label="Filter inventory by category"
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        >
                          <option value="All">All Categories ({parts.length})</option>
                          {PRIMARY_CATEGORIES.map((cat) => {
                            const count = parts.filter((p) => p.category === cat).length;
                            return (
                              <option key={cat} value={cat}>
                                {cat} ({count})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <select
                          value={inventorySubcategoryFilter}
                          onChange={(e) => setInventorySubcategoryFilter(e.target.value)}
                          aria-label="Filter inventory by subcategory"
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        >
                          <option value="All">All Subcategories</option>
                          {availableSubcategories.map((sub) => {
                            const count = parts.filter(
                              (p) =>
                                (inventoryCategoryFilter === 'All' ||
                                  p.category === inventoryCategoryFilter) &&
                                p.subcategory === sub,
                            ).length;
                            return (
                              <option key={sub} value={sub}>
                                {sub} ({count})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  {relistNotice && (
                    <div className="mx-5 mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>{relistNotice}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRelistNotice(null)}
                        className="text-emerald-700 hover:text-emerald-950"
                        aria-label="Dismiss re-list notice"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {relistError && (
                    <div className="mx-5 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center justify-between gap-2">
                      <span>{relistError}</span>
                      <button
                        type="button"
                        onClick={() => setRelistError(null)}
                        className="text-red-500 hover:text-red-800"
                        aria-label="Dismiss re-list error"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {filteredInventoryParts.length === 0 ? (
                    <div className="p-10 text-center space-y-3 bg-slate-50/40 flex-1 flex flex-col items-center justify-center">
                      <p className="text-sm font-medium text-slate-700">
                        No spare parts match your selected category, subcategory, or search query.
                      </p>
                      {hasActiveInventoryFilters && (
                        <button
                          type="button"
                          onClick={() => {
                            setInventorySearchQuery('');
                            setInventoryCategoryFilter('All');
                            setInventorySubcategoryFilter('All');
                            setInventoryOffersOnly(false);
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          Clear Inventory Filters
                        </button>
                      )}
                    </div>
                  ) : inventoryViewMode === 'table' ? (
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                            <th className="py-3 px-4">Part & SKU</th>
                            <th className="py-3 px-3 whitespace-nowrap">Category & Subcategory</th>
                            <th className="py-3 px-3 text-right whitespace-nowrap">Price (Tap to Re-list)</th>
                            <th className="py-3 px-3 text-right whitespace-nowrap">Stock</th>
                            <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredInventoryParts.map((part) => {
                            const isRelisting = relistingPartId === part.id;
                            const condInfo =
                              part.category === 'Body parts'
                                ? getBodyPartConditionInfo(part.conditionGrade)
                                : null;
                            const vehicleDetails = [part.carModel, part.yearOfMake]
                              .filter(Boolean)
                              .join(' · ');
                            return (
                              <tr key={part.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4 min-w-[210px]">
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => openQuickRelist(part)}
                                      className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                                      title="Tap to quick re-list with new price"
                                    >
                                      <PartImage
                                        src={part.imageUrl}
                                        alt={part.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => openQuickRelist(part)}
                                        className="text-left font-semibold text-slate-900 hover:text-orange-700 truncate max-w-[210px] block"
                                        title="Tap item to quick edit price & re-list"
                                      >
                                        {part.name}
                                      </button>
                                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                        <span className="font-mono">{part.sku}</span>
                                        {part.brand ? ` · ${part.brand}` : ''}
                                        {vehicleDetails ? ` · ${vehicleDetails}` : ''}
                                        {condInfo ? ` · ${condInfo.shortLabel}` : ''}
                                        {getPartImageGallery(part).length > 1
                                          ? ` · ${getPartImageGallery(part).length} photos`
                                          : ''}
                                        {isGearboxPart(part)
                                          ? ` · Oil: ${part.gearboxOilType || detectGearboxType(part).oilSpecLabel}`
                                          : ''}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                                  <span className="font-medium text-slate-900 block">
                                    {part.brand ? `${part.brand} · ` : ''}
                                    {part.category}
                                  </span>
                                  <span className="text-slate-500">{part.subcategory}</span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                  {isRelisting ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        void handleQuickRelistSubmit(part);
                                      }}
                                      className="inline-flex items-center justify-end gap-1.5"
                                    >
                                      <input
                                        type="number"
                                        min="1"
                                        required
                                        autoFocus
                                        value={relistPriceDraft}
                                        onChange={(e) => setRelistPriceDraft(e.target.value)}
                                        aria-label={`New re-list price for ${part.name}`}
                                        className="w-24 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-orange-500 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600"
                                      />
                                      <button
                                        type="submit"
                                        disabled={relistSaving}
                                        className="px-2 py-1 text-[11px] font-sans font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-md"
                                      >
                                        {relistSaving ? '...' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRelistingPartId(null);
                                          setRelistError(null);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-700"
                                        aria-label="Cancel re-list"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </form>
                                  ) : (
                                    (() => {
                                      const offer = getPartOfferDetails(part);
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => openQuickRelist(part)}
                                          className="text-right space-y-0.5 hover:bg-orange-50 px-1.5 py-0.5 rounded transition-colors"
                                          title="Tap to edit price & re-list"
                                        >
                                          {offer.hasOffer && offer.previousPrice !== null ? (
                                            <>
                                              <span className="font-bold text-orange-700 block">
                                                {formatCurrency(part.price)}
                                              </span>
                                              <span className="text-[11px] text-slate-400 line-through block">
                                                {formatCurrency(offer.previousPrice)}
                                              </span>
                                              <span className="text-[10px] font-sans font-semibold text-emerald-700 block">
                                                Offer -{offer.discountPercent}%
                                              </span>
                                            </>
                                          ) : (
                                            <span className="font-semibold text-slate-900 hover:text-orange-700 block">
                                              {formatCurrency(part.price)}
                                            </span>
                                          )}
                                          {typeof part.floorPrice === 'number' && part.floorPrice > 0 && (
                                            <span className="text-[10px] font-medium text-slate-500 block">
                                              Floor: {formatCurrency(part.floorPrice)}
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })()
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                                  <span
                                    className={
                                      part.stock === 0
                                        ? 'text-red-700 font-semibold'
                                        : part.stock <= 3
                                          ? 'text-amber-700 font-semibold'
                                          : 'text-slate-700'
                                    }
                                  >
                                    {part.stock === 0 ? 'Out (0)' : `${part.stock} pcs`}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openQuickRelist(part)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md transition-colors"
                                      title="One-tap re-list: edit price & bump to top"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      <span>Re-list</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(part)}
                                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                      aria-label={`Edit ${part.name}`}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePart(part)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                      aria-label={`Delete ${part.name}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/40">
                      {filteredInventoryParts.map((part) => {
                        const isRelisting = relistingPartId === part.id;
                        const condInfo =
                          part.category === 'Body parts'
                            ? getBodyPartConditionInfo(part.conditionGrade)
                            : null;
                        const vehicleDetails = [part.carModel, part.yearOfMake]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <article
                            key={part.id}
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                          >
                            <div>
                              <button
                                type="button"
                                onClick={() => openQuickRelist(part)}
                                className="aspect-4/3 w-full block bg-slate-100 border-b border-slate-200 overflow-hidden text-left"
                                title="Tap item to quick edit price & re-list"
                              >
                                <PartImage
                                  src={part.imageUrl}
                                  alt={part.name}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              <div className="p-4 pb-3">
                                <p className="text-[11px] text-slate-500 truncate">
                                  {part.brand ? `${part.brand} · ` : ''}
                                  {vehicleDetails ? `${vehicleDetails} · ` : ''}
                                  {part.category} · {part.subcategory} ·{' '}
                                  <span className="font-mono">{part.sku}</span>
                                  {condInfo ? ` · ${condInfo.shortLabel}` : ''}
                                  {getPartImageGallery(part).length > 1
                                    ? ` · ${getPartImageGallery(part).length} photos`
                                    : ''}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => openQuickRelist(part)}
                                  className="text-left block w-full mt-1"
                                >
                                  <h3 className="text-sm font-semibold text-slate-900 hover:text-orange-700 truncate">
                                    {part.name}
                                  </h3>
                                </button>
                                <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                                  {part.description}
                                </p>
                                {isGearboxPart(part) && (
                                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700">
                                    <Droplets className="w-3 h-3 shrink-0" />
                                    <span className="truncate">
                                      Oil: {part.gearboxOilType || detectGearboxType(part).oilSpecLabel}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-2.5">
                              {isRelisting ? (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleQuickRelistSubmit(part);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="number"
                                    min="1"
                                    required
                                    autoFocus
                                    value={relistPriceDraft}
                                    onChange={(e) => setRelistPriceDraft(e.target.value)}
                                    aria-label={`New re-list price for ${part.name}`}
                                    className="flex-1 min-w-0 px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-orange-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                                  />
                                  <button
                                    type="submit"
                                    disabled={relistSaving}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg whitespace-nowrap"
                                  >
                                    {relistSaving ? 'Saving...' : 'Save & Re-list'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRelistingPartId(null);
                                      setRelistError(null);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700"
                                    aria-label="Cancel re-list"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </form>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    {(() => {
                                      const offer = getPartOfferDetails(part);
                                      return offer.hasOffer && offer.previousPrice !== null ? (
                                        <div className="flex flex-wrap items-baseline gap-1.5">
                                          <p className="text-sm font-mono tabular-nums font-bold text-orange-700">
                                            {formatCurrency(part.price)}
                                          </p>
                                          <span className="text-xs font-mono tabular-nums text-slate-400 line-through">
                                            {formatCurrency(offer.previousPrice)}
                                          </span>
                                          <span className="text-[10px] font-semibold text-emerald-700">
                                            -{offer.discountPercent}% OFFER
                                          </span>
                                        </div>
                                      ) : (
                                        <p className="text-sm font-mono tabular-nums font-bold text-slate-900">
                                          {formatCurrency(part.price)}
                                        </p>
                                      );
                                    })()}
                                    <p className="text-[11px] text-slate-500 tabular-nums">
                                      Stock: {part.stock}
                                      {typeof part.floorPrice === 'number' && part.floorPrice > 0
                                        ? ` · Floor: ${formatCurrency(part.floorPrice)}`
                                        : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openQuickRelist(part)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      <span>Re-list</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(part)}
                                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                      aria-label={`Edit ${part.name}`}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePart(part)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      aria-label={`Delete ${part.name}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        </div>
      )}

      {/* TAB 2: CUSTOMER CARE INBOX */}
      {activeTab === 'inbox' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-slate-900">
                Customer Conversations
              </h2>
              {onRequestNotificationPermission && notificationPermission === 'default' ? (
                <button
                  type="button"
                  onClick={onRequestNotificationPermission}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-md transition-colors"
                >
                  <Bell className="w-3 h-3" />
                  <span>Enable Alerts</span>
                </button>
              ) : notificationPermission === 'granted' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
                  <Bell className="w-3 h-3" />
                  <span>Alerts On</span>
                </span>
              ) : null}
            </div>
            {threads.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">
                No customer care chats yet. When shoppers send a message in Customer Care, their thread appears here.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {threads.map((thread) => {
                  const active = selectedSessionId === thread.sessionId;
                  const threadUnread = unreadBySession[thread.sessionId] || 0;
                  return (
                    <li key={thread.sessionId}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSessionId(thread.sessionId);
                          onMarkSessionRead?.(thread.sessionId);
                        }}
                        className={`w-full text-left px-5 py-3.5 transition-colors ${
                          active ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {thread.customerName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {threadUnread > 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                                {threadUnread} new
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-slate-400">
                              {thread.messageCount} msgs
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-1">
                          {thread.lastMessage}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="md:col-span-8 flex flex-col">
            {!selectedSessionId ? (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500">
                Select a customer chat thread to view and reply.
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {threads.find((t) => t.sessionId === selectedSessionId)?.customerName || 'Customer'}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedSessionId}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50 max-h-[380px]">
                  {threadMessages.map((msg) => {
                    const isSupport = msg.sender === 'support';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSupport ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                            isSupport
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1">
                          {isSupport ? 'Support (You)' : msg.customerName} ·{' '}
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <form
                  onSubmit={handleSendAdminReply}
                  className="p-4 border-t border-slate-200 bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Reply to customer..."
                    className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyDraft.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reply</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: SALES DASHBOARD (CURRENT MONTH RECHARTS ANALYTICS) */}
      {activeTab === 'salesDashboard' && (
        <SalesDashboardPanel
          orders={orders}
          loading={loadingOrders}
          onRefresh={loadOrders}
          onOpenSalesReports={() => setActiveTab('weeklySales')}
          onOpenReceipts={() => setActiveTab('receipts')}
        />
      )}

      {/* TAB: COMPILED SALES REPORTS (WEEKLY -> MONTHLY -> YEARLY + DATED SALES LEDGER) */}
      {activeTab === 'weeklySales' && (
        <div className="space-y-6">
          {/* Header & Period Switcher */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {reportPeriod === 'yearly'
                    ? 'Yearly Sales Report'
                    : reportPeriod === 'monthly'
                      ? 'Monthly Sales Report'
                      : 'Weekly Sales Report'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {salesReport
                    ? `Weekly reports compile automatically into Monthly and Yearly totals · Showing ${salesReport.periodLabel}`
                    : 'Weekly sales automatically compile into monthly and yearly reports with every confirmed sale dated for reference.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadSalesReport()}
                  disabled={loadingWeeklySales}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingWeeklySales ? 'animate-spin' : ''}`} />
                  <span>Refresh Report</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSalesReportCsv}
                  disabled={!salesReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Period Tabs, Date Selectors, and Confirmation Filter */}
            <div className="pt-4 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { key: 'weekly', label: 'Weekly' },
                      { key: 'monthly', label: 'Monthly' },
                      { key: 'yearly', label: 'Yearly' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setReportPeriod(opt.key)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        reportPeriod === opt.key
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {reportPeriod === 'weekly' && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="report-week-end" className="text-xs font-medium text-slate-600">
                      Week ending:
                    </label>
                    <input
                      id="report-week-end"
                      type="date"
                      value={reportWeekEnd || salesReport?.periodEnd || ''}
                      onChange={(e) => setReportWeekEnd(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
                    />
                    {reportWeekEnd && (
                      <button
                        type="button"
                        onClick={() => setReportWeekEnd('')}
                        className="text-xs font-medium text-orange-700 hover:underline"
                      >
                        This Week
                      </button>
                    )}
                  </div>
                )}

                {reportPeriod === 'monthly' && salesReport && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="report-month-select" className="text-xs font-medium text-slate-600">
                      Month:
                    </label>
                    <select
                      id="report-month-select"
                      value={reportMonth || salesReport.selectedMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
                    >
                      {salesReport.availableMonths.map((m) => {
                        const [y, mo] = m.split('-');
                        const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-KE', {
                          month: 'long',
                          year: 'numeric',
                        });
                        return (
                          <option key={m} value={m}>
                            {label} ({m})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {reportPeriod === 'yearly' && salesReport && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="report-year-select" className="text-xs font-medium text-slate-600">
                      Year:
                    </label>
                    <select
                      id="report-year-select"
                      value={reportYear || salesReport.selectedYear}
                      onChange={(e) => setReportYear(e.target.value)}
                      className="px-3 py-1.5 text-xs font-mono font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
                    >
                      {salesReport.availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setConfirmedOnly(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    !confirmedOnly
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Sales Made
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedOnly(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    confirmedOnly
                      ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Confirmed Only
                </button>
              </div>
            </div>
          </div>

          {weeklySalesError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {weeklySalesError}
            </div>
          )}

          {loadingWeeklySales && !salesReport ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
              Compiling weekly, monthly, and yearly sales reports...
            </div>
          ) : salesReport ? (
            <>
              {/* Live Compilation Rollup Strip: Weekly -> Monthly -> Yearly */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setReportWeekEnd('');
                    setReportPeriod('weekly');
                  }}
                  className={`text-left rounded-xl p-4 border transition-colors ${
                    reportPeriod === 'weekly'
                      ? 'bg-orange-50/70 border-orange-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-700">
                    1. This Week (7 Days)
                  </p>
                  <p className="font-display text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {formatCurrency(salesReport.rollupTotals.weekly.totalRevenue)}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 tabular-nums">
                    {salesReport.rollupTotals.weekly.totalOrders} sales ({salesReport.rollupTotals.weekly.confirmedOrders} confirmed)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportMonth(salesReport.rollupTotals.monthly.key);
                    setReportPeriod('monthly');
                  }}
                  className={`text-left rounded-xl p-4 border transition-colors ${
                    reportPeriod === 'monthly'
                      ? 'bg-orange-50/70 border-orange-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    2. Compiled Monthly ({salesReport.rollupTotals.monthly.key})
                  </p>
                  <p className="font-display text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {formatCurrency(salesReport.rollupTotals.monthly.totalRevenue)}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 tabular-nums">
                    {salesReport.rollupTotals.monthly.totalOrders} sales ({salesReport.rollupTotals.monthly.confirmedOrders} confirmed)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportYear(salesReport.rollupTotals.yearly.key);
                    setReportPeriod('yearly');
                  }}
                  className={`text-left rounded-xl p-4 border transition-colors ${
                    reportPeriod === 'yearly'
                      ? 'bg-orange-50/70 border-orange-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    3. Compiled Yearly ({salesReport.rollupTotals.yearly.key})
                  </p>
                  <p className="font-display text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {formatCurrency(salesReport.rollupTotals.yearly.totalRevenue)}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 tabular-nums">
                    {salesReport.rollupTotals.yearly.totalOrders} sales ({salesReport.rollupTotals.yearly.confirmedOrders} confirmed)
                  </p>
                </button>
              </div>

              {/* 4 KPI Summary Cards for Active Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">
                    {salesReport.period === 'yearly'
                      ? 'Yearly Revenue'
                      : salesReport.period === 'monthly'
                        ? 'Monthly Revenue'
                        : 'Weekly Revenue'}
                  </p>
                  <p className="font-display text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {formatCurrency(salesReport.summary.totalRevenue)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Sales Orders</p>
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                    {salesReport.summary.totalOrders}{' '}
                    <span className="text-xs font-semibold text-emerald-700">
                      ({salesReport.summary.confirmedOrders} confirmed)
                    </span>
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Units Sold</p>
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                    {salesReport.summary.totalUnitsSold}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Average Order Value</p>
                  <p className="font-display text-2xl font-bold text-orange-700 font-mono tabular-nums mt-1">
                    {formatCurrency(salesReport.summary.averageOrderValue)}
                  </p>
                </div>
              </div>

              {/* 30-Day Recharts Sales Volume & Revenue Trend */}
              <SalesTrendChart
                data={salesReport.dailyTrend30Days ?? []}
                confirmedOnly={confirmedOnly}
              />

              {/* Compiled Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {salesReport.period === 'yearly'
                        ? `Monthly Compilation Breakdown (${salesReport.periodLabel})`
                        : salesReport.period === 'monthly'
                          ? `Weekly Compilation Breakdown (${salesReport.periodLabel})`
                          : `Daily Sales Breakdown (${salesReport.periodLabel})`}
                    </h3>
                    {salesReport.period !== 'weekly' && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {salesReport.period === 'monthly'
                          ? 'Each week in this month rolls up into the monthly total. Click any week to inspect daily sales.'
                          : 'Each month’s weekly reports compile into the yearly total. Click any month to inspect its weekly breakdown.'}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                    {salesReport.breakdown.length}{' '}
                    {salesReport.period === 'yearly'
                      ? 'months'
                      : salesReport.period === 'monthly'
                        ? 'weeks'
                        : 'days'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">
                          {salesReport.period === 'yearly'
                            ? 'Month'
                            : salesReport.period === 'monthly'
                              ? 'Week'
                              : 'Day'}
                        </th>
                        <th className="py-3 px-4">Volume Trend</th>
                        <th className="py-3 px-4 text-right">Sales (Confirmed)</th>
                        <th className="py-3 px-4 text-right">Units Sold</th>
                        <th className="py-3 px-5 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {(() => {
                        const maxRevenue = Math.max(
                          1,
                          ...salesReport.breakdown.map((d) => d.revenue),
                        );
                        return salesReport.breakdown.map((row) => {
                          const pct =
                            row.revenue > 0
                              ? Math.max(6, Math.round((row.revenue / maxRevenue) * 100))
                              : 0;
                          const canDrill = Boolean(row.drillPeriod && row.drillValue);
                          return (
                            <tr key={row.key} className="hover:bg-slate-50">
                              <td className="py-3 px-5 font-medium text-slate-900 whitespace-nowrap">
                                {canDrill ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.drillPeriod === 'monthly' && row.drillValue) {
                                        setReportMonth(row.drillValue);
                                        setReportPeriod('monthly');
                                      } else if (row.drillPeriod === 'weekly' && row.drillValue) {
                                        setReportWeekEnd(row.drillValue);
                                        setReportPeriod('weekly');
                                      }
                                    }}
                                    className="text-left group"
                                  >
                                    <span className="font-semibold text-slate-900 group-hover:text-orange-700 group-hover:underline">
                                      {row.label}
                                    </span>
                                    <span className="block text-[11px] font-mono text-slate-400">
                                      {row.subLabel}
                                    </span>
                                  </button>
                                ) : (
                                  <>
                                    {row.label}
                                    <span className="block text-[11px] font-mono text-slate-400">
                                      {row.subLabel}
                                    </span>
                                  </>
                                )}
                              </td>
                              <td className="py-3 px-4 min-w-[160px]">
                                <div className="w-full h-2.5 bg-slate-100 rounded-sm overflow-hidden">
                                  <div
                                    className="h-full bg-orange-600 rounded-sm transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                                {row.ordersCount}{' '}
                                <span className="text-[11px] text-emerald-700">
                                  ({row.confirmedOrdersCount})
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                                {row.unitsSold}
                              </td>
                              <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-slate-900">
                                {formatCurrency(row.revenue)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirmed & Completed Sales Ledger (With Sale Date for Reference) */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <span>Sales Made &amp; Confirmed Ledger ({salesReport.periodLabel})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Every sale made in this period is listed below with the exact date the sale was made for later reference.
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                    {salesReport.sales.length} {salesReport.sales.length === 1 ? 'sale' : 'sales'}
                  </span>
                </div>

                {salesReport.sales.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500">
                    No {confirmedOnly ? 'confirmed ' : ''}sales recorded in {salesReport.periodLabel}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          <th className="py-3 px-5">Sale Date</th>
                          <th className="py-3 px-4">Receipt No.</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Items Sold</th>
                          <th className="py-3 px-4">Confirmation</th>
                          <th className="py-3 px-5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {salesReport.sales.map((sale) => {
                          const saleDateFormatted = new Date(sale.issuedAt).toLocaleString('en-KE', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          });
                          const matchedReceipt = orders.find((o) => o.id === sale.id);
                          return (
                            <tr key={sale.id} className="hover:bg-slate-50">
                              <td className="py-3 px-5 whitespace-nowrap">
                                <span className="text-xs font-semibold text-slate-900 block tabular-nums">
                                  {saleDateFormatted}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {sale.saleDate}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs font-semibold whitespace-nowrap">
                                {matchedReceipt ? (
                                  <button
                                    type="button"
                                    onClick={() => onViewReceipt(matchedReceipt)}
                                    className="text-orange-700 hover:underline"
                                  >
                                    {sale.receiptNumber}
                                  </button>
                                ) : (
                                  <span className="text-slate-900">{sale.receiptNumber}</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <p className="text-xs font-semibold text-slate-900">
                                  {sale.customerName}
                                </p>
                                <p className="text-[11px] font-mono text-slate-500">
                                  {sale.customerPhone}
                                </p>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-700 max-w-[260px]">
                                <p className="line-clamp-2" title={sale.itemsSummary}>
                                  {sale.itemsSummary}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                  {sale.paymentMethod}
                                </p>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {sale.saleConfirmed ? (
                                  <div className="inline-flex flex-col">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md w-fit">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Confirmed ({sale.status})</span>
                                    </span>
                                    {sale.confirmedAt && (
                                      <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                        {new Date(sale.confirmedAt).toLocaleDateString('en-KE', {
                                          dateStyle: 'medium',
                                        })}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={confirmingOrderId === sale.id}
                                    onClick={() => void handleConfirmSale(sale.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-md transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>
                                      {confirmingOrderId === sale.id ? 'Confirming...' : 'Confirm Sale'}
                                    </span>
                                  </button>
                                )}
                              </td>
                              <td className="py-3 px-5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                {formatCurrency(sale.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Top Selling Parts & Payment Methods */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Top-Selling Parts ({salesReport.periodLabel})
                    </h3>
                  </div>
                  {salesReport.topSellingParts.length === 0 ? (
                    <div className="p-6 text-xs text-slate-500">
                      No parts sold in this period yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                            <th className="py-2.5 px-5">Part</th>
                            <th className="py-2.5 px-4 text-right">Units</th>
                            <th className="py-2.5 px-5 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {salesReport.topSellingParts.map((part) => (
                            <tr key={part.partId} className="hover:bg-slate-50">
                              <td className="py-2.5 px-5">
                                <p className="font-semibold text-slate-900">{part.name}</p>
                                <p className="text-xs text-slate-500">
                                  {part.category} · <span className="font-mono">{part.sku}</span>
                                </p>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                                {part.unitsSold}
                              </td>
                              <td className="py-2.5 px-5 text-right font-mono tabular-nums font-semibold text-slate-900">
                                {formatCurrency(part.revenue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Payment Method Breakdown
                    </h3>
                  </div>
                  {salesReport.paymentMethods.length === 0 ? (
                    <div className="p-6 text-xs text-slate-500">
                      No payment transactions recorded in this period yet.
                    </div>
                  ) : (
                    <div className="p-5 space-y-3">
                      {salesReport.paymentMethods.map((pm) => (
                        <div
                          key={pm.method}
                          className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {pm.method}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                              {pm.ordersCount} {pm.ordersCount === 1 ? 'order' : 'orders'}
                            </p>
                          </div>
                          <span className="text-sm font-mono tabular-nums font-bold text-slate-900 shrink-0">
                            {formatCurrency(pm.revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* TAB 3: RECEIPT HISTORY LEDGER */}
      {activeTab === 'receipts' && (() => {
        const normalizedReceiptQuery = receiptSearchQuery.trim().toLowerCase();
        const queryDigits = normalizedReceiptQuery.replace(/\D/g, '');
        const normalizeKenyaDigits = (digits: string) => {
          if (digits.startsWith('254') && digits.length >= 9) return `0${digits.slice(3)}`;
          return digits;
        };
        const matchesPhoneQuery = (rawPhone: string) => {
          const rawLower = rawPhone.toLowerCase();
          if (rawLower.includes(normalizedReceiptQuery)) return true;
          if (queryDigits.length < 3) return false;
          const phoneDigits = rawPhone.replace(/\D/g, '');
          if (!phoneDigits) return false;
          if (phoneDigits.includes(queryDigits)) return true;
          const canonicalPhone = normalizeKenyaDigits(phoneDigits);
          const canonicalQuery = normalizeKenyaDigits(queryDigits);
          return canonicalPhone.includes(canonicalQuery);
        };
        const matchesReceiptQuery = (order: VirtualReceipt) => {
          if (!normalizedReceiptQuery) return true;
          if (receiptSearchField === 'customer') {
            return order.customerName.toLowerCase().includes(normalizedReceiptQuery);
          }
          if (receiptSearchField === 'phone') {
            return matchesPhoneQuery(order.customerPhone);
          }
          if (receiptSearchField === 'receipt') {
            return (
              order.receiptNumber.toLowerCase().includes(normalizedReceiptQuery) ||
              order.id.toLowerCase().includes(normalizedReceiptQuery)
            );
          }
          const status = normalizeOrderStatus(order.status);
          const itemsText = order.items.map((i) => `${i.name} ${i.sku}`).join(' ');
          const haystack = `${order.id} ${order.receiptNumber} ${order.pickupCode || ''} ${order.customerName} ${order.customerPhone} ${order.deliveryAddress} ${order.courierName || ''} ${order.vehicleDetails || ''} ${order.fittingDate || ''} ${order.fittingSlotLabel || ''} ${order.fittingStatus || ''} ${order.referralCodeUsed || ''} ${order.referralPartnerName || ''} ${order.paymentMethod} ${status} ${itemsText}`.toLowerCase();
          return haystack.includes(normalizedReceiptQuery) || matchesPhoneQuery(order.customerPhone);
        };

        const orderStatusCounts = orders.reduce<Record<'All' | OrderStatus, number>>(
          (acc, order) => {
            const st = normalizeOrderStatus(order.status);
            acc.All += 1;
            acc[st] += 1;
            return acc;
          },
          { All: 0, Pending: 0, Shipped: 0, Delivered: 0 },
        );

        const filteredOrders = orders.filter((order) => {
          const status = normalizeOrderStatus(order.status);
          if (receiptStatusFilter !== 'All' && status !== receiptStatusFilter) return false;
          if (receiptServiceFilter === 'garage_fitting' && order.deliveryRegion !== 'garage_fitting') {
            return false;
          }
          if (receiptServiceFilter === 'delivery_pickup' && order.deliveryRegion === 'garage_fitting') {
            return false;
          }
          if (receiptFittingStatusFilter !== 'All') {
            if (order.deliveryRegion !== 'garage_fitting') return false;
            if ((order.fittingStatus || 'Scheduled') !== receiptFittingStatusFilter) return false;
          }
          const isConfirmed = Boolean(order.saleConfirmed || status !== 'Pending');
          if (receiptConfirmationFilter === 'confirmed' && !isConfirmed) return false;
          if (receiptConfirmationFilter === 'unconfirmed' && isConfirmed) return false;
          if (receiptDateFilter) {
            const orderDate = order.fittingDate || order.issuedAt.slice(0, 10);
            if (orderDate !== receiptDateFilter) return false;
          }
          return matchesReceiptQuery(order);
        });

        const hasActiveReceiptFilters =
          Boolean(normalizedReceiptQuery) ||
          receiptSearchField !== 'all' ||
          receiptStatusFilter !== 'All' ||
          receiptServiceFilter !== 'All' ||
          receiptFittingStatusFilter !== 'All' ||
          receiptConfirmationFilter !== 'all' ||
          Boolean(receiptDateFilter);

        const resetReceiptFilters = () => {
          setReceiptSearchQuery('');
          setReceiptSearchField('all');
          setReceiptStatusFilter('All');
          setReceiptServiceFilter('All');
          setReceiptFittingStatusFilter('All');
          setReceiptConfirmationFilter('all');
          setReceiptDateFilter('');
        };

        const allGarageAppointmentsCount = orders.filter(
          (o) => o.deliveryRegion === 'garage_fitting' && o.fittingDate,
        ).length;

        const garageAppointments = orders
          .filter((o) => {
            if (o.deliveryRegion !== 'garage_fitting' || !o.fittingDate) return false;
            if (
              receiptFittingStatusFilter !== 'All' &&
              (o.fittingStatus || 'Scheduled') !== receiptFittingStatusFilter
            ) {
              return false;
            }
            if (receiptDateFilter && o.fittingDate !== receiptDateFilter) return false;
            return matchesReceiptQuery(o);
          })
          .sort((a, b) =>
            `${a.fittingDate || ''}_${a.fittingTimeSlot || ''}`.localeCompare(
              `${b.fittingDate || ''}_${b.fittingTimeSlot || ''}`,
            ),
          );

        const selectedOrderIdSet = new Set(selectedOrderIds);
        const visibleOrderIds = filteredOrders.map((o) => o.id);
        const allVisibleSelected =
          visibleOrderIds.length > 0 && visibleOrderIds.every((id) => selectedOrderIdSet.has(id));
        const someVisibleSelected = visibleOrderIds.some((id) => selectedOrderIdSet.has(id));

        const toggleSelectAllVisibleOrders = () => {
          if (allVisibleSelected) {
            const visibleSet = new Set(visibleOrderIds);
            setSelectedOrderIds((prev) => prev.filter((id) => !visibleSet.has(id)));
          } else {
            setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleOrderIds])));
          }
        };

        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Receipt History &amp; Garage Fitting Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete ledger of customer receipts, in-garage vehicle fitting appointments, couriers, and bulk status updates with automated SMS.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasActiveReceiptFilters && (
                  <button
                    type="button"
                    onClick={resetReceiptFilters}
                    className="px-2.5 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void loadOrders()}
                  disabled={loadingOrders}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  disabled={filteredOrders.length === 0}
                  onClick={() => {
                    const activeFilters = [
                      receiptStatusFilter !== 'All' ? `Status=${receiptStatusFilter}` : '',
                      receiptServiceFilter !== 'All' ? `Service=${receiptServiceFilter}` : '',
                      receiptFittingStatusFilter !== 'All'
                        ? `Bay=${receiptFittingStatusFilter}`
                        : '',
                      receiptConfirmationFilter !== 'all'
                        ? `Confirmation=${receiptConfirmationFilter}`
                        : '',
                      receiptDateFilter ? `Date=${receiptDateFilter}` : '',
                      normalizedReceiptQuery ? `Search="${receiptSearchQuery.trim()}"` : '',
                    ]
                      .filter(Boolean)
                      .join(', ');
                    downloadOrderHistoryCsv(filteredOrders, {
                      dateFilter: receiptDateFilter || undefined,
                      isFiltered: hasActiveReceiptFilters,
                      filterSummary: activeFilters || undefined,
                    });
                  }}
                  title="Download current order history as an accounting CSV file"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV ({filteredOrders.length})</span>
                </button>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {filteredOrders.length} of {orders.length} receipts
                </span>
              </div>
            </div>

            {/* Counter Pickup Verification & Handover Desk */}
            <div className="px-6 py-4 bg-orange-50/50 border-b border-orange-200/80 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Counter Pickup Code Verification ({PICKUP_RESERVATION_HOURS}-Hour Reserve Desk)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Enter the customer’s pickup code to pull up reserved spare parts and booking agreement receipt. Unclaimed holds auto-restock after {PICKUP_RESERVATION_HOURS} hours.
                  </p>
                </div>
                <form
                  onSubmit={(e) => void handleLookupPickupCode(e)}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    value={pickupCodeInput}
                    onChange={(e) => setPickupCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter Pickup Code (e.g. PKP-...)"
                    aria-label="Counter pickup verification code"
                    className="w-56 px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  <button
                    type="submit"
                    disabled={pickupLookupLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{pickupLookupLoading ? 'Searching...' : 'Verify Pickup Code'}</span>
                  </button>
                  {pickupLookupOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickupLookupOrder(null);
                        setPickupLookupError(null);
                        setPickupActionNotice(null);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
                    >
                      Clear
                    </button>
                  )}
                </form>
              </div>

              {pickupLookupError && (
                <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {pickupLookupError}
                </p>
              )}

              {pickupActionNotice && (
                <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {pickupActionNotice}
                </p>
              )}

              {pickupLookupOrder && (
                <div className="bg-white border border-orange-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-orange-800 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded">
                          {pickupLookupOrder.pickupCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded border ${
                            pickupLookupOrder.pickupStatus === 'claimed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : pickupLookupOrder.pickupStatus === 'expired_restocked'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          {pickupLookupOrder.pickupStatus === 'claimed'
                            ? 'Claimed at Counter'
                            : pickupLookupOrder.pickupStatus === 'expired_restocked'
                              ? 'Expired (>24h) · Returned to Stock'
                              : 'Active 24h Hold'}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          {pickupLookupOrder.receiptNumber}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">
                        Customer: {pickupLookupOrder.customerName} ({pickupLookupOrder.customerPhone}) · Total:{' '}
                        <span className="font-mono">{formatCurrency(pickupLookupOrder.total)}</span>
                      </p>
                      {pickupLookupOrder.pickupReservedUntil && (
                        <p className="text-[11px] text-slate-600">
                          Reserved Until:{' '}
                          <span className="font-mono font-semibold text-slate-800">
                            {new Date(pickupLookupOrder.pickupReservedUntil).toLocaleString('en-KE', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewReceipt(pickupLookupOrder)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        Booking Receipt
                      </button>
                      {pickupLookupOrder.pickupStatus !== 'claimed' &&
                        pickupLookupOrder.pickupStatus !== 'expired_restocked' && (
                          <button
                            type="button"
                            disabled={claimingPickupId === pickupLookupOrder.id}
                            onClick={() => void handleClaimPickupOrder(pickupLookupOrder.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {claimingPickupId === pickupLookupOrder.id
                                ? 'Confirming...'
                                : 'Confirm Handover (Mark Claimed)'}
                            </span>
                          </button>
                        )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Reserved Customer Spare Parts
                    </p>
                    <ul className="divide-y divide-slate-100 text-xs border border-slate-200 rounded-lg overflow-hidden">
                      {pickupLookupOrder.items.map((item) => (
                        <li
                          key={`${pickupLookupOrder.id}-${item.partId}`}
                          className="px-3 py-2 flex items-center justify-between gap-2 bg-slate-50/40"
                        >
                          <span>
                            <strong className="text-slate-900">
                              {item.quantity}× {item.name}
                            </strong>{' '}
                            <span className="font-mono text-slate-500">({item.sku})</span>
                          </span>
                          <span className="font-mono font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {pickupLookupOrder.pickupBookingAgreement && (
                    <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                      <strong className="text-slate-900">Booking Agreement Receipt:</strong>{' '}
                      {pickupLookupOrder.pickupBookingAgreement}
                    </div>
                  )}
                </div>
              )}
            </div>

            {bulkOrderUpdateError && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between gap-2 text-xs text-red-800">
                <p className="font-medium">{bulkOrderUpdateError}</p>
                <button
                  type="button"
                  onClick={() => setBulkOrderUpdateError(null)}
                  aria-label="Dismiss bulk update error"
                  className="p-1 text-red-700 hover:text-red-950 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {bulkOrderUpdateNotice && (
              <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Updated <span className="font-mono tabular-nums">{bulkOrderUpdateNotice.updatedCount}</span>{' '}
                      order{bulkOrderUpdateNotice.updatedCount === 1 ? '' : 's'} to{' '}
                      <span>{bulkOrderUpdateNotice.status}</span> · Dispatched{' '}
                      <span className="font-mono tabular-nums">{bulkOrderUpdateNotice.smsNotifications.length}</span>{' '}
                      automated SMS notification{bulkOrderUpdateNotice.smsNotifications.length === 1 ? '' : 's'} from{' '}
                      <span className="font-mono">{adminSenderPhone}</span>
                    </p>
                    {bulkOrderUpdateNotice.smsNotifications.length > 0 && (
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Receipts:{' '}
                        <span className="font-mono">
                          {bulkOrderUpdateNotice.smsNotifications
                            .map((n) => n.receiptNumber)
                            .filter(Boolean)
                            .join(', ')}
                        </span>{' '}
                        · Recipients notified:{' '}
                        <span className="font-mono tabular-nums">
                          {bulkOrderUpdateNotice.totalRecipients}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('orderSms');
                      setSmsLogScopeFilter('all');
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap"
                  >
                    View in SMS Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkOrderUpdateNotice(null)}
                    aria-label="Dismiss bulk update SMS confirmation"
                    className="p-1 text-emerald-700 hover:text-emerald-950 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {receiptSmsNotice && (
              <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Automated Order Status SMS sent from{' '}
                      <span className="font-mono">{receiptSmsNotice.senderPhone || adminSenderPhone}</span>{' '}
                      ({receiptSmsNotice.audienceLabel})
                    </p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      To:{' '}
                      <span className="font-mono">
                        {receiptSmsNotice.recipients.map((r) => r.phone).join(', ')}
                      </span>{' '}
                      — {receiptSmsNotice.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('orderSms');
                      setSmsLogScopeFilter('all');
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap"
                  >
                    View in SMS Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptSmsNotice(null)}
                    aria-label="Dismiss automated SMS confirmation"
                    className="p-1 text-emerald-700 hover:text-emerald-950 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:max-w-2xl">
                  <select
                    aria-label="Order search field"
                    value={receiptSearchField}
                    onChange={(e) =>
                      setReceiptSearchField(
                        e.target.value as 'all' | 'customer' | 'phone' | 'receipt',
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600 shrink-0"
                  >
                    <option value="all">Search: All Fields</option>
                    <option value="customer">Customer Name</option>
                    <option value="phone">Phone Number</option>
                    <option value="receipt">Receipt ID / No.</option>
                  </select>
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      aria-label="Search orders by customer name, phone number, or receipt ID"
                      value={receiptSearchQuery}
                      onChange={(e) => setReceiptSearchQuery(e.target.value)}
                      placeholder={
                        receiptSearchField === 'customer'
                          ? 'Filter by customer name (e.g. Amina Wanjiku)...'
                          : receiptSearchField === 'phone'
                            ? 'Filter by phone number (e.g. 0712345678 or +254712345678)...'
                            : receiptSearchField === 'receipt'
                              ? 'Filter by receipt number or ID (e.g. MSZ-2026... or ord-...)...'
                              : 'Search by customer name, phone number, receipt ID, or vehicle...'
                      }
                      className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                    {receiptSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setReceiptSearchQuery('')}
                        aria-label="Clear receipt search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                  {(['All', ...ORDER_STATUSES] as const).map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      onClick={() => setReceiptStatusFilter(statusOption)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        receiptStatusFilter === statusOption
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {statusOption} ({orderStatusCounts[statusOption]})
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Order &amp; Bay Filters:</span>
                </div>
                <select
                  aria-label="Filter by service mode"
                  value={receiptServiceFilter}
                  onChange={(e) =>
                    setReceiptServiceFilter(
                      e.target.value as 'All' | 'garage_fitting' | 'delivery_pickup',
                    )
                  }
                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                >
                  <option value="All">All Service Modes</option>
                  <option value="garage_fitting">In-Garage Fitting Only</option>
                  <option value="delivery_pickup">Delivery &amp; Pickup Only</option>
                </select>

                <select
                  aria-label="Filter by garage bay status"
                  value={receiptFittingStatusFilter}
                  onChange={(e) =>
                    setReceiptFittingStatusFilter(
                      e.target.value as 'All' | FittingAppointmentStatus,
                    )
                  }
                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                >
                  <option value="All">All Bay Statuses</option>
                  {FITTING_APPOINTMENT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      Bay: {st}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by payment confirmation"
                  value={receiptConfirmationFilter}
                  onChange={(e) =>
                    setReceiptConfirmationFilter(
                      e.target.value as 'all' | 'confirmed' | 'unconfirmed',
                    )
                  }
                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                >
                  <option value="all">All Confirmation States</option>
                  <option value="confirmed">Sale Confirmed</option>
                  <option value="unconfirmed">Awaiting Confirmation</option>
                </select>

                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    aria-label="Filter receipts and appointments by date"
                    value={receiptDateFilter}
                    onChange={(e) => setReceiptDateFilter(e.target.value)}
                    className="text-xs font-mono text-slate-700 bg-transparent focus:outline-none py-0.5"
                  />
                  {receiptDateFilter && (
                    <button
                      type="button"
                      onClick={() => setReceiptDateFilter('')}
                      aria-label="Clear receipt date filter"
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {hasActiveReceiptFilters && (
                  <button
                    type="button"
                    onClick={resetReceiptFilters}
                    className="px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>

            {allGarageAppointmentsCount > 0 && receiptServiceFilter !== 'delivery_pickup' && (() => {
              const displayedAppointments = showAllGarageAppointments
                ? garageAppointments
                : garageAppointments.slice(0, 6);

              return (
                <div className="px-6 py-4 bg-orange-50/50 border-b border-orange-200/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900">
                        Garage Fitting Bay Schedule ({garageAppointments.length}
                        {garageAppointments.length !== allGarageAppointmentsCount
                          ? ` of ${allGarageAppointmentsCount}`
                          : ''})
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {garageAppointments.length > 6 && (
                        <button
                          type="button"
                          onClick={() => setShowAllGarageAppointments((prev) => !prev)}
                          className="text-[11px] font-semibold text-orange-700 hover:underline"
                        >
                          {showAllGarageAppointments
                            ? 'Show fewer (6)'
                            : `Show all ${garageAppointments.length} bookings`}
                        </button>
                      )}
                      <span className="text-[11px] text-slate-600">
                        Seventies Plaza, Kirinyaga Rd · Max 2 bays per hourly slot
                      </span>
                    </div>
                  </div>
                  {garageAppointments.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No garage fitting appointments match your active search or bay filters.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {displayedAppointments.map((appt) => {
                        const fStatus = appt.fittingStatus || 'Scheduled';
                        return (
                          <div
                            key={`appt-${appt.id}`}
                            className="bg-white border border-orange-200 rounded-lg p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-orange-800">
                                {formatFittingDateLabel(appt.fittingDate)} ·{' '}
                                {appt.fittingSlotLabel || getGarageSlotLabel(appt.fittingTimeSlot)}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {appt.receiptNumber}
                              </span>
                            </div>
                            <p className="font-medium text-slate-900 truncate">
                              {appt.customerName} ·{' '}
                              <span className="font-mono text-slate-600">{appt.customerPhone}</span>
                            </p>
                            {appt.vehicleDetails && (
                              <p className="text-[11px] text-slate-600 truncate">
                                Vehicle: {appt.vehicleDetails}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                              <label className="text-[11px] text-slate-500">Bay Status:</label>
                              <select
                                aria-label={`Bay status for ${appt.receiptNumber}`}
                                disabled={updatingFittingOrderId === appt.id}
                                value={fStatus}
                                onChange={(e) =>
                                  void handleUpdateFittingStatus(
                                    appt.id,
                                    e.target.value as FittingAppointmentStatus,
                                  )
                                }
                                className={`px-2 py-0.5 text-[11px] font-semibold rounded border focus:outline-none focus:ring-1 focus:ring-orange-600 ${
                                  fStatus === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : fStatus === 'In Bay'
                                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                                      : fStatus === 'Cancelled'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {FITTING_APPOINTMENT_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {loadingOrders && orders.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">Loading receipt history...</div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">
                No orders have been completed yet. Receipts generated at checkout appear here.
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-sm text-slate-500 flex flex-wrap items-center gap-3">
                <span>No receipts match the current search or maintenance filters.</span>
                {hasActiveReceiptFilters && (
                  <button
                    type="button"
                    onClick={resetReceiptFilters}
                    className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div>
                {selectedOrderIds.length > 0 && (
                  <div className="px-6 py-3 bg-slate-900 text-white border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono tabular-nums font-bold text-orange-400">
                        {selectedOrderIds.length}
                      </span>
                      <span className="font-semibold">
                        order{selectedOrderIds.length === 1 ? '' : 's'} selected
                      </span>
                      <span aria-hidden="true" className="text-slate-500">
                        ·
                      </span>
                      <span className="text-slate-300">
                        Automated SMS notifications send from{' '}
                        <span className="font-mono text-white">{adminSenderPhone}</span> for each updated order
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!allVisibleSelected && filteredOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleSelectAllVisibleOrders}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          Select all {filteredOrders.length} visible
                        </button>
                      )}
                      <label htmlFor="bulk-order-status-select" className="sr-only">
                        Target status for selected orders
                      </label>
                      <select
                        id="bulk-order-status-select"
                        aria-label="Target status for selected orders"
                        value={bulkOrderStatusTarget}
                        disabled={bulkUpdatingOrders}
                        onChange={(e) => setBulkOrderStatusTarget(e.target.value as OrderStatus)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {ORDER_STATUSES.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            Set Status: {statusOption}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={bulkUpdatingOrders}
                        onClick={() => void handleBulkUpdateOrderStatus()}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {bulkUpdatingOrders
                            ? 'Updating & Sending SMS...'
                            : `Update ${selectedOrderIds.length} & Send Auto SMS`}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={bulkUpdatingOrders}
                        onClick={() => {
                          const selectedSet = new Set(selectedOrderIds);
                          const selectedRows = orders.filter((o) => selectedSet.has(o.id));
                          downloadOrderHistoryCsv(selectedRows, {
                            isSelection: true,
                            filterSummary: `${selectedRows.length} manually selected orders`,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-100 bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/60 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Selected CSV</span>
                      </button>
                      <button
                        type="button"
                        disabled={bulkUpdatingOrders}
                        onClick={() => setSelectedOrderIds([])}
                        className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                        <th className="py-3 pl-5 pr-2 w-10">
                          <input
                            type="checkbox"
                            aria-label="Select all visible orders"
                            checked={allVisibleSelected}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = someVisibleSelected && !allVisibleSelected;
                              }
                            }}
                            onChange={toggleSelectAllVisibleOrders}
                            className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4">Issued</th>
                        <th className="py-3 px-4">Receipt No.</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Delivery / Courier</th>
                        <th className="py-3 px-4">Items</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filteredOrders.map((order) => {
                        const currentStatus = normalizeOrderStatus(order.status);
                        const isSelected = selectedOrderIdSet.has(order.id);
                        const issuedFormatted = new Date(order.issuedAt).toLocaleString('en-KE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        });
                        return (
                          <tr
                            key={order.id}
                            className={
                              isSelected
                                ? 'bg-orange-50/40 hover:bg-orange-50/70'
                                : 'hover:bg-slate-50'
                            }
                          >
                            <td className="py-3 pl-5 pr-2 w-10 align-top">
                              <input
                                type="checkbox"
                                aria-label={`Select order ${order.receiptNumber}`}
                                checked={isSelected}
                                onChange={() => toggleOrderSelection(order.id)}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                              {issuedFormatted}
                            </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setActiveOrderDetails(order)}
                              className="text-left font-mono text-xs font-semibold text-slate-900 hover:text-orange-600 underline decoration-slate-300 hover:decoration-orange-500 underline-offset-2 transition-colors"
                              title="Open Order Details & Packing Slip"
                            >
                              {order.receiptNumber}
                            </button>
                            {order.referralCodeUsed && (
                              <div className="mt-0.5 text-[10px] font-sans font-semibold text-slate-600">
                                Ref <span className="font-mono text-slate-800">{order.referralCodeUsed}</span> ·{' '}
                                <span
                                  className={
                                    order.referralCreditStatus === 'credited'
                                      ? 'text-emerald-700'
                                      : 'text-amber-700'
                                  }
                                >
                                  {order.referralCreditStatus === 'credited'
                                    ? `1% Credited (${formatCurrency(order.referralCreditAmount ?? Math.round((order.total * 1) / 100))})`
                                    : `1% Pending Fit (${formatCurrency(order.referralCreditAmount ?? Math.round((order.total * 1) / 100))})`}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-slate-900 font-medium">{order.customerName}</p>
                            <p className="font-mono text-xs text-slate-500">{order.customerPhone}</p>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px]">
                            {order.deliveryRegion === 'garage_fitting' && (
                              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800 bg-orange-50 border border-orange-200 rounded">
                                  <Wrench className="w-2.5 h-2.5" />
                                  <span>In-Garage Fitting</span>
                                </span>
                                {order.fittingDate && (
                                  <select
                                    aria-label={`Garage bay status for ${order.receiptNumber}`}
                                    disabled={updatingFittingOrderId === order.id}
                                    value={order.fittingStatus || 'Scheduled'}
                                    onChange={(e) =>
                                      void handleUpdateFittingStatus(
                                        order.id,
                                        e.target.value as FittingAppointmentStatus,
                                      )
                                    }
                                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-600"
                                  >
                                    {FITTING_APPOINTMENT_STATUSES.map((st) => (
                                      <option key={st} value={st}>
                                        Bay: {st}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                            {order.deliveryRegion === 'pickup' && order.pickupCode && (
                              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                                  Pickup: {order.pickupCode}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                    order.pickupStatus === 'claimed'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : order.pickupStatus === 'expired_restocked'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  {order.pickupStatus === 'claimed'
                                    ? 'Claimed'
                                    : order.pickupStatus === 'expired_restocked'
                                      ? 'Expired & Restocked'
                                      : 'Reserved 24h'}
                                </span>
                              </div>
                            )}
                            {order.deliveryRegion === 'nairobi' && Boolean(order.deliveryFee && order.deliveryFee > 0) && (
                              <p className="text-[11px] font-semibold text-slate-700 mb-0.5 font-mono tabular-nums">
                                Delivery Fee: {formatCurrency(order.deliveryFee || 0)}
                                {typeof order.deliveryDistanceKm === 'number'
                                  ? ` (${order.deliveryDistanceKm.toFixed(1)} km)`
                                  : ''}
                              </p>
                            )}
                            {order.fittingDate && (
                              <p className="font-semibold text-emerald-800 mb-0.5">
                                Slot: {formatFittingDateLabel(order.fittingDate)} ·{' '}
                                {order.fittingSlotLabel || getGarageSlotLabel(order.fittingTimeSlot)}
                              </p>
                            )}
                            <p className="truncate" title={order.deliveryAddress}>
                              {order.deliveryAddress}
                            </p>
                            {order.vehicleDetails && (
                              <p
                                className="font-medium text-orange-800 mt-0.5 truncate"
                                title={order.vehicleDetails}
                              >
                                Vehicle: {order.vehicleDetails}
                              </p>
                            )}
                            {order.courierName && (
                              <p className="font-semibold text-slate-800 mt-0.5">
                                Courier: {order.courierName}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {order.paymentMethod}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                            {order.items.reduce((sum, i) => sum + i.quantity, 0)} items
                          </td>
                          <td className="py-3 px-4 space-y-1.5">
                            <select
                              aria-label={`Order status for ${order.receiptNumber}`}
                              value={currentStatus}
                              onChange={(e) =>
                                void handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)
                              }
                              className={`w-full px-2.5 py-1 text-xs font-semibold rounded-md border focus:outline-none focus:ring-2 focus:ring-orange-600 ${
                                currentStatus === 'Delivered'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : currentStatus === 'Shipped'
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {ORDER_STATUSES.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>
                                  {statusOption}
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const stage = normalizeTrackingStage(order.trackingStage, currentStatus);
                              return (
                                <select
                                  aria-label={`Live tracking stage for ${order.receiptNumber}`}
                                  value={stage}
                                  onChange={(e) =>
                                    void handleUpdateOrderTracking(
                                      order.id,
                                      e.target.value as OrderTrackingStage,
                                    )
                                  }
                                  className="w-full px-2 py-0.5 text-[11px] font-medium rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                                >
                                  {ORDER_TRACKING_STAGES.map((opt) => (
                                    <option key={opt.stage} value={opt.stage}>
                                      Stage: {opt.label}
                                    </option>
                                  ))}
                                </select>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            <div>{formatCurrency(order.total)}</div>
                            {Boolean(order.discountAmount && order.discountAmount > 0) && (
                              <div className="text-[10px] font-medium text-emerald-700">
                                -{formatCurrency(order.discountAmount || 0)} off
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {order.referralCodeUsed && (
                                order.referralCreditStatus === 'credited' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>1% Credited</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={releasingCreditOrderId === order.id}
                                    onClick={() => void handleReleaseReferralCredit(order.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-md transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>
                                      {releasingCreditOrderId === order.id
                                        ? 'Crediting...'
                                        : 'Fitted & Credit 1%'}
                                    </span>
                                  </button>
                                )
                              )}
                              {order.saleConfirmed || currentStatus !== 'Pending' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Confirmed</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={confirmingOrderId === order.id}
                                  onClick={() => void handleConfirmSale(order.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-md transition-colors"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{confirmingOrderId === order.id ? 'Confirming...' : 'Confirm Sale'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveOrderDetails(order)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Order Details</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onViewReceipt(order)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              >
                                View Receipt
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: CUSTOMER & MECHANIC REVIEWS MODERATION */}
      {activeTab === 'reviews' && (() => {
        const q = reviewSearchQuery.trim().toLowerCase();
        const filteredReviews = reviews.filter((rev) => {
          if (!q) return true;
          return `${rev.authorName} ${rev.authorType} ${rev.garageOrVehicle || ''} ${rev.comment}`
            .toLowerCase()
            .includes(q);
        });

        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Customer Reviews &amp; Mechanic Testimonials
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Insulting words are blocked automatically on submission, and you can delete any inappropriate review immediately.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={reviewSearchQuery}
                    onChange={(e) => setReviewSearchQuery(e.target.value)}
                    placeholder="Filter reviews..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadReviews()}
                  disabled={loadingReviews}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingReviews ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {loadingReviews && reviews.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">Loading reviews...</div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">
                No customer reviews or mechanic testimonials match your filter.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredReviews.map((review) => {
                  const formattedDate = new Date(review.createdAt).toLocaleString('en-KE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });
                  return (
                    <div
                      key={review.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/70"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-0.5 text-amber-500">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < review.rating
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-bold text-slate-900">
                            {review.authorName}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                              review.authorType === 'garage'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : review.authorType === 'mechanic'
                                  ? 'bg-orange-50 text-orange-800 border-orange-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {review.authorType === 'garage'
                              ? 'Partner Garage'
                              : review.authorType === 'mechanic'
                                ? 'Mechanic Testimonial'
                                : 'Customer Review'}
                          </span>
                          {review.garageOrVehicle && (
                            <span className="text-xs text-slate-500">
                              · {review.garageOrVehicle}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-slate-400">
                            · {formattedDate}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          “{review.comment}”
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={deletingReviewId === review.id}
                        onClick={() => void handleDeleteReview(review.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{deletingReviewId === review.id ? 'Deleting...' : 'Delete Review'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: GARAGE & MECHANIC PARTNER ACCOUNTS */}
      {activeTab === 'partners' && (() => {
        const q = partnerSearchQuery.trim().toLowerCase();
        const pendingCount = partners.filter((p) => p.status === 'pending').length;
        const activeCount = partners.filter((p) => p.status === 'active').length;
        const pausedCount = partners.filter((p) => p.status === 'paused').length;
        const rejectedCount = partners.filter((p) => p.status === 'rejected').length;

        const filteredPartners = partners.filter((p) => {
          if (partnerStatusFilter !== 'all' && p.status !== partnerStatusFilter) {
            return false;
          }
          if (partnerTypeFilter !== 'all' && p.partnerType !== partnerTypeFilter) {
            return false;
          }
          if (!q) return true;
          return `${p.businessName} ${p.contactName} ${p.phone} ${p.email} ${p.location} ${p.specialty || ''} ${p.referralCode} ${p.partnerType} ${p.proofType || ''}`
            .toLowerCase()
            .includes(q);
        });

        const hasActivePartnerFilters =
          Boolean(q) || partnerStatusFilter !== 'all' || partnerTypeFilter !== 'all';

        const resetPartnerFilters = () => {
          setPartnerSearchQuery('');
          setPartnerStatusFilter('all');
          setPartnerTypeFilter('all');
        };

        const statusBadge = (status: GaragePartnerStatus) => {
          if (status === 'active') {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                <span>Approved</span>
              </span>
            );
          }
          if (status === 'pending') {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-50 text-blue-800 border border-blue-200">
                <Clock className="w-3 h-3" />
                <span>Pending Review</span>
              </span>
            );
          }
          if (status === 'rejected') {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-red-50 text-red-800 border border-red-200">
                <XCircle className="w-3 h-3" />
                <span>Rejected</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
              <span>Paused</span>
            </span>
          );
        };

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Pending Verification</p>
                <p
                  className={`font-display text-2xl font-bold tabular-nums mt-1 ${
                    pendingCount > 0 ? 'text-orange-600' : 'text-slate-900'
                  }`}
                >
                  {pendingCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Active Approved Partners</p>
                <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {activeCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Total Customer Referrals</p>
                <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                  {partners.reduce((sum, p) => sum + p.referralsCount, 0)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Partner + Referred Revenue</p>
                <p className="font-display text-2xl font-bold text-orange-700 font-mono tabular-nums mt-1">
                  {formatCurrency(
                    partners.reduce((sum, p) => sum + p.totalSpent + p.referredRevenue, 0),
                  )}
                </p>
              </div>
            </div>

            {partnerActionNotice && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{partnerActionNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPartnerActionNotice(null)}
                  className="text-xs font-semibold text-emerald-800 hover:underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Garage &amp; Mechanic Partner Verification
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review uploaded garage/mechanic proof documents, approve verified applicants (sends automated approval SMS), and manage trade discount tiers.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={partnerSearchQuery}
                        onChange={(e) => setPartnerSearchQuery(e.target.value)}
                        placeholder="Search garage, mechanic, specialty, code..."
                        className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                      {partnerSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPartnerSearchQuery('')}
                          aria-label="Clear partner search"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <select
                      aria-label="Filter by partner type"
                      value={partnerTypeFilter}
                      onChange={(e) =>
                        setPartnerTypeFilter(e.target.value as 'all' | 'mechanic' | 'garage')
                      }
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    >
                      <option value="all">All Types</option>
                      <option value="mechanic">Mechanics Only</option>
                      <option value="garage">Garages Only</option>
                    </select>
                    {hasActivePartnerFilters && (
                      <button
                        type="button"
                        onClick={resetPartnerFilters}
                        className="px-2.5 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                      >
                        Reset Filters
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void loadPartners()}
                      disabled={loadingPartners}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingPartners ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Status Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: `All (${partners.length})` },
                        { id: 'pending', label: `Pending Approval (${pendingCount})` },
                        { id: 'active', label: `Approved (${activeCount})` },
                        { id: 'paused', label: `Paused (${pausedCount})` },
                        { id: 'rejected', label: `Rejected (${rejectedCount})` },
                      ] as const
                    ).map((filterItem) => {
                      const selected = partnerStatusFilter === filterItem.id;
                      return (
                        <button
                          key={filterItem.id}
                          type="button"
                          onClick={() => setPartnerStatusFilter(filterItem.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            selected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {filterItem.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    Showing {filteredPartners.length} of {partners.length} partners
                  </span>
                </div>
              </div>

              {loadingPartners && partners.length === 0 ? (
                <div className="p-8 text-sm text-slate-500">Loading partner accounts...</div>
              ) : filteredPartners.length === 0 ? (
                <div className="p-8 text-sm text-slate-500 flex flex-wrap items-center gap-3">
                  <span>
                    {partners.length === 0
                      ? 'No garage or mechanic partners registered yet. Partners can submit verification applications from the storefront.'
                      : 'No partner accounts match the selected filter or search term.'}
                  </span>
                  {hasActivePartnerFilters && (
                    <button
                      type="button"
                      onClick={resetPartnerFilters}
                      className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Business &amp; Contact</th>
                        <th className="py-3 px-4">Verification Proof</th>
                        <th className="py-3 px-4">Referral Code</th>
                        <th className="py-3 px-4 text-right">Orders / Referrals</th>
                        <th className="py-3 px-4">Trade Tier</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filteredPartners.map((partner) => {
                        const loyaltyItems = getPartnerLoyaltyItemsCount(partner);
                        const effectiveTier = getPartnerTierDiscountPct(
                          loyaltyItems,
                          partner.discountTierPercent,
                          isJoinedPartnerProgram(partner),
                        );
                        const isBusy = updatingPartnerId === partner.id;
                        return (
                          <tr key={partner.id} className="hover:bg-slate-50">
                            <td className="py-3 px-5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {partner.businessName}
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-orange-50 text-orange-800 border border-orange-200">
                                  {partner.partnerType}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {partner.contactName} · <span className="font-mono">{partner.phone}</span>
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {partner.location}
                                {partner.specialty ? ` · ${partner.specialty}` : ''}
                              </p>
                              {partner.status === 'rejected' && partner.rejectionReason && (
                                <p className="text-[11px] text-red-700 mt-1 max-w-xs line-clamp-2">
                                  Reason: {partner.rejectionReason}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {partner.proofUrl ? (
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewingProofPartner(partner)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-700 rounded-md transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View Proof</span>
                                  </button>
                                  {partner.proofType && (
                                    <p className="text-[11px] text-slate-500 max-w-[160px] truncate">
                                      {partner.proofType}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">No proof uploaded</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-bold text-emerald-800 whitespace-nowrap">
                              {partner.referralCode}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-800 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {loyaltyItems} items · {partner.ordersCount} orders · {formatCurrency(partner.totalSpent)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {partner.referralsCount} ref · {formatCurrency(partner.referredRevenue)}
                              </div>
                              <div className="text-[11px] text-emerald-700 font-semibold">
                                Credit: {formatCurrency(partner.referralCreditBalance || 0)}
                                {(partner.referralCreditPending || 0) > 0 && (
                                  <span className="text-amber-700 font-normal">
                                    {' '}
                                    ({formatCurrency(partner.referralCreditPending || 0)} pending fit)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <Percent className="w-3.5 h-3.5 text-orange-600" />
                                <select
                                  aria-label={`Discount tier for ${partner.businessName}`}
                                  disabled={isBusy}
                                  value={effectiveTier}
                                  onChange={(e) =>
                                    void handleUpdatePartner(partner.id, {
                                      discountTierPercent: Number(e.target.value),
                                    })
                                  }
                                  className="px-2 py-1 text-xs font-mono font-semibold border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
                                >
                                  {Array.from(
                                    new Set([
                                      PARTNER_BASE_DISCOUNT_PCT,
                                      PARTNER_REGULAR_3_DISCOUNT_PCT,
                                      4,
                                      PARTNER_REGULAR_6_DISCOUNT_PCT,
                                      effectiveTier,
                                    ]),
                                  )
                                    .sort((a, b) => a - b)
                                    .map((pct) => (
                                      <option key={pct} value={pct}>
                                        {pct}% Base
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {statusBadge(partner.status)}
                            </td>
                            <td className="py-3 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {partner.status === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        void handleUpdatePartner(partner.id, { status: 'active' })
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-md transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => {
                                        setRejectingPartner(partner);
                                        setRejectionReasonDraft('');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-60 rounded-md transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                )}
                                {partner.status === 'active' && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleUpdatePartner(partner.id, { status: 'paused' })
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-md border bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 transition-colors"
                                  >
                                    Pause
                                  </button>
                                )}
                                {partner.status === 'paused' && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleUpdatePartner(partner.id, { status: 'active' })
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-md border bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  >
                                    Reactivate
                                  </button>
                                )}
                                {partner.status === 'rejected' && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleUpdatePartner(partner.id, { status: 'active' })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB: ORDER SMS, MANUAL STATUS DISPATCH & SMS LOG */}
      {activeTab === 'orderSms' && (() => {
        const isManualEntry = (entry: SmsNotificationRecord) =>
          Boolean(entry.isManual) ||
          entry.type === 'manual_status' ||
          entry.createdBy.includes('Connectivity Test') ||
          entry.audienceLabel.startsWith('Connectivity Test') ||
          entry.audienceLabel.startsWith('Manual ');

        const manualSmsCount = smsLogs.filter(isManualEntry).length;
        const automatedSmsCount = smsLogs.length - manualSmsCount;
        const phoneAppSmsCount = smsLogs.filter(
          (l) => l.deliveryChannel === 'phone_sms_app',
        ).length;

        const qSms = smsLogSearchQuery.trim().toLowerCase();
        const filteredSmsLogs = smsLogs.filter((entry) => {
          const entryManual = isManualEntry(entry);
          if (smsLogScopeFilter === 'manual' && !entryManual) return false;
          if (smsLogScopeFilter === 'automated' && entryManual) return false;

          if (smsLogChannelFilter === 'phone_sms_app' && entry.deliveryChannel !== 'phone_sms_app') {
            return false;
          }
          if (
            smsLogChannelFilter === 'test' &&
            !entry.createdBy.includes('Connectivity Test') &&
            !entry.orderStatusLabel?.startsWith('Test')
          ) {
            return false;
          }
          if (
            smsLogChannelFilter === 'admin_direct' &&
            (entry.deliveryChannel === 'phone_sms_app' ||
              entry.createdBy.includes('Connectivity Test'))
          ) {
            return false;
          }

          if (!qSms) return true;
          const recipientsBlob = entry.recipients
            .map((r) => `${r.phone} ${r.name || ''}`)
            .join(' ');
          return `${entry.message} ${entry.audienceLabel} ${entry.orderStatusLabel || ''} ${
            entry.receiptNumber || ''
          } ${entry.createdBy} ${recipientsBlob}`
            .toLowerCase()
            .includes(qSms);
        });

        const currentComposedMessage =
          testSmsCustomMessage.trim() ||
          buildManualOrderSmsTemplate(testSmsStatus, testSmsReceiptRef, smsComposerMode);

        return (
          <div className="space-y-6">
            {/* Top Status & Automated Order SMS Toggle */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-slate-900">
                    <Smartphone className="w-4 h-4 text-orange-600" />
                    <span>Automated Order Status Update SMS</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-emerald-700">
                    Always Active from Admin Number ({adminSenderPhone})
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Order confirmations and every status update (Pending, Shipped, Delivered, and Garage Bay fitting updates) automatically send an SMS from Admin ({adminSenderPhone}) to the customer, mechanic, and garage numbers. All automated and manual SMS communications are recorded in the SMS Log below.
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-0.5 tabular-nums">
                  <span className="text-slate-600">
                    Sender (Admin):{' '}
                    <strong className="font-mono text-slate-900">{adminSenderPhone}</strong>
                  </span>
                  <span className="text-slate-600">
                    Automated Updates: <strong className="font-mono text-slate-900">{automatedSmsCount}</strong>
                  </span>
                  <span className="text-slate-600">
                    Manually Sent / Tests: <strong className="font-mono text-slate-900">{manualSmsCount}</strong>
                  </span>
                  <span className="text-slate-600">
                    Phone App Sends: <strong className="font-mono text-slate-900">{phoneAppSmsCount}</strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveSmsSettings({ adminSenderPhone: adminSenderPhoneDraft.trim() });
                  }}
                  className="flex items-center gap-1.5"
                >
                  <label htmlFor="admin-sms-sender-input" className="sr-only">
                    Admin Sender Phone Number
                  </label>
                  <input
                    id="admin-sms-sender-input"
                    type="tel"
                    value={adminSenderPhoneDraft}
                    onChange={(e) => setAdminSenderPhoneDraft(e.target.value)}
                    placeholder="+254706130014"
                    className="w-36 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  <button
                    type="submit"
                    disabled={savingSmsSettings}
                    className="px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {savingSmsSettings ? 'Saving...' : 'Save Number'}
                  </button>
                </form>

                <button
                  type="button"
                  disabled={savingSmsSettings}
                  onClick={() =>
                    void handleSaveSmsSettings({ autoOrderSmsEnabled: !autoOrderSmsEnabled })
                  }
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                    autoOrderSmsEnabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      autoOrderSmsEnabled ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  />
                  <span>
                    Auto Order Status SMS: {autoOrderSmsEnabled ? 'Active' : 'Paused'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void loadSmsDashboard()}
                  disabled={loadingSms}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSms ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {smsSettingsNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
                <span>{smsSettingsNotice}</span>
                <button
                  type="button"
                  onClick={() => setSmsSettingsNotice(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-0.5"
                  aria-label="Dismiss SMS settings notice"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {smsError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {smsError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Connectivity Test & Manual SMS Composer */}
              <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      {smsComposerMode === 'test'
                        ? 'Test Order Status SMS'
                        : 'Send Manual / Custom SMS'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {smsComposerMode === 'test'
                        ? `Send a test order status SMS directly from Admin ${adminSenderPhone} to any customer, mechanic, or garage number to verify direct connectivity.`
                        : `Order status updates send automatically on Receipts changes. Use this form only for ad-hoc or custom messages recorded in the SMS Log.`}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 self-start">
                    <button
                      type="button"
                      onClick={() => {
                        setSmsComposerMode('test');
                        setTestSmsError(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        smsComposerMode === 'test'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Connectivity Test
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSmsComposerMode('manual');
                        setTestSmsError(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        smsComposerMode === 'manual'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Manual / Custom SMS
                    </button>
                  </div>
                </div>

                {testSmsError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {testSmsError}
                  </div>
                )}

                {testSmsResult && (
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          SMS logged &amp; sent from{' '}
                          <span className="font-mono">{testSmsResult.entry.senderPhone || adminSenderPhone}</span>{' '}
                          to <span className="font-mono">{testSmsResult.phone}</span>.
                        </p>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Recorded in the SMS Log below with timestamp, recipient number, and message content.
                        </p>
                      </div>
                    </div>
                    <div className="pl-6">
                      <a
                        href={`sms:${testSmsResult.phone}?body=${encodeURIComponent(testSmsResult.message)}`}
                        onClick={() => {
                          if (testSmsResult.entry.deliveryChannel !== 'phone_sms_app') {
                            void handleOpenPhoneSmsAndLog({
                              phone: testSmsResult.phone,
                              recipientName: testSmsRecipientName.trim(),
                              recipientRole: testSmsRecipientRole,
                              statusLabel: testSmsResult.entry.orderStatusLabel || testSmsStatus,
                              receiptNumber: testSmsResult.entry.receiptNumber || testSmsReceiptRef.trim() || undefined,
                              message: testSmsResult.message,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors"
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>Open in Phone SMS App</span>
                      </a>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendTestOrderSms} className="space-y-3.5">
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-600 font-medium">Sender (From):</span>
                    <span className="font-mono font-bold text-slate-900">{adminSenderPhone} (Admin)</span>
                  </div>

                  {(orders.length > 0 || partners.length > 0) && (
                    <div>
                      <label
                        htmlFor="test-sms-quick-pick"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Quick Fill from Orders / Partners (Optional)
                      </label>
                      <select
                        id="test-sms-quick-pick"
                        value=""
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (!raw) return;
                          const [role, phone, name, recNum, ordStatus] = raw.split('||');
                          if (phone) setTestSmsPhone(phone);
                          if (name) setTestSmsRecipientName(name);
                          if (role === 'Mechanic' || role === 'Garage' || role === 'Customer') {
                            setTestSmsRecipientRole(role);
                          }
                          setTestSmsReceiptRef(recNum || '');
                          if (
                            ordStatus === 'Pending' ||
                            ordStatus === 'Shipped' ||
                            ordStatus === 'Delivered'
                          ) {
                            setTestSmsStatus(ordStatus);
                          }
                          setTestSmsError(null);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                      >
                        <option value="">Select a customer, mechanic, or garage number...</option>
                        {orders.slice(0, 15).map((o) => (
                          <option
                            key={`ord-${o.id}`}
                            value={`Customer||${o.customerPhone}||${o.customerName}||${o.receiptNumber}||${normalizeOrderStatus(o.status)}`}
                          >
                            Customer: {o.customerName} · {o.customerPhone} ({o.receiptNumber} · {normalizeOrderStatus(o.status)})
                          </option>
                        ))}
                        {partners
                          .filter((p) => p.status === 'active')
                          .slice(0, 15)
                          .map((p) => {
                            const role = p.partnerType === 'garage' ? 'Garage' : 'Mechanic';
                            return (
                              <option
                                key={`ptr-${p.id}`}
                                value={`${role}||${p.phone}||${p.businessName}||||`}
                              >
                                {role}: {p.businessName} · {p.phone}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="test-sms-phone"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Recipient Phone Number
                      </label>
                      <input
                        id="test-sms-phone"
                        type="tel"
                        required
                        value={testSmsPhone}
                        onChange={(e) => {
                          setTestSmsPhone(e.target.value);
                          setTestSmsError(null);
                        }}
                        placeholder="e.g. 0712345678 or +254712345678"
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="test-sms-receipt-ref"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Receipt / Order Ref (Optional)
                      </label>
                      <input
                        id="test-sms-receipt-ref"
                        type="text"
                        value={testSmsReceiptRef}
                        onChange={(e) => setTestSmsReceiptRef(e.target.value)}
                        placeholder={smsComposerMode === 'test' ? 'MSZ-TEST-001' : 'e.g. MSZ-2026-004'}
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor="test-sms-role"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Recipient Role
                      </label>
                      <select
                        id="test-sms-role"
                        value={testSmsRecipientRole}
                        onChange={(e) =>
                          setTestSmsRecipientRole(
                            e.target.value as 'Customer' | 'Mechanic' | 'Garage',
                          )
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                      >
                        <option value="Customer">Customer</option>
                        <option value="Mechanic">Mechanic</option>
                        <option value="Garage">Garage</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="test-sms-status"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        SMS Status
                      </label>
                      <select
                        id="test-sms-status"
                        value={testSmsStatus}
                        onChange={(e) =>
                          setTestSmsStatus(
                            e.target.value as
                              | 'Pending'
                              | 'Shipped'
                              | 'Delivered'
                              | 'In Bay'
                              | 'Completed'
                              | 'Custom',
                          )
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                        {smsComposerMode === 'manual' && (
                          <>
                            <option value="In Bay">Bay: In Bay</option>
                            <option value="Completed">Bay: Completed</option>
                            <option value="Custom">Custom Notice</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="test-sms-name"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Recipient Name
                      </label>
                      <input
                        id="test-sms-name"
                        type="text"
                        value={testSmsRecipientName}
                        onChange={(e) => setTestSmsRecipientName(e.target.value)}
                        placeholder="e.g. Peter Kamau"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="test-sms-message"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        SMS Message Content
                      </label>
                      {testSmsCustomMessage && (
                        <button
                          type="button"
                          onClick={() => setTestSmsCustomMessage('')}
                          className="text-[11px] font-semibold text-orange-700 hover:text-orange-800"
                        >
                          Reset to Status Template
                        </button>
                      )}
                    </div>
                    <textarea
                      id="test-sms-message"
                      rows={3}
                      maxLength={480}
                      value={testSmsCustomMessage || currentComposedMessage}
                      onChange={(e) => setTestSmsCustomMessage(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                    />
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                      {currentComposedMessage.length}/480 chars
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={sendingTestSms}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {sendingTestSms
                          ? 'Sending...'
                          : smsComposerMode === 'test'
                            ? 'Send Test Order Status SMS'
                            : 'Send & Log Manual SMS'}
                      </span>
                    </button>

                    {testSmsPhone.trim() ? (
                      <a
                        href={`sms:${testSmsPhone.trim()}?body=${encodeURIComponent(currentComposedMessage)}`}
                        onClick={() =>
                          void handleOpenPhoneSmsAndLog({
                            phone: testSmsPhone.trim(),
                            recipientName: testSmsRecipientName.trim(),
                            recipientRole: testSmsRecipientRole,
                            statusLabel: testSmsStatus,
                            receiptNumber: testSmsReceiptRef.trim() || undefined,
                            message: currentComposedMessage,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Smartphone className="w-4 h-4 text-orange-600" />
                        <span>Phone SMS App &amp; Log</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setTestSmsError('Enter a destination phone number to open Phone SMS App.')
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Phone SMS App &amp; Log</span>
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {/* Right: Recent Orders Quick Manual SMS Pre-Fill */}
              <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Quick Order Communication Shortcuts
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any recent order to pre-fill a manual customer status update from {adminSenderPhone}.
                  </p>
                </div>

                {orders.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500">
                    No customer orders recorded yet. Orders created at checkout appear here for 1-click SMS pre-fill.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {orders.slice(0, 5).map((ord) => {
                      const ordStatus = normalizeOrderStatus(ord.status);
                      return (
                        <div
                          key={`quick-ord-${ord.id}`}
                          className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {ord.customerName} ·{' '}
                              <span className="font-mono text-slate-700">{ord.customerPhone}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              <span className="font-mono">{ord.receiptNumber}</span> ·{' '}
                              <span
                                className={
                                  ordStatus === 'Delivered'
                                    ? 'text-emerald-700 font-semibold'
                                    : ordStatus === 'Shipped'
                                      ? 'text-sky-700 font-semibold'
                                      : 'text-amber-700 font-semibold'
                                }
                              >
                                {ordStatus}
                              </span>{' '}
                              · <span className="font-mono tabular-nums">{formatCurrency(ord.total)}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSmsComposerMode('manual');
                              setTestSmsPhone(ord.customerPhone);
                              setTestSmsRecipientName(ord.customerName);
                              setTestSmsRecipientRole('Customer');
                              setTestSmsReceiptRef(ord.receiptNumber);
                              setTestSmsStatus(ordStatus);
                              setTestSmsCustomMessage(
                                buildManualOrderSmsTemplate(ordStatus, ord.receiptNumber, 'manual', ord.total),
                              );
                              setTestSmsError(null);
                              setTestSmsResult(null);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            Pre-fill SMS
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* FULL-WIDTH DEDICATED SMS LOG SECTION */}
            <section
              id="sms-log-section"
              aria-labelledby="sms-log-heading"
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 id="sms-log-heading" className="font-display text-lg font-bold text-slate-900">
                    SMS Log
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Records all manually sent SMS statuses — including timestamp, recipient number, status, and full message content — alongside automated order notifications from <span className="font-mono text-slate-700">{adminSenderPhone}</span>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={filteredSmsLogs.length === 0}
                    onClick={() => handleExportSmsLogCsv(filteredSmsLogs)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  {smsLogs.length > 0 && (
                    confirmClearSmsLogs ? (
                      <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                        <span className="text-xs text-red-800 font-medium">Clear all?</span>
                        <button
                          type="button"
                          onClick={() => void handleClearSmsLogs()}
                          className="px-2 py-0.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearSmsLogs(false)}
                          className="px-1.5 py-0.5 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearSmsLogs(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Log</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                  <button
                    type="button"
                    onClick={() => setSmsLogScopeFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      smsLogScopeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All SMS ({smsLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmsLogScopeFilter('automated')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      smsLogScopeFilter === 'automated'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Automated Order Updates ({automatedSmsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmsLogScopeFilter('manual')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      smsLogScopeFilter === 'manual'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Manually Sent ({manualSmsCount})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      aria-label="Search SMS Log"
                      value={smsLogSearchQuery}
                      onChange={(e) => setSmsLogSearchQuery(e.target.value)}
                      placeholder="Search number, message, receipt..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                    />
                  </div>

                  <select
                    aria-label="Filter SMS channel"
                    value={smsLogChannelFilter}
                    onChange={(e) =>
                      setSmsLogChannelFilter(
                        e.target.value as 'all' | 'admin_direct' | 'phone_sms_app' | 'test',
                      )
                    }
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    <option value="all">All Channels</option>
                    <option value="admin_direct">Admin Direct SMS</option>
                    <option value="phone_sms_app">Phone SMS App</option>
                    <option value="test">Connectivity Test</option>
                  </select>
                </div>
              </div>

              {loadingSms && smsLogs.length === 0 ? (
                <div className="p-8 text-sm text-slate-500">Loading SMS Log history...</div>
              ) : filteredSmsLogs.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    {smsLogs.length === 0
                      ? 'No SMS statuses have been logged yet.'
                      : smsLogScopeFilter === 'manual' && !qSms && smsLogChannelFilter === 'all'
                        ? 'No manually sent SMS statuses recorded yet.'
                        : 'No SMS log entries match your current filter or search.'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Send a manual status update using the composer above, update single or bulk order statuses in the Receipts tab, or switch to All SMS to view automated order updates.
                  </p>
                  {(qSms || smsLogChannelFilter !== 'all' || (smsLogScopeFilter !== 'all' && smsLogs.length > 0)) && (
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                      {(qSms || smsLogChannelFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSmsLogSearchQuery('');
                            setSmsLogChannelFilter('all');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Clear Search &amp; Channel Filter
                        </button>
                      )}
                      {smsLogScopeFilter !== 'all' && smsLogs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSmsLogScopeFilter('all')}
                          className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                        >
                          View All SMS ({smsLogs.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-5 whitespace-nowrap">Timestamp</th>
                        <th className="py-3 px-4 whitespace-nowrap">Recipient Number</th>
                        <th className="py-3 px-4 whitespace-nowrap">Status &amp; Source</th>
                        <th className="py-3 px-4 min-w-[320px]">Message Content</th>
                        <th className="py-3 px-5 text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm align-top">
                      {filteredSmsLogs.map((log) => {
                        const formattedTime = new Date(log.createdAt).toLocaleString('en-KE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        });
                        const entryManual = isManualEntry(log);
                        const primaryPhone = log.recipients[0]?.phone || '';
                        const sourceLabel =
                          log.deliveryChannel === 'phone_sms_app'
                            ? 'Phone SMS App'
                            : log.createdBy.includes('Connectivity Test')
                              ? 'Connectivity Test'
                              : entryManual
                                ? 'Manual Admin SMS'
                                : 'Auto Order SMS';
                        const statusDisplay =
                          log.orderStatusLabel ||
                          (log.type === 'order_confirmation'
                            ? 'Order Confirmed'
                            : log.type === 'fitting_status'
                              ? 'Garage Fitting'
                              : log.type === 'partner_approval'
                                ? 'Partner Approved'
                                : log.type === 'referral_credit'
                                  ? 'Referral Credit'
                                  : log.type === 'bargain_update'
                                    ? 'Bargain Update'
                                    : 'Order Status');

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                            <td
                              className="py-3.5 px-5 text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap"
                              title={log.createdAt}
                            >
                              {formattedTime}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="space-y-1">
                                {log.recipients.map((rec) => (
                                  <div key={`${log.id}-${rec.phone}`} className="text-xs">
                                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                                      {rec.phone}
                                    </span>
                                    {rec.name && (
                                      <span className="text-slate-500 block text-[11px] truncate max-w-[200px]">
                                        {rec.name}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {log.receiptNumber && (
                                  <span className="block text-[11px] font-mono text-slate-500">
                                    Ref: {log.receiptNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="text-xs space-y-0.5">
                                <span
                                  className={`font-semibold block ${
                                    log.failedCount > 0
                                      ? 'text-amber-700'
                                      : entryManual
                                        ? 'text-orange-700'
                                        : 'text-emerald-700'
                                  }`}
                                >
                                  {statusDisplay}
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  {sourceLabel} · {log.sentCount}/{log.recipientCount} sent
                                </span>
                                <span className="text-[11px] text-slate-400 block">
                                  From {log.senderPhone || adminSenderPhone} · {log.createdBy}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words max-w-xl">
                                {log.message}
                              </p>
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                {primaryPhone && (
                                  <a
                                    href={`sms:${primaryPhone}?body=${encodeURIComponent(log.message)}`}
                                    className="text-xs font-semibold text-orange-700 hover:text-orange-800 underline"
                                  >
                                    Open Phone SMS
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteSmsLog(log.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  aria-label={`Delete SMS dispatch ${log.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        );
      })()}

      {/* ADMIN-ONLY: FILLABLE SPARE PART SOURCING & MECHANIC FITTING LOG */}
      {activeTab === 'partLogs' && (() => {
        const q = partLogSearchQuery.trim().toLowerCase();
        const inStoreCount = partSourcingLogs.filter((r) => r.sourceType === 'in_store').length;
        const outsideShopCount = partSourcingLogs.filter((r) => r.sourceType === 'outside_shop').length;
        const fittedByUsCount = partSourcingLogs.filter((r) => r.fittedByOurMechanic).length;
        const notFittedByUsCount = partSourcingLogs.filter((r) => !r.fittedByOurMechanic).length;

        const staffFilterOptions = Array.from(
          new Set(
            partSourcingLogs.map((r) => r.handledBy?.trim() || '').filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));

        const mechanicFilterOptions = Array.from(
          new Set(
            partSourcingLogs.map((r) => r.mechanicName?.trim() || '').filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));

        const filteredPartLogs = partSourcingLogs.filter((row) => {
          if (partLogSourceFilter === 'in_store' && row.sourceType !== 'in_store') return false;
          if (partLogSourceFilter === 'outside_shop' && row.sourceType !== 'outside_shop') return false;
          if (partLogSourceFilter === 'fitted_by_us' && !row.fittedByOurMechanic) return false;
          if (partLogSourceFilter === 'not_fitted_by_us' && row.fittedByOurMechanic) return false;

          if (partLogStaffFilter === '__unassigned__') {
            if ((row.handledBy || '').trim() !== '') return false;
          } else if (partLogStaffFilter !== 'all') {
            if ((row.handledBy || '').trim().toLowerCase() !== partLogStaffFilter.toLowerCase()) {
              return false;
            }
          }

          if (partLogMechanicFilter === '__unassigned__') {
            if (!row.fittedByOurMechanic || (row.mechanicName || '').trim() !== '') return false;
          } else if (partLogMechanicFilter !== 'all') {
            if ((row.mechanicName || '').trim().toLowerCase() !== partLogMechanicFilter.toLowerCase()) {
              return false;
            }
          }

          if (partLogDateFrom && row.date < partLogDateFrom) return false;
          if (partLogDateTo && row.date > partLogDateTo) return false;

          if (!q) return true;
          const sourceText = row.sourceType === 'outside_shop' ? 'outside shop' : 'in store my spare zone';
          const fitmentText = row.fittedByOurMechanic ? 'fitted by our mechanic' : 'not fitted by us';
          return (
            row.date.toLowerCase().includes(q) ||
            row.partName.toLowerCase().includes(q) ||
            (row.category || '').toLowerCase().includes(q) ||
            (row.sku || '').toLowerCase().includes(q) ||
            (row.receiptNumber || '').toLowerCase().includes(q) ||
            (row.sourceShopName || '').toLowerCase().includes(q) ||
            (row.clientName || '').toLowerCase().includes(q) ||
            (row.handledBy || '').toLowerCase().includes(q) ||
            (row.mechanicName || '').toLowerCase().includes(q) ||
            (row.notes || '').toLowerCase().includes(q) ||
            sourceText.includes(q) ||
            fitmentText.includes(q)
          );
        });

        const hasActivePartLogFilters =
          Boolean(q) ||
          partLogSourceFilter !== 'all' ||
          partLogStaffFilter !== 'all' ||
          partLogMechanicFilter !== 'all' ||
          Boolean(partLogDateFrom) ||
          Boolean(partLogDateTo);

        const resetPartLogFilters = () => {
          setPartLogSearchQuery('');
          setPartLogSourceFilter('all');
          setPartLogStaffFilter('all');
          setPartLogMechanicFilter('all');
          setPartLogDateFrom('');
          setPartLogDateTo('');
        };

        const mechanicNameSuggestions = Array.from(
          new Set(
            [
              ...partners
                .filter((p) => p.status === 'active')
                .map((p) => p.contactName || p.businessName),
              ...partSourcingLogs
                .map((r) => r.mechanicName?.trim() || '')
                .filter(Boolean),
            ].filter(Boolean),
          ),
        );
        const handlerNameSuggestions = Array.from(
          new Set(
            partSourcingLogs.map((r) => r.handledBy?.trim() || '').filter(Boolean),
          ),
        );

        return (
          <div className="space-y-6">
            <datalist id="admin-catalog-parts-list">
              {parts.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <datalist id="admin-mechanics-list">
              {mechanicNameSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <datalist id="admin-handlers-list">
              {handlerNameSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500">Total Parts Documented</p>
                <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {partSourcingLogs.length}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500">Sourced In Store</p>
                <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                  {inStoreCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500">Sourced Outside (Other Shop)</p>
                <p className="font-display text-2xl font-bold text-amber-700 tabular-nums mt-1">
                  {outsideShopCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500">Fitted by Our Mechanic</p>
                <p className="font-display text-2xl font-bold text-orange-700 tabular-nums mt-1">
                  {fittedByUsCount}
                </p>
              </div>
            </div>

            {/* Sourcing Breakdown Chart by Category (In-Store vs Outside Suppliers) */}
            <PartSourcingChart
              logs={filteredPartLogs}
              allLogsCount={partSourcingLogs.length}
              parts={parts}
              orders={orders}
              onFilterByPartName={(term) => {
                setPartLogSourceFilter('outside_shop');
                setPartLogSearchQuery(term);
              }}
            />

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Spare Parts Sourcing, Client Handler &amp; Mechanic Fitting Log
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Admin-only fillable table documenting every spare part bought, whether it was sourced in-store or from an outside shop, who handled the client, and our mechanic who fitted it. Edits save automatically.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(recentPurchasedOptions.length > 0 || inventoryCatalogOptions.length > 0) && (
                    <select
                      aria-label="Quick add recently purchased or inventory part"
                      disabled={addingPartLogRow}
                      value={quickAddPartSelection}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuickAddPartSelection(val);
                        if (val) void handleAddPartLogFromCatalogSelection(val);
                      }}
                      className="max-w-[240px] px-2.5 py-2 text-xs font-medium text-slate-800 bg-orange-50/70 hover:bg-orange-50 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 disabled:opacity-60"
                    >
                      <option value="">+ Quick Add Recent / Inventory...</option>
                      {recentPurchasedOptions.length > 0 && (
                        <optgroup label="Recently Purchased Parts">
                          {recentPurchasedOptions.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.name}
                              {opt.category ? ` (${opt.category})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {inventoryCatalogOptions.length > 0 && (
                        <optgroup label="All Inventory Parts">
                          {inventoryCatalogOptions.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.name} · {opt.category}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={addingPartLogRow}
                    onClick={() => void handleAddBlankPartLogRow()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{addingPartLogRow ? 'Adding Row...' : 'Add Fillable Row'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={syncingPartLogs}
                    onClick={() => void handleSyncPartLogsFromOrders()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingPartLogs ? 'animate-spin' : ''}`} />
                    <span>{syncingPartLogs ? 'Syncing...' : 'Sync From Orders'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={filteredPartLogs.length === 0}
                    onClick={() => handleExportPartLogsPdf(filteredPartLogs)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-orange-600" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    disabled={filteredPartLogs.length === 0}
                    onClick={() => handleExportPartLogsCsv(filteredPartLogs)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {partLogNotice && (
                <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2">
                  <span>{partLogNotice}</span>
                  <button
                    type="button"
                    onClick={() => setPartLogNotice(null)}
                    className="text-emerald-700 hover:text-emerald-900"
                    aria-label="Dismiss notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="relative w-full lg:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={partLogSearchQuery}
                      onChange={(e) => setPartLogSearchQuery(e.target.value)}
                      placeholder="Search part, SKU, receipt, client, shop, staff, mechanic..."
                      className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                    {partLogSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPartLogSearchQuery('')}
                        aria-label="Clear part log search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                    {(
                      [
                        { id: 'all', label: `All (${partSourcingLogs.length})` },
                        { id: 'in_store', label: `In Store (${inStoreCount})` },
                        { id: 'outside_shop', label: `Outside Shop (${outsideShopCount})` },
                        { id: 'fitted_by_us', label: `Fitted by Us (${fittedByUsCount})` },
                        { id: 'not_fitted_by_us', label: `No Fitment (${notFittedByUsCount})` },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPartLogSourceFilter(opt.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          partLogSourceFilter === opt.id
                            ? 'bg-white text-slate-900 shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Staff Handler, Mechanic & Date Range Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <Filter className="w-3.5 h-3.5" />
                      <span>Staff &amp; Maintenance Filters:</span>
                    </div>

                    <select
                      aria-label="Filter by shop staff handler"
                      value={partLogStaffFilter}
                      onChange={(e) => setPartLogStaffFilter(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    >
                      <option value="all">All Staff Handlers</option>
                      <option value="__unassigned__">Unassigned Staff (Needs Entry)</option>
                      {staffFilterOptions.map((staff) => (
                        <option key={staff} value={staff}>
                          Staff: {staff}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter by mechanic"
                      value={partLogMechanicFilter}
                      onChange={(e) => setPartLogMechanicFilter(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    >
                      <option value="all">All Mechanics</option>
                      <option value="__unassigned__">Fitted · Missing Mechanic Name</option>
                      {mechanicFilterOptions.map((mech) => (
                        <option key={mech} value={mech}>
                          Mechanic: {mech}
                        </option>
                      ))}
                    </select>

                    <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-0.5">
                      <span className="text-[11px] text-slate-500">From:</span>
                      <input
                        type="date"
                        aria-label="Part log start date"
                        value={partLogDateFrom}
                        onChange={(e) => setPartLogDateFrom(e.target.value)}
                        className="text-xs font-mono text-slate-700 bg-transparent focus:outline-none py-0.5"
                      />
                    </div>

                    <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-0.5">
                      <span className="text-[11px] text-slate-500">To:</span>
                      <input
                        type="date"
                        aria-label="Part log end date"
                        value={partLogDateTo}
                        onChange={(e) => setPartLogDateTo(e.target.value)}
                        className="text-xs font-mono text-slate-700 bg-transparent focus:outline-none py-0.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      Showing {filteredPartLogs.length} of {partSourcingLogs.length} records
                    </span>
                    {hasActivePartLogFilters && (
                      <button
                        type="button"
                        onClick={resetPartLogFilters}
                        className="px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {loadingPartLogs && partSourcingLogs.length === 0 ? (
                <div className="p-8 text-sm text-slate-500">Loading parts sourcing &amp; fitting log...</div>
              ) : filteredPartLogs.length === 0 ? (
                <div className="p-8 text-sm text-slate-500 flex flex-col items-start gap-3">
                  <p>
                    {partSourcingLogs.length === 0
                      ? 'No spare part sourcing records yet. Click "Add Fillable Row" to type a new entry or "Sync From Orders" to pull parts from completed orders.'
                      : 'No maintenance or sourcing records match your active search or filters.'}
                  </p>
                  {partSourcingLogs.length === 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleAddBlankPartLogRow()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Row</span>
                      </button>
                      {orders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleSyncPartLogsFromOrders()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync {orders.length} Orders</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    hasActivePartLogFilters && (
                      <button
                        type="button"
                        onClick={resetPartLogFilters}
                        className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                      >
                        Reset Filters
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1160px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="py-3 px-3 w-[135px]">Date &amp; Ref</th>
                        <th className="py-3 px-3 w-[275px]">Spare Part, Category &amp; Qty</th>
                        <th className="py-3 px-3 w-[160px]">Client / Vehicle</th>
                        <th className="py-3 px-3 w-[210px]">Sourced From</th>
                        <th className="py-3 px-3 w-[155px]">Handled By (Staff)</th>
                        <th className="py-3 px-3 w-[215px]">Our Mechanic Fitting</th>
                        <th className="py-3 px-3 w-[155px]">Notes</th>
                        <th className="py-3 px-3 text-right w-[105px]">Status / Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs align-top">
                      {filteredPartLogs.map((row) => {
                        const isSaving = Boolean(savingPartLogIds[row.id]);
                        const isDirty = Boolean(dirtyPartLogIds[row.id]);
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 space-y-1.5">
                              <input
                                type="date"
                                aria-label="Purchase date"
                                value={row.date}
                                onChange={(e) => {
                                  const nextDate = e.target.value;
                                  updateLocalPartLogField(row.id, 'date', nextDate);
                                  if (/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
                                    void persistPartLogRow(row.id, { date: nextDate });
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                              />
                              <input
                                type="text"
                                aria-label="Receipt number"
                                value={row.receiptNumber || ''}
                                onChange={(e) =>
                                  updateLocalPartLogField(row.id, 'receiptNumber', e.target.value)
                                }
                                onBlur={() => {
                                  if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                }}
                                placeholder="Receipt # (opt.)"
                                className="w-full px-2 py-1 text-[11px] font-mono border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                              />
                            </td>

                            <td className="py-2.5 px-3 space-y-1.5">
                              {(recentPurchasedOptions.length > 0 ||
                                inventoryCatalogOptions.length > 0) && (
                                <select
                                  aria-label="Auto-fill part name and category from recent purchases or inventory"
                                  value=""
                                  onChange={(e) => {
                                    const picked = partOptionByKey.get(e.target.value);
                                    if (!picked) return;
                                    updateLocalPartLogField(row.id, 'partName', picked.name);
                                    if (picked.category) {
                                      updateLocalPartLogField(row.id, 'category', picked.category);
                                    }
                                    if (picked.sku) {
                                      updateLocalPartLogField(row.id, 'sku', picked.sku);
                                    }
                                    void persistPartLogRow(row.id, {
                                      partName: picked.name,
                                      ...(picked.category ? { category: picked.category } : {}),
                                      ...(picked.sku ? { sku: picked.sku } : {}),
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 rounded bg-slate-50 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-600"
                                >
                                  <option value="">Auto-fill from recent / inventory...</option>
                                  {recentPurchasedOptions.length > 0 && (
                                    <optgroup label="Recently Purchased Parts">
                                      {recentPurchasedOptions.map((opt) => (
                                        <option key={opt.key} value={opt.key}>
                                          {opt.name}
                                          {opt.category ? ` · ${opt.category}` : ''}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {inventoryCatalogOptions.length > 0 && (
                                    <optgroup label="Inventory Catalog">
                                      {inventoryCatalogOptions.map((opt) => (
                                        <option key={opt.key} value={opt.key}>
                                          {opt.name} · {opt.category}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              )}
                              <input
                                type="text"
                                list="admin-catalog-parts-list"
                                aria-label="Spare part bought"
                                value={row.partName}
                                onChange={(e) => {
                                  const nextName = e.target.value;
                                  updateLocalPartLogField(row.id, 'partName', nextName);
                                  const matchedOpt = partOptionByLowerName.get(
                                    nextName.trim().toLowerCase(),
                                  );
                                  if (matchedOpt) {
                                    if (matchedOpt.category) {
                                      updateLocalPartLogField(
                                        row.id,
                                        'category',
                                        matchedOpt.category,
                                      );
                                    }
                                    if (matchedOpt.sku && !(row.sku || '').trim()) {
                                      updateLocalPartLogField(row.id, 'sku', matchedOpt.sku);
                                    }
                                  }
                                }}
                                onBlur={() => {
                                  if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void persistPartLogRow(row.id);
                                }}
                                placeholder="Type spare part bought..."
                                className="w-full px-2 py-1 text-xs font-medium text-slate-900 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                              />
                              <select
                                aria-label="Part category"
                                value={row.category || ''}
                                onChange={(e) => {
                                  const nextCategory = e.target.value;
                                  updateLocalPartLogField(row.id, 'category', nextCategory);
                                  void persistPartLogRow(row.id, { category: nextCategory });
                                }}
                                className="w-full px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                              >
                                <option value="">Category (auto / select)...</option>
                                {PRIMARY_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                                <option value="Other / Custom">Other / Custom</option>
                              </select>
                              <div className="flex items-center gap-1.5">
                                <label className="text-[11px] text-slate-500">Qty:</label>
                                <input
                                  type="number"
                                  min={1}
                                  aria-label="Quantity"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateLocalPartLogField(
                                      row.id,
                                      'quantity',
                                      Math.max(1, Math.floor(Number(e.target.value) || 1)),
                                    )
                                  }
                                  onBlur={() => {
                                    if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                  }}
                                  className="w-16 px-2 py-0.5 text-[11px] font-mono tabular-nums border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                                />
                                <input
                                  type="text"
                                  aria-label="Part SKU"
                                  value={row.sku || ''}
                                  onChange={(e) =>
                                    updateLocalPartLogField(row.id, 'sku', e.target.value)
                                  }
                                  onBlur={() => {
                                    if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                  }}
                                  placeholder="SKU"
                                  className="flex-1 min-w-0 px-2 py-0.5 text-[11px] font-mono border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                                />
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                aria-label="Client or vehicle"
                                value={row.clientName || ''}
                                onChange={(e) =>
                                  updateLocalPartLogField(row.id, 'clientName', e.target.value)
                                }
                                onBlur={() => {
                                  if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void persistPartLogRow(row.id);
                                }}
                                placeholder="e.g. Samuel · KDA 123A"
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                              />
                            </td>

                            <td className="py-2.5 px-3 space-y-1.5">
                              <select
                                aria-label="Part source"
                                value={row.sourceType}
                                onChange={(e) => {
                                  const nextSource = e.target.value as PartSourceType;
                                  updateLocalPartLogField(row.id, 'sourceType', nextSource);
                                  if (nextSource === 'in_store') {
                                    updateLocalPartLogField(row.id, 'sourceShopName', '');
                                  }
                                  void persistPartLogRow(row.id, {
                                    sourceType: nextSource,
                                    sourceShopName:
                                      nextSource === 'in_store' ? '' : row.sourceShopName,
                                  });
                                }}
                                className={`w-full px-2 py-1 text-xs font-semibold rounded border focus:outline-none focus:ring-1 focus:ring-orange-600 ${
                                  row.sourceType === 'outside_shop'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                }`}
                              >
                                <option value="in_store">In Store (My Spare Zone)</option>
                                <option value="outside_shop">Outside (Another Shop)</option>
                              </select>
                              {row.sourceType === 'outside_shop' ? (
                                <input
                                  type="text"
                                  aria-label="Outside shop name"
                                  value={row.sourceShopName || ''}
                                  onChange={(e) =>
                                    updateLocalPartLogField(
                                      row.id,
                                      'sourceShopName',
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() => {
                                    if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void persistPartLogRow(row.id);
                                  }}
                                  placeholder="Enter outside shop name..."
                                  className="w-full px-2 py-1 text-xs border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                                />
                              ) : (
                                <p className="text-[11px] text-slate-400 px-1">
                                  My Spare Zone stock
                                </p>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                list="admin-handlers-list"
                                aria-label="Person who handled client"
                                value={row.handledBy}
                                onChange={(e) =>
                                  updateLocalPartLogField(row.id, 'handledBy', e.target.value)
                                }
                                onBlur={() => {
                                  if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void persistPartLogRow(row.id);
                                }}
                                placeholder="Staff who handled client"
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                              />
                            </td>

                            <td className="py-2.5 px-3 space-y-1.5">
                              <select
                                aria-label="Fitted by our mechanic"
                                value={row.fittedByOurMechanic ? 'yes' : 'no'}
                                onChange={(e) => {
                                  const fitted = e.target.value === 'yes';
                                  updateLocalPartLogField(row.id, 'fittedByOurMechanic', fitted);
                                  if (!fitted) {
                                    updateLocalPartLogField(row.id, 'mechanicName', '');
                                  }
                                  void persistPartLogRow(row.id, {
                                    fittedByOurMechanic: fitted,
                                    mechanicName: fitted ? row.mechanicName : '',
                                  });
                                }}
                                className={`w-full px-2 py-1 text-xs font-semibold rounded border focus:outline-none focus:ring-1 focus:ring-orange-600 ${
                                  row.fittedByOurMechanic
                                    ? 'bg-orange-50 text-orange-900 border-orange-300'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                <option value="no">Not Fitted by Us</option>
                                <option value="yes">Fitted by Our Mechanic</option>
                              </select>
                              {row.fittedByOurMechanic ? (
                                <input
                                  type="text"
                                  list="admin-mechanics-list"
                                  aria-label="Mechanic who fitted part"
                                  value={row.mechanicName || ''}
                                  onChange={(e) =>
                                    updateLocalPartLogField(
                                      row.id,
                                      'mechanicName',
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() => {
                                    if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void persistPartLogRow(row.id);
                                  }}
                                  placeholder="Enter mechanic name..."
                                  className="w-full px-2 py-1 text-xs border border-orange-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                                />
                              ) : (
                                <p className="text-[11px] text-slate-400 px-1">
                                  No in-house fitting
                                </p>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                aria-label="Row notes"
                                value={row.notes || ''}
                                onChange={(e) =>
                                  updateLocalPartLogField(row.id, 'notes', e.target.value)
                                }
                                onBlur={() => {
                                  if (dirtyPartLogIds[row.id]) void persistPartLogRow(row.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void persistPartLogRow(row.id);
                                }}
                                placeholder="Optional remarks"
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-600"
                              />
                            </td>

                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {isSaving ? (
                                  <span className="text-[11px] font-medium text-slate-500">
                                    Saving...
                                  </span>
                                ) : isDirty ? (
                                  <button
                                    type="button"
                                    onClick={() => void persistPartLogRow(row.id)}
                                    className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors"
                                  >
                                    Save
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700">
                                    <Check className="w-3 h-3" />
                                    <span>Saved</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleDeletePartLogRow(row.id)}
                                  aria-label={`Delete row for ${row.partName || 'part'}`}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 4: MOST SEARCHED PRODUCTS & LOGS */}
      {activeTab === 'searchLogs' && (
        <div className="space-y-6">
          {/* #1 Most Searched Product Highlight */}
          {searchLogs.length > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                  #1 Most Searched Product
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold mt-1">
                  “{searchLogs[0].term}”
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 tabular-nums">
                  Searched <strong className="text-white">{searchLogs[0].count}</strong>{' '}
                  {searchLogs[0].count === 1 ? 'time' : 'times'} ·{' '}
                  {searchLogs[0].matchingPartsCount === 0
                    ? 'Missing from catalog (0 matches)'
                    : `${searchLogs[0].matchingPartsCount} catalog matches · ${searchLogs[0].inStockCount} in stock`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStockFromSearchTerm(searchLogs[0].term)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Stock “{searchLogs[0].term}”</span>
              </button>
            </div>
          )}

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Total Logged Searches</p>
              <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {searchLogs.reduce((sum, item) => sum + item.count, 0)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Unique Search Terms</p>
              <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {searchLogs.length}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Unstocked / Zero-Stock Requests</p>
              <p className="font-display text-2xl font-bold text-orange-700 tabular-nums mt-1">
                {searchLogs.filter((item) => item.inStockCount === 0).length}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Popular Customer Search Terms
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked by search frequency so you can stock spare parts customers ask for most.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadSearchLogs()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSearchLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                {searchLogs.length > 0 && (
                  confirmClearLogs ? (
                    <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                      <span className="text-xs text-red-800 font-medium">Clear logs?</span>
                      <button
                        type="button"
                        onClick={() => void handleClearSearchLogs()}
                        className="px-2 py-0.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearLogs(false)}
                        className="px-1.5 py-0.5 text-xs text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearLogs(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Logs</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {loadingSearchLogs && searchLogs.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">Loading search logs...</div>
            ) : searchLogs.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">
                No customer search queries have been logged yet. Once shoppers search the catalog, their most popular terms appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-5">Rank</th>
                      <th className="py-3 px-4">Search Term</th>
                      <th className="py-3 px-4 text-right">Searches</th>
                      <th className="py-3 px-4">Catalog Availability</th>
                      <th className="py-3 px-4">Last Searched</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {searchLogs.map((entry, idx) => {
                      const needsStock = entry.inStockCount === 0;
                      const formattedTime = new Date(entry.lastSearchedAt).toLocaleString('en-KE', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      });

                      return (
                        <tr key={entry.normalizedTerm} className="hover:bg-slate-50">
                          <td className="py-3 px-5 font-mono text-xs text-slate-500 tabular-nums">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {entry.term}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                            {entry.count}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {entry.matchingPartsCount === 0 ? (
                              <span className="font-semibold text-orange-700">
                                Missing from catalog (0 matches)
                              </span>
                            ) : needsStock ? (
                              <span className="font-semibold text-amber-700">
                                {entry.matchingPartsCount} listed · 0 in stock
                              </span>
                            ) : (
                              <span className="font-medium text-emerald-700 tabular-nums">
                                {entry.matchingPartsCount} {entry.matchingPartsCount === 1 ? 'match' : 'matches'} · {entry.inStockCount} in stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                            {formattedTime}
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStockFromSearchTerm(entry.term)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors whitespace-nowrap"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Stock Part</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDismissSearchLog(entry.normalizedTerm)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                aria-label={`Remove "${entry.term}" from search logs`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BARGAINS & PRICE NEGOTIATION MANAGEMENT TAB */}
      {activeTab === 'bargains' && (() => {
        const pendingBargains = bargains.filter((b) => b.status === 'pending');
        const counteredBargains = bargains.filter((b) => b.status === 'countered');
        const acceptedBargains = bargains.filter((b) => b.status === 'accepted');
        const redeemedBargains = bargains.filter((b) => b.status === 'redeemed');
        const closedBargains = bargains.filter(
          (b) => b.status === 'rejected' || b.status === 'expired',
        );

        const q = bargainSearchQuery.trim().toLowerCase();
        const filteredBargains = bargains.filter((b) => {
          if (bargainStatusFilter === 'closed') {
            if (b.status !== 'rejected' && b.status !== 'expired') {
              return false;
            }
          } else if (bargainStatusFilter !== 'all' && b.status !== bargainStatusFilter) {
            return false;
          }

          if (!q) return true;
          const haystack = [
            b.bargainCode,
            b.customerName,
            b.customerPhone,
            b.redeemedReceiptNumber || '',
            ...b.items.map((it) => `${it.name} ${it.sku}`),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        });

        const statusBadgeMap: Record<
          BargainStatus,
          { label: string; badgeClass: string }
        > = {
          pending: {
            label: 'Awaiting Review',
            badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          },
          countered: {
            label: 'Counter Sent',
            badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
          },
          accepted: {
            label: 'Accepted · Ready',
            badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          },
          redeemed: {
            label: 'Redeemed in Order',
            badgeClass: 'bg-slate-900 text-white border-slate-900',
          },
          rejected: {
            label: 'Declined / Closed',
            badgeClass: 'bg-red-50 text-red-700 border-red-200',
          },
          expired: {
            label: 'Expired',
            badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
          },
        };

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Handshake className="w-5 h-5 text-orange-600" />
                  <span>Customer Bargains &amp; Price Negotiation Desk</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Review customer price offers (0%–20% discount or custom KSh price), send counter-offers, configure fallback auto-accept limits, and track redeemed deals. Parts with a secret Floor Price auto-accept offers ≥ floor and auto-reject offers below floor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadAdminBargains()}
                disabled={loadingBargains}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBargains ? 'animate-spin' : ''}`} />
                <span>Refresh Offers</span>
              </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Pending Review
                </p>
                <p className="text-2xl font-mono tabular-nums font-bold text-amber-600 mt-1">
                  {pendingBargains.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Needs shop decision</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Countered Active
                </p>
                <p className="text-2xl font-mono tabular-nums font-bold text-blue-700 mt-1">
                  {counteredBargains.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Awaiting customer reply</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Accepted &amp; Open
                </p>
                <p className="text-2xl font-mono tabular-nums font-bold text-emerald-700 mt-1">
                  {acceptedBargains.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Ready for checkout</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Redeemed Orders
                </p>
                <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                  {redeemedBargains.length}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                  {formatCurrency(
                    redeemedBargains.reduce(
                      (sum, b) => sum + (b.agreedTotal ?? b.offeredTotal),
                      0,
                    ),
                  )}{' '}
                  closed
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 lg:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Auto-Accept Limit
                </p>
                <p className="text-2xl font-mono tabular-nums font-bold text-orange-600 mt-1">
                  {bargainSettings.autoAcceptMaxDiscountPct}%
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {bargainSettings.autoAcceptMaxDiscountPct === 0
                    ? 'Manual review only'
                    : 'Max automatic discount'}
                </p>
              </div>
            </div>

            {/* Auto-Accept Settings & SMS Toggle */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Automatic Bargaining Rules &amp; SMS Dispatch
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Set a max discount percentage (0%–{BARGAIN_MAX_DISCOUNT_PCT}%) when no part-level floor price is configured. If a spare part has a secret Floor Price set, offers ≥ floor auto-accept and offers below floor auto-decline.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg cursor-pointer self-start lg:self-auto">
                  <input
                    type="checkbox"
                    checked={bargainSendSms}
                    onChange={(e) => setBargainSendSms(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-600"
                  />
                  <span>Auto-send SMS on Accept / Counter / Decline</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="bargain-auto-accept-input"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Auto-Accept Max Discount (%):
                  </label>
                  <input
                    id="bargain-auto-accept-input"
                    type="number"
                    min={0}
                    max={BARGAIN_MAX_DISCOUNT_PCT}
                    value={autoAcceptDraftPct}
                    onChange={(e) => setAutoAcceptDraftPct(e.target.value)}
                    className="w-20 px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {BARGAIN_PRESET_DISCOUNTS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      disabled={savingBargainSettings}
                      onClick={() => {
                        setAutoAcceptDraftPct(String(pct));
                        void handleSaveAutoAcceptThreshold(pct);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                        bargainSettings.autoAcceptMaxDiscountPct === pct
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pct === 0 ? 'Manual (0%)' : `${pct}% Max`}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={savingBargainSettings}
                  onClick={() => void handleSaveAutoAcceptThreshold()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingBargainSettings ? 'Saving...' : 'Save Rule'}</span>
                </button>
              </div>

              {bargainNotice && (
                <div className="px-3.5 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-2">
                  <span>{bargainNotice}</span>
                  <button
                    type="button"
                    onClick={() => setBargainNotice(null)}
                    className="text-emerald-700 hover:text-emerald-900"
                    aria-label="Dismiss bargain notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {bargainError && (
                <div className="px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                  <span>{bargainError}</span>
                  <button
                    type="button"
                    onClick={() => setBargainError(null)}
                    className="text-red-600 hover:text-red-900"
                    aria-label="Dismiss bargain error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </section>

            {/* Filter & Search Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: `All (${bargains.length})` },
                    { key: 'pending', label: `Pending (${pendingBargains.length})` },
                    { key: 'countered', label: `Countered (${counteredBargains.length})` },
                    { key: 'accepted', label: `Accepted (${acceptedBargains.length})` },
                    { key: 'redeemed', label: `Redeemed (${redeemedBargains.length})` },
                    { key: 'closed', label: `Closed (${closedBargains.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBargainStatusFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                      bargainStatusFilter === tab.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={bargainSearchQuery}
                  onChange={(e) => setBargainSearchQuery(e.target.value)}
                  placeholder="Search code, customer, phone, part..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-600"
                />
              </div>
            </div>

            {/* Bargains List */}
            {loadingBargains && bargains.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Loading customer bargains...
              </div>
            ) : filteredBargains.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                <Handshake className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">
                  No bargain requests match this filter.
                </p>
                <p className="text-xs text-slate-500">
                  When customers propose a target price on a spare part or full cart, their requests appear here immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBargains.map((b) => {
                  const statusMeta = statusBadgeMap[b.status];
                  const activeSavings = b.listedSubtotal - (b.agreedTotal ?? b.counterTotal ?? b.offeredTotal);
                  const offeredDiscountPct =
                    b.listedSubtotal > 0
                      ? Math.round(((b.listedSubtotal - b.offeredTotal) / b.listedSubtotal) * 100)
                      : 0;
                  const isUpdating = updatingBargainId === b.id;
                  const isCountering = counteringBargainId === b.id;
                  const isHistoryOpen = Boolean(expandedBargainHistoryIds[b.id]);
                  const canRespond = b.status === 'pending' || b.status === 'countered';
                  const acceptTargetAmount =
                    b.status === 'countered' && typeof b.counterTotal === 'number'
                      ? b.counterTotal
                      : b.offeredTotal;

                  return (
                    <article
                      key={b.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4"
                    >
                      {/* Top Header */}
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-200">
                              {b.bargainCode}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                              Updated{' '}
                              {new Date(b.updatedAt).toLocaleString('en-KE', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="font-semibold text-slate-900 text-sm">
                              {b.customerName}
                            </span>
                            <span className="font-mono tabular-nums text-slate-700">
                              {b.customerPhone}
                            </span>
                            {b.redeemedReceiptNumber && (
                              <span className="font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                Receipt {b.redeemedReceiptNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Pricing Comparison */}
                        <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 shrink-0">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Listed Price
                            </p>
                            <p className="text-sm font-mono tabular-nums font-semibold text-slate-700">
                              {formatCurrency(b.listedSubtotal)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Customer Offer
                            </p>
                            <p className="text-sm font-mono tabular-nums font-bold text-orange-700">
                              {formatCurrency(b.offeredTotal)}
                            </p>
                            <p className="text-[10px] font-mono tabular-nums text-orange-600">
                              -{offeredDiscountPct}% off
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              {b.agreedTotal !== undefined
                                ? 'Agreed Deal'
                                : b.counterTotal !== undefined
                                  ? 'Shop Counter'
                                  : 'Gap'}
                            </p>
                            <p className="text-sm font-mono tabular-nums font-bold text-slate-900">
                              {b.agreedTotal !== undefined
                                ? formatCurrency(b.agreedTotal)
                                : b.counterTotal !== undefined
                                  ? formatCurrency(b.counterTotal)
                                  : `-${formatCurrency(activeSavings)}`}
                            </p>
                            {(b.agreedTotal !== undefined || b.counterTotal !== undefined) && (
                              <p className="text-[10px] font-mono tabular-nums text-emerald-700">
                                Save {formatCurrency(activeSavings)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="bg-slate-50/70 border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                              <th className="py-2 px-3">Spare Part</th>
                              <th className="py-2 px-3 whitespace-nowrap">SKU</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Qty</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Unit Listed</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Line Listed</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/80">
                            {b.items.map((item) => (
                              <tr key={`${b.id}-${item.partId}`}>
                                <td className="py-2 px-3 font-medium text-slate-900">
                                  {item.name}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                                  {item.sku}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                                  {item.quantity}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {formatCurrency(item.lineSubtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Notes */}
                      {(b.customerNote || b.adminNote) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {b.customerNote && (
                            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                              <span className="font-semibold text-slate-900">Customer note: </span>
                              {b.customerNote}
                            </div>
                          )}
                          {b.adminNote && (
                            <div className="px-3 py-2 rounded-lg bg-orange-50/70 border border-orange-200 text-slate-800">
                              <span className="font-semibold text-orange-800">Shop note: </span>
                              {b.adminNote}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Counter Offer Drawer / Controls */}
                      {canRespond && (
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
                            <input
                              type="text"
                              value={bargainAdminNoteDraft[b.id] ?? ''}
                              onChange={(e) =>
                                setBargainAdminNoteDraft((prev) => ({
                                  ...prev,
                                  [b.id]: e.target.value,
                                }))
                              }
                              placeholder="Optional note to customer (e.g., valid until evening pickup)..."
                              maxLength={280}
                              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-600"
                            />
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  void handleAdminBargainAction(b, 'accept', acceptTargetAmount)
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  {b.status === 'countered'
                                    ? `Force Accept (${formatCurrency(acceptTargetAmount)})`
                                    : `Accept ${formatCurrency(b.offeredTotal)}`}
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => {
                                  if (isCountering) {
                                    setCounteringBargainId(null);
                                  } else {
                                    const suggested = Math.round(
                                      (b.listedSubtotal + b.offeredTotal) / 2,
                                    );
                                    setCounterPriceDraft(
                                      String(b.counterTotal ?? suggested),
                                    );
                                    setCounteringBargainId(b.id);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Handshake className="w-3.5 h-3.5 text-orange-600" />
                                <span>{isCountering ? 'Cancel Counter' : 'Counter Offer'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void handleAdminBargainAction(b, 'reject')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Decline</span>
                              </button>
                            </div>
                          </div>

                          {isCountering && (
                            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-slate-700">
                                  Counter Price (KSh):
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={b.listedSubtotal}
                                  value={counterPriceDraft}
                                  onChange={(e) => setCounterPriceDraft(e.target.value)}
                                  className="w-32 px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCounterPriceDraft(
                                      String(Math.round((b.listedSubtotal + b.offeredTotal) / 2)),
                                    )
                                  }
                                  className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700"
                                >
                                  Midpoint
                                </button>
                                {[15, 10, 5, 2].map((pct) => (
                                  <button
                                    key={`counter-${pct}`}
                                    type="button"
                                    onClick={() =>
                                      setCounterPriceDraft(
                                        String(Math.round(b.listedSubtotal * (1 - pct / 100))),
                                      )
                                    }
                                    className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700"
                                  >
                                    -{pct}%
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void handleAdminBargainAction(b, 'counter')}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{isUpdating ? 'Sending...' : 'Send Counter-Offer'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {b.status === 'accepted' && (
                        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-emerald-700 font-medium">
                            Agreed at {formatCurrency(b.agreedTotal ?? b.offeredTotal)} — awaiting customer checkout redemption.
                          </span>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => void handleAdminBargainAction(b, 'reject')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Cancel Agreement</span>
                          </button>
                        </div>
                      )}

                      {/* Timeline Toggle */}
                      {b.history.length > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBargainHistoryIds((prev) => ({
                                ...prev,
                                [b.id]: !prev[b.id],
                              }))
                            }
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 underline underline-offset-2"
                          >
                            {isHistoryOpen
                              ? 'Hide negotiation history'
                              : `Show negotiation history (${b.history.length} events)`}
                          </button>

                          {isHistoryOpen && (
                            <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-1.5">
                              {b.history.map((entry, hIdx) => (
                                <div
                                  key={`${b.id}-hist-${hIdx}`}
                                  className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2"
                                >
                                  <span className="font-mono text-slate-400">
                                    {new Date(entry.createdAt).toLocaleString('en-KE', {
                                      dateStyle: 'short',
                                      timeStyle: 'short',
                                    })}
                                  </span>
                                  <span className="font-semibold text-slate-800 uppercase text-[10px]">
                                    {entry.actor === 'admin' ? 'Shop' : 'Customer'}
                                  </span>
                                  <span className="font-medium text-slate-700">
                                    {entry.action.replace('_', ' ')}
                                  </span>
                                  {typeof entry.amount === 'number' && (
                                    <span className="font-mono font-semibold text-slate-900">
                                      {formatCurrency(entry.amount)}
                                    </span>
                                  )}
                                  {entry.note && (
                                    <span className="text-slate-500 italic">“{entry.note}”</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Edit Part Modal */}
      {editingPart && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900 truncate pr-4">
                Edit {editingPart.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPart(null)}
                className="p-1 text-slate-400 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Item Pictures ({editImages.length}/3 · 1st is Cover Photo)
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {editImages.map((imgSrc, idx) => (
                    <div
                      key={`edit-img-${idx}`}
                      className="rounded-lg overflow-hidden border border-slate-200 bg-white"
                    >
                      <div className="aspect-4/3 bg-slate-100">
                        <PartImage
                          src={imgSrc}
                          alt={`${editName || editingPart.name} photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-1.5 py-1 flex items-center justify-between gap-1 bg-slate-50 border-t border-slate-200 text-[10px]">
                        {idx === 0 ? (
                          <span className="font-bold text-orange-700">Cover</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditCoverIndex(idx)}
                            className="font-semibold text-slate-700 hover:text-orange-700 underline"
                          >
                            Make Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeEditImage(idx)}
                          className="text-slate-400 hover:text-red-600 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {editImages.length < 3 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
                      <span>Upload Photo ({editImages.length}/3)</span>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEditFileChange}
                        className="sr-only"
                      />
                    </label>
                    <input
                      type="url"
                      value={editImageUrlInput}
                      onChange={(e) => setEditImageUrlInput(e.target.value)}
                      placeholder="Or paste photo URL..."
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={!editImageUrlInput.trim()}
                      onClick={handleAddEditImageUrl}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg border border-slate-200"
                    >
                      Add URL
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Car Type / Brand
                </label>
                <select
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value as CarBrand)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {PART_BRAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b === 'Universal' ? 'Universal / Multi-Brand' : b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Car Model (Optional)
                  </label>
                  <input
                    type="text"
                    value={editCarModel}
                    onChange={(e) => setEditCarModel(e.target.value)}
                    placeholder="e.g. Fielder, Premio"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Year of Make (Optional)
                  </label>
                  <input
                    type="text"
                    value={editYearOfMake}
                    onChange={(e) => setEditYearOfMake(e.target.value)}
                    placeholder="e.g. 2015 or 2012-2018"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    2. Part Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => handleEditCategoryChange(e.target.value as PrimaryCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {PRIMARY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    3. Part Type (Subcategory)
                  </label>
                  <select
                    value={editSubcategory}
                    onChange={(e) => setEditSubcategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {CATEGORY_SUBCATEGORIES[editCategory].map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editCategory === 'Body parts' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Body Part Condition Grade
                    </span>
                    {editConditionGrade && (
                      <button
                        type="button"
                        onClick={() => setEditConditionGrade('')}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                      >
                        Clear grade
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BODY_PART_CONDITION_GRADES.map((item) => {
                      const active = editConditionGrade === item.grade;
                      return (
                        <button
                          key={item.grade}
                          type="button"
                          onClick={() =>
                            setEditConditionGrade((curr) => (curr === item.grade ? '' : item.grade))
                          }
                          aria-pressed={active}
                          className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                            active
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          <span className="block text-xs font-bold">{item.title}</span>
                          <span
                            className={`block text-[10px] leading-tight mt-0.5 ${
                              active ? 'text-orange-100' : 'text-slate-500'
                            }`}
                          >
                            {item.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isEditGearbox && (
                <div className="bg-orange-50/70 border border-orange-200 rounded-lg p-3 space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Droplets className="w-3.5 h-3.5 text-orange-600" />
                    <span>Recommended Gearbox Oil Type *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editGearboxOilType}
                    onChange={(e) => setEditGearboxOilType(e.target.value)}
                    placeholder="e.g. CVT FE, CVT TC, ATF WS, or SAE 75W-90"
                    className="w-full px-3 py-2 text-sm bg-white border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Displayed to customers on the gearbox listing and oil recommendations.
                  </p>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Tag className="w-3.5 h-3.5 text-orange-600" />
                    <span>Pricing Mode</span>
                  </span>
                  <div
                    className="inline-flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg"
                    role="group"
                    aria-label="Edit part pricing mode"
                  >
                    <button
                      type="button"
                      onClick={() => setEditIsOffer(false)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        !editIsOffer
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Standard Price
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditIsOffer(true);
                        if (!editPreviousPrice.trim()) {
                          setEditPreviousPrice(editPrice || String(editingPart.price));
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        editIsOffer
                          ? 'bg-orange-600 text-white shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      List in Offers
                    </button>
                  </div>
                </div>

                {editIsOffer ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Previous Price (KSh)
                        </label>
                        <input
                          type="number"
                          min="2"
                          required
                          value={editPreviousPrice}
                          onChange={(e) => setEditPreviousPrice(e.target.value)}
                          placeholder="18500"
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-orange-800 mb-1">
                          Offer Price (KSh)
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-orange-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {(() => {
                      const prevNum = Number(editPreviousPrice);
                      const offerNum = Number(editPrice);
                      if (
                        editPreviousPrice.trim() &&
                        editPrice.trim() &&
                        Number.isFinite(prevNum) &&
                        Number.isFinite(offerNum) &&
                        prevNum > 0 &&
                        offerNum > 0
                      ) {
                        if (prevNum > offerNum) {
                          const saved = Math.round(prevNum - offerNum);
                          const pct = Math.max(1, Math.round((saved / prevNum) * 100));
                          return (
                            <p className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                              Offer preview: <span className="line-through text-slate-500 font-mono">{formatCurrency(Math.round(prevNum))}</span>{' '}
                              → <strong className="font-mono">{formatCurrency(Math.round(offerNum))}</strong> · Save{' '}
                              <strong className="font-mono">{formatCurrency(saved)}</strong> ({pct}% OFF)
                            </p>
                          );
                        }
                        return (
                          <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                            Offer price must be lower than the previous price.
                          </p>
                        );
                      }
                      return null;
                    })()}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Stock Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={editStock}
                        onChange={(e) => setEditStock(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Price (KSh)
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Stock Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={editStock}
                        onChange={(e) => setEditStock(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2.5 border-t border-slate-200/90 space-y-1">
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>Bargain Floor Price (KSh · Admin Only)</span>
                    <span className="text-[10px] font-medium text-slate-500">Hidden from buyers</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editFloorPrice}
                    onChange={(e) => setEditFloorPrice(e.target.value)}
                    placeholder="Optional minimum bargain price (clear to remove)"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partner Verification Proof Preview Modal */}
      {previewingProofPartner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proof-preview-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="min-w-0">
                <h3
                  id="proof-preview-modal-title"
                  className="font-display text-base sm:text-lg font-bold text-slate-900 truncate"
                >
                  Verification Proof · {previewingProofPartner.businessName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {previewingProofPartner.proofType || 'Mechanic / Garage Proof'} ·{' '}
                  {previewingProofPartner.contactName} ({previewingProofPartner.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingProofPartner(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-200/60"
                aria-label="Close proof preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div>
                  <span className="text-slate-500 block">Applicant Type</span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {previewingProofPartner.partnerType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Operating Location</span>
                  <span className="font-semibold text-slate-900">
                    {previewingProofPartner.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Specialty / File</span>
                  <span className="font-semibold text-slate-900 truncate block">
                    {previewingProofPartner.specialty ||
                      previewingProofPartner.proofFileName ||
                      'General Service'}
                  </span>
                </div>
              </div>

              {previewingProofPartner.proofUrl ? (
                previewingProofPartner.proofMimeType === 'application/pdf' ||
                previewingProofPartner.proofUrl.toLowerCase().endsWith('.pdf') ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                    <iframe
                      src={previewingProofPartner.proofUrl}
                      title={`Proof document for ${previewingProofPartner.businessName}`}
                      className="w-full h-[420px] bg-white"
                    />
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900/5 flex items-center justify-center max-h-[440px]">
                    <img
                      src={previewingProofPartner.proofUrl}
                      alt={`Verification proof for ${previewingProofPartner.businessName}`}
                      className="max-h-[440px] w-auto object-contain"
                    />
                  </div>
                )
              ) : (
                <div className="p-6 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg">
                  No proof file attached to this partner profile.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                {previewingProofPartner.proofUrl ? (
                  <a
                    href={previewingProofPartner.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-orange-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Original File in New Tab</span>
                  </a>
                ) : (
                  <span />
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {previewingProofPartner.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={updatingPartnerId === previewingProofPartner.id}
                      onClick={() => {
                        const target = previewingProofPartner;
                        setPreviewingProofPartner(null);
                        setRejectingPartner(target);
                        setRejectionReasonDraft('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Application</span>
                    </button>
                  )}
                  {previewingProofPartner.status !== 'active' && (
                    <button
                      type="button"
                      disabled={updatingPartnerId === previewingProofPartner.id}
                      onClick={async () => {
                        const id = previewingProofPartner.id;
                        await handleUpdatePartner(id, { status: 'active' });
                        setPreviewingProofPartner(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Partner &amp; Send SMS</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewingProofPartner(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partner Rejection Reason Modal */}
      {rejectingPartner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-partner-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3
                id="reject-partner-modal-title"
                className="font-display text-base font-bold text-slate-900"
              >
                Reject Partner Application
              </h3>
              <button
                type="button"
                onClick={() => setRejectingPartner(null)}
                className="p-1 text-slate-400 hover:text-slate-900 rounded-md"
                aria-label="Close reject modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const targetId = rejectingPartner.id;
                const reason = rejectionReasonDraft.trim();
                await handleUpdatePartner(targetId, {
                  status: 'rejected',
                  ...(reason ? { rejectionReason: reason } : {}),
                });
                setRejectingPartner(null);
                setRejectionReasonDraft('');
              }}
              className="p-6 space-y-4"
            >
              <p className="text-xs text-slate-600 leading-relaxed">
                Rejecting <strong>{rejectingPartner.businessName}</strong> keeps wholesale trade discounts disabled and allows the applicant to upload clearer verification proof.
              </p>
              <div>
                <label
                  htmlFor="partner-rejection-reason"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Reason Shown to Applicant (Optional)
                </label>
                <textarea
                  id="partner-rejection-reason"
                  rows={3}
                  value={rejectionReasonDraft}
                  onChange={(e) => setRejectionReasonDraft(e.target.value)}
                  placeholder="e.g. Uploaded photo is blurry. Please upload a clearer garage signboard or NITA certificate."
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingPartner(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPartnerId === rejectingPartner.id}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg"
                >
                  {updatingPartnerId === rejectingPartner.id ? 'Updating...' : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Order Details Modal + Print Packing Slip */}
      {activeOrderDetails && (() => {
        const order = activeOrderDetails;
        const orderStatus = normalizeOrderStatus(order.status);
        const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const issuedFormatted = new Date(order.issuedAt).toLocaleString('en-KE', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        return (
          <>
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 overflow-y-auto no-print"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-order-details-title"
            >
              <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">
                        {order.receiptNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">ID: {order.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{issuedFormatted}</span>
                    </div>
                    <h3
                      id="admin-order-details-title"
                      className="font-display text-lg font-bold text-slate-900 mt-0.5"
                    >
                      Order Details &amp; Shipping Summary
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveOrderDetails(null)}
                    aria-label="Close order details"
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                  {/* Customer & Shipping Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                      <p className="font-semibold text-slate-500">Customer &amp; Payment</p>
                      <p className="text-sm font-bold text-slate-900">{order.customerName}</p>
                      <p className="font-mono text-slate-700">{order.customerPhone}</p>
                      {order.customerEmail && (
                        <p className="text-slate-600">{order.customerEmail}</p>
                      )}
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <p className="text-slate-600">
                          <span className="font-semibold text-slate-800">Payment:</span>{' '}
                          {order.paymentMethod}
                        </p>
                        {order.mpesaReceiptNumber && (
                          <p className="font-mono text-emerald-700 font-semibold">
                            M-Pesa Ref: {order.mpesaReceiptNumber}
                          </p>
                        )}
                        {order.cardTransactionRef && (
                          <p className="font-mono text-emerald-700 font-semibold">
                            Card Ref: {order.cardTransactionRef} ({order.cardBrand || 'Card'} ••••{' '}
                            {order.cardLast4 || '****'})
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="font-semibold text-slate-700">Order Status:</span>
                          <select
                            aria-label={`Order status in details for ${order.receiptNumber}`}
                            value={orderStatus}
                            onChange={(e) =>
                              void handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)
                            }
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border focus:outline-none focus:ring-2 focus:ring-orange-600 ${
                              orderStatus === 'Delivered'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : orderStatus === 'Shipped'
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {ORDER_STATUSES.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {statusOption}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="font-semibold text-slate-700">Live Tracking:</span>
                          <select
                            aria-label={`Tracking stage in details for ${order.receiptNumber}`}
                            value={normalizeTrackingStage(order.trackingStage, orderStatus)}
                            onChange={(e) =>
                              void handleUpdateOrderTracking(
                                order.id,
                                e.target.value as OrderTrackingStage,
                              )
                            }
                            className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-600"
                          >
                            {ORDER_TRACKING_STAGES.map((opt) => (
                              <option key={opt.stage} value={opt.stage}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                      <p className="font-semibold text-slate-500">Shipping &amp; Fulfillment</p>
                      <p className="font-semibold text-slate-900">
                        {formatDeliveryRegionLabel(order.deliveryRegion)}
                      </p>
                      <p className="text-slate-700 leading-relaxed">{order.deliveryAddress}</p>
                      {order.deliveryRegion === 'nairobi' && Boolean(order.deliveryFee && order.deliveryFee > 0) && (
                        <p className="font-mono text-slate-800 font-semibold">
                          Delivery Fee: {formatCurrency(order.deliveryFee || 0)}
                          {typeof order.deliveryDistanceKm === 'number'
                            ? ` (~${order.deliveryDistanceKm.toFixed(1)} km · KSh 500/10km)`
                            : ''}
                        </p>
                      )}
                      {order.pickupCode && (
                        <div className="mt-1 p-2.5 rounded-lg bg-orange-50 border border-orange-200 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-orange-800">
                              Pickup Code: {order.pickupCode}
                            </span>
                            <span className="font-semibold text-[11px] text-slate-800 uppercase">
                              {order.pickupStatus === 'claimed'
                                ? 'Claimed'
                                : order.pickupStatus === 'expired_restocked'
                                  ? 'Expired & Restocked'
                                  : `Reserved ${PICKUP_RESERVATION_HOURS}h`}
                            </span>
                          </div>
                          {order.pickupBookingAgreement && (
                            <p className="text-[11px] text-slate-700 leading-relaxed">
                              {order.pickupBookingAgreement}
                            </p>
                          )}
                          {order.pickupStatus !== 'claimed' &&
                            order.pickupStatus !== 'expired_restocked' && (
                              <button
                                type="button"
                                disabled={claimingPickupId === order.id}
                                onClick={() => void handleClaimPickupOrder(order.id)}
                                className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>
                                  {claimingPickupId === order.id
                                    ? 'Confirming...'
                                    : 'Confirm Counter Handover'}
                                </span>
                              </button>
                            )}
                        </div>
                      )}
                      {order.courierName && (
                        <p className="text-slate-800">
                          <span className="font-semibold">Courier Service:</span>{' '}
                          {order.courierName}
                        </p>
                      )}
                      {order.fittingDate && (
                        <p className="text-emerald-800 font-medium">
                          Fitting Slot: {formatFittingDateLabel(order.fittingDate)} ·{' '}
                          {order.fittingSlotLabel || getGarageSlotLabel(order.fittingTimeSlot)} (
                          {order.fittingStatus || 'Scheduled'})
                        </p>
                      )}
                      {order.vehicleDetails && (
                        <p className="text-orange-800 font-medium">
                          Vehicle / Note: {order.vehicleDetails}
                        </p>
                      )}
                      {order.referralCodeUsed && (
                        <p className="text-slate-600 pt-1 border-t border-slate-100">
                          Referral Code:{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {order.referralCodeUsed}
                          </span>
                          {order.referralPartnerName ? ` (${order.referralPartnerName})` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {order.deliveryRegion === 'nairobi' && (
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-4 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-emerald-950">
                            Nairobi Rider Dispatch &amp; Live Tracking
                          </p>
                          <p className="text-[11px] text-emerald-800">
                            Live location is sent from the rider&apos;s WhatsApp to the customer&apos;s WhatsApp ({order.customerPhone}). Attach the rider&apos;s picture &amp; number plate here, and open the customer&apos;s WhatsApp chat to share live location.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={getWhatsAppPhoneUrl(
                              order.customerPhone,
                              `Hello ${order.customerName}, I am ${riderNameInput.trim() || 'your My Spare Zone rider'}${riderPlateInput.trim() ? ` (Plate: ${riderPlateInput.trim().toUpperCase()})` : ''} delivering order ${order.receiptNumber}${order.deliveryDestination ? ` to ${order.deliveryDestination}` : ''}. Sharing my WhatsApp live location with you shortly.`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Customer WhatsApp</span>
                          </a>
                          <button
                            type="button"
                            disabled={savingRiderDetails}
                            onClick={() => void handleSaveRiderDetails(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 rounded-md transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {savingRiderDetails ? 'Sharing...' : 'Save & Share Rider Details'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <label className="block space-y-1">
                          <span className="font-semibold text-slate-700">Rider Name</span>
                          <input
                            type="text"
                            value={riderNameInput}
                            onChange={(e) => setRiderNameInput(e.target.value)}
                            placeholder="e.g. Brian Kamau"
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="font-semibold text-slate-700">Number Plate</span>
                          <input
                            type="text"
                            value={riderPlateInput}
                            onChange={(e) => setRiderPlateInput(e.target.value.toUpperCase())}
                            placeholder="e.g. KMFD 123A"
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="font-semibold text-slate-700">Rider Phone</span>
                          <input
                            type="tel"
                            value={riderPhoneInput}
                            onChange={(e) => setRiderPhoneInput(e.target.value)}
                            placeholder="e.g. 0712 345 678"
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="font-semibold text-slate-700">Live Location Link</span>
                          <input
                            type="url"
                            value={riderLiveLocationUrlInput}
                            onChange={(e) => setRiderLiveLocationUrlInput(e.target.value)}
                            placeholder="https://maps.google.com/..."
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {riderPhotoUrlInput ? (
                          <img
                            src={riderPhotoUrlInput}
                            alt={riderNameInput || 'Assigned rider'}
                            className="w-12 h-12 rounded-lg object-cover border border-emerald-200 bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg border border-dashed border-emerald-300 bg-white flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                            No Photo
                          </div>
                        )}
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <span className="block font-semibold text-slate-700">
                            Rider Picture URL or Upload
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={riderPhotoUrlInput}
                              onChange={(e) => setRiderPhotoUrlInput(e.target.value)}
                              placeholder="https://... or upload rider photo"
                              className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  readImageFile(
                                    file,
                                    (dataUrl) => setRiderPhotoUrlInput(dataUrl),
                                    (msg) => setRiderSaveError(msg),
                                  );
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {riderSaveError && (
                        <p className="text-xs font-medium text-red-700">{riderSaveError}</p>
                      )}
                      {riderSaveNotice && (
                        <p className="text-xs font-medium text-emerald-700">{riderSaveNotice}</p>
                      )}
                    </div>
                  )}

                  {/* Order Summary Items Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Order Items Summary</span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {order.items.length} line{order.items.length === 1 ? '' : 's'} · {totalUnits}{' '}
                        unit{totalUnits === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                            <th className="py-2.5 px-4">Spare Part</th>
                            <th className="py-2.5 px-3">SKU</th>
                            <th className="py-2.5 px-3 text-right">Qty</th>
                            <th className="py-2.5 px-3 text-right">Unit</th>
                            <th className="py-2.5 px-4 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {order.items.map((item) => (
                            <tr key={item.partId}>
                              <td className="py-2.5 px-4">
                                <p className="font-semibold text-slate-900">{item.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {item.category}
                                  {item.subcategory ? ` · ${item.subcategory}` : ''}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {item.sku}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                {formatCurrency(item.unitPrice)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                {formatCurrency(item.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600">
                        Subtotal: <strong className="font-mono tabular-nums text-slate-900">{formatCurrency(order.subtotal)}</strong>
                        {Boolean(order.discountAmount && order.discountAmount > 0) && (
                          <>
                            {' '}
                            · Discount:{' '}
                            <strong className="font-mono tabular-nums text-emerald-700">
                              -{formatCurrency(order.discountAmount || 0)}
                            </strong>
                          </>
                        )}
                        {Boolean(order.deliveryFee && order.deliveryFee > 0) && (
                          <>
                            {' '}
                            · Delivery Fee:{' '}
                            <strong className="font-mono tabular-nums text-slate-900">
                              {formatCurrency(order.deliveryFee || 0)}
                            </strong>
                          </>
                        )}
                      </span>
                      <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                        Total: {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const target = order;
                      setActiveOrderDetails(null);
                      onViewReceipt(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Open Customer Receipt</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadPackingSlipPdf(order)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Packing Slip PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintPackingSlip}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Packing Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveOrderDetails(null)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-200/70 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Print-Only Packing Slip Document mounted at document.body so App .no-print wrapper does not hide it */}
            {typeof document !== 'undefined' &&
              createPortal(
                <div
                  className="hidden print:block bg-white text-slate-950 p-8 max-w-4xl mx-auto print-only-container"
                  aria-hidden="true"
                >
                  <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between gap-4">
                    <div>
                      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
                        MY SPARE ZONE — PACKING SLIP
                      </h1>
                      <p className="text-xs text-slate-600 mt-1">
                        {order.guaranteeText} · Seventies Plaza, Kirinyaga Rd · Care:{' '}
                        {order.customerCarePhone}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <p className="font-bold text-sm text-slate-950">{order.receiptNumber}</p>
                      <p className="text-slate-600">Order ID: {order.id}</p>
                      <p className="text-slate-600">{issuedFormatted}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6 text-xs border border-slate-300 rounded-lg p-4">
                    <div className="space-y-1">
                      <p className="font-bold uppercase tracking-wide text-slate-500">
                        Order Summary
                      </p>
                      <p>
                        <strong>Status:</strong> {orderStatus}
                      </p>
                      <p>
                        <strong>Payment Method:</strong> {order.paymentMethod}
                      </p>
                      <p>
                        <strong>Payment Status:</strong>{' '}
                        {order.paymentStatus || (order.saleConfirmed ? 'Confirmed' : 'Pending')}
                      </p>
                      <p>
                        <strong>Items to Pack:</strong> {order.items.length} line(s) ({totalUnits}{' '}
                        unit{totalUnits === 1 ? '' : 's'})
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold uppercase tracking-wide text-slate-500">
                        Ship To / Customer Details
                      </p>
                      <p className="text-sm font-bold text-slate-950">{order.customerName}</p>
                      <p className="font-mono">{order.customerPhone}</p>
                      <p>
                        <strong>Fulfillment:</strong>{' '}
                        {formatDeliveryRegionLabel(order.deliveryRegion)}
                      </p>
                      <p>
                        <strong>Shipping Address:</strong> {order.deliveryAddress}
                      </p>
                      {order.deliveryRegion === 'nairobi' && Boolean(order.deliveryFee && order.deliveryFee > 0) && (
                        <p>
                          <strong>Nairobi Delivery Fee:</strong> {formatCurrency(order.deliveryFee || 0)}
                          {typeof order.deliveryDistanceKm === 'number'
                            ? ` (~${order.deliveryDistanceKm.toFixed(1)} km · KSh 500/10km)`
                            : ''}
                        </p>
                      )}
                      {order.pickupCode && (
                        <p>
                          <strong>Counter Pickup Code:</strong> {order.pickupCode} (
                          {order.pickupStatus === 'claimed'
                            ? 'Claimed'
                            : order.pickupStatus === 'expired_restocked'
                              ? 'Expired & Restocked'
                              : `Reserved ${PICKUP_RESERVATION_HOURS}h`}
                          )
                        </p>
                      )}
                      {order.courierName && (
                        <p>
                          <strong>Courier Service:</strong> {order.courierName}
                        </p>
                      )}
                      {order.fittingDate && (
                        <p>
                          <strong>Garage Slot:</strong> {formatFittingDateLabel(order.fittingDate)} ·{' '}
                          {order.fittingSlotLabel || getGarageSlotLabel(order.fittingTimeSlot)} (
                          {order.fittingStatus || 'Scheduled'})
                        </p>
                      )}
                      {order.vehicleDetails && (
                        <p>
                          <strong>Vehicle / Note:</strong> {order.vehicleDetails}
                        </p>
                      )}
                    </div>
                  </div>

                  <table className="w-full text-left border-collapse border border-slate-300 text-xs mb-6">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                        <th className="py-2.5 px-3 border-r border-slate-300 w-10 text-center">
                          Pack
                        </th>
                        <th className="py-2.5 px-3 border-r border-slate-300 w-10 text-center">
                          #
                        </th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Spare Part</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">SKU</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 text-right">Qty</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 text-right">
                          Unit Price
                        </th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {order.items.map((item, idx) => (
                        <tr key={item.partId}>
                          <td className="py-2.5 px-3 border-r border-slate-300 text-center font-mono">
                            [ ]
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-300 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-300">
                            <p className="font-semibold text-slate-950">{item.name}</p>
                            <p className="text-[11px] text-slate-600">
                              {item.category}
                              {item.subcategory ? ` · ${item.subcategory}` : ''}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-300 font-mono">
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono font-bold tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono tabular-nums">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                            {formatCurrency(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex items-center justify-between text-xs border-t border-slate-300 pt-3 mb-8">
                    <span>
                      Subtotal: <strong className="font-mono">{formatCurrency(order.subtotal)}</strong>
                      {Boolean(order.discountAmount && order.discountAmount > 0) && (
                        <>
                          {' '}
                          · Discount:{' '}
                          <strong className="font-mono">
                            -{formatCurrency(order.discountAmount || 0)}
                          </strong>
                        </>
                      )}
                      {Boolean(order.deliveryFee && order.deliveryFee > 0) && (
                        <>
                          {' '}
                          · Delivery Fee:{' '}
                          <strong className="font-mono">
                            {formatCurrency(order.deliveryFee || 0)}
                          </strong>
                        </>
                      )}
                    </span>
                    <span className="text-sm font-bold font-mono tabular-nums">
                      Total: {formatCurrency(order.total)}
                    </span>
                  </div>

                  <div className="border-t border-slate-300 pt-4 text-xs text-slate-700 grid grid-cols-3 gap-4">
                    <div>Packed By: ______________________</div>
                    <div>Verified By: ____________________</div>
                    <div>Date / Time: ___________________</div>
                  </div>
                </div>,
                document.body,
              )}
          </>
        );
      })()}
    </main>
  );
}
