import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone,
  MessageSquare,
  Receipt,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  X,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import type {
  AuthUser,
  BargainOffer,
  CarBrand,
  CartItem,
  ChatMessage,
  CustomerReview,
  PrimaryCategory,
  SparePart,
  VirtualReceipt,
} from './types';
import {
  CUSTOMER_CARE_NUMBER,
  CUSTOMER_CARE_WHATSAPP_URL,
  doesPartMatchCustomerVehicle,
  formatCurrency,
  GEARBOX_OIL_PAIR_CANS,
  getLoyaltyMilestoneToastData,
  getMatchingGearboxOils,
  getPartnerLoyaltyItemsCount,
  GUARANTEE_NOTICE,
  isAccountProfessionalPartner,
  isGearboxPart,
  isJoinedPartnerProgram,
  normalizeOrderStatus,
  PHYSICAL_STORE_ADDRESS,
  PHYSICAL_STORE_HOURS,
  PHYSICAL_STORE_MAPS_URL,
  SHOP_NAME,
  type CustomerVehicleProfile,
  type LoyaltyMilestoneToastInfo,
} from './constants/catalog';
import { TopBar, type ActivePage } from './components/TopBar';
import { StorefrontView } from './components/StorefrontView';
import { OrderHistoryView } from './components/OrderHistoryView';
import { PartnerPortalView } from './components/PartnerPortalView';
import { AdminPortalView, type AdminTab } from './components/AdminPortalView';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { CustomerCareDrawer } from './components/CustomerCareDrawer';
import { BargainOfferModal, type BargainModalTarget } from './components/BargainOfferModal';
import { MyBargainsDrawer } from './components/MyBargainsDrawer';
import { PartDetailModal } from './components/PartDetailModal';
import { PartImage } from './components/PartImage';
import { GearboxOilPromptModal } from './components/GearboxOilPromptModal';
import { VirtualReceiptModal } from './components/VirtualReceiptModal';
import { AuthModal } from './components/AuthModal';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { PartnerProgramModal } from './components/PartnerProgramModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { SeoMetadata } from './components/SeoMetadata';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BrandWordmark } from './components/BrandWordmark';
import { MobileInstallBanner } from './components/MobileInstallBanner';
import {
  ChatNotificationBanner,
  type ChatAlertNotification,
} from './components/ChatNotificationBanner';
import { LoyaltyMilestoneToast } from './components/LoyaltyMilestoneToast';
import {
  getNotificationPermissionState,
  getOrCreateChatSessionId,
  playChatNotificationSound,
  requestChatNotificationPermission,
  showBrowserChatNotification,
  type BrowserNotificationState,
} from './utils/chatNotifications';

const CART_STORAGE_KEY = 'msz_shopping_cart_v1';
const LEGACY_ORDER_HISTORY_STORAGE_KEY = 'msz_order_history_v1';
const USER_ORDER_HISTORY_PREFIX = 'msz_order_history_v2_';
const AUTH_TOKEN_STORAGE_KEY = 'msz_auth_token_v1';
const RECENTLY_VIEWED_STORAGE_KEY = 'msz_recently_viewed_parts_v1';
const CUSTOMER_VEHICLE_STORAGE_KEY = 'msz_customer_vehicle_v1';
const MAX_RECENTLY_VIEWED = 5;

function loadSavedCustomerVehicle(): CustomerVehicleProfile {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_VEHICLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    return {
      brand: typeof obj.brand === 'string' ? (obj.brand as CarBrand | 'All' | '') : '',
      carModel: typeof obj.carModel === 'string' ? obj.carModel : '',
      yearOfMake: typeof obj.yearOfMake === 'string' ? obj.yearOfMake : '',
    };
  } catch {
    return {};
  }
}

function persistCustomerVehicle(vehicle: CustomerVehicleProfile) {
  try {
    window.localStorage.setItem(CUSTOMER_VEHICLE_STORAGE_KEY, JSON.stringify(vehicle));
  } catch {
    // ignore storage quota errors
  }
}

function getUserOrderHistoryKey(userId: string): string {
  return `${USER_ORDER_HISTORY_PREFIX}${userId}`;
}

function loadSavedCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadRecentlyViewedParts(): SparePart[] {
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SparePart =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as SparePart).id === 'string' &&
          typeof (item as SparePart).name === 'string' &&
          typeof (item as SparePart).price === 'number',
      )
      .slice(0, MAX_RECENTLY_VIEWED);
  } catch {
    return [];
  }
}

function loadUserOrderHistory(userId: string): VirtualReceipt[] {
  try {
    const raw = window.localStorage.getItem(getUserOrderHistoryKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VirtualReceipt[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((receipt) => !receipt.userId || receipt.userId === userId)
      .map((receipt) => ({
        ...receipt,
        status: normalizeOrderStatus(receipt.status),
      }));
  } catch {
    return [];
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('storefront');
  const [adminTab, setAdminTab] = useState<AdminTab>('inventory');

  // Storefront search & category filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | PrimaryCategory>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState<'All' | CarBrand>('All');

  // Parts catalog fetched from Express backend
  const [parts, setParts] = useState<SparePart[]>([]);
  const [allParts, setAllParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [adminPasswordAttempts, setAdminPasswordAttempts] = useState(0);
  const [securityLogoutNotice, setSecurityLogoutNotice] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);

  // Customer & Mechanic Reviews state
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [reviewsAvgRating, setReviewsAvgRating] = useState(5);

  // Wishlist & Offers filter state
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [wishlistFilterActive, setWishlistFilterActive] = useState(false);
  const [offersFilterActive, setOffersFilterActive] = useState(false);
  const [pendingWishlistPartId, setPendingWishlistPartId] = useState<string | null>(null);

  // Customer optional saved vehicle (car model & year of make)
  const [customerVehicle, setCustomerVehicle] = useState<CustomerVehicleProfile>(() =>
    loadSavedCustomerVehicle(),
  );
  const [matchMyCarOnly, setMatchMyCarOnly] = useState(false);

  // Cart, Receipts History & Drawers
  const [cart, setCart] = useState<CartItem[]>(() => loadSavedCart());
  const [recentlyViewedParts, setRecentlyViewedParts] = useState<SparePart[]>(() =>
    loadRecentlyViewedParts(),
  );
  const [orderHistory, setOrderHistory] = useState<VirtualReceipt[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [inspectedPart, setInspectedPart] = useState<SparePart | null>(null);
  const [gearboxOilPrompt, setGearboxOilPrompt] = useState<{
    gearbox: SparePart;
    quantity: number;
  } | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<VirtualReceipt | null>(null);
  const [loyaltyToast, setLoyaltyToast] = useState<LoyaltyMilestoneToastInfo | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [syncingStatuses, setSyncingStatuses] = useState(false);

  // Live Chat Notifications state
  const [chatSessionId] = useState<string>(() => getOrCreateChatSessionId());
  const [selectedAdminSessionId, setSelectedAdminSessionId] = useState<string | null>(null);
  const [latestChatMessage, setLatestChatMessage] = useState<ChatMessage | null>(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [unreadAdminBySession, setUnreadAdminBySession] = useState<Record<string, number>>({});
  const [chatAlert, setChatAlert] = useState<ChatAlertNotification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationState>(
    () => getNotificationPermissionState(),
  );
  const chatWsRef = useRef<WebSocket | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // Customer Bargaining & Negotiation state
  const [bargains, setBargains] = useState<BargainOffer[]>([]);
  const [loadingBargains, setLoadingBargains] = useState(false);
  const [isMyBargainsOpen, setIsMyBargainsOpen] = useState(false);
  const [bargainTarget, setBargainTarget] = useState<BargainModalTarget | null>(null);
  const [activeBargainId, setActiveBargainId] = useState<string | null>(null);
  const [latestBargainEvent, setLatestBargainEvent] = useState<BargainOffer | null>(null);

  const lastReceipt = currentUser && currentUser.role !== 'admin' ? (orderHistory[0] ?? null) : null;

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_ORDER_HISTORY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const fetchOrdersForUser = useCallback(async (token: string, userId: string) => {
    setSyncingStatuses(true);
    try {
      const res = await fetch('/api/orders?scope=mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { orders?: VirtualReceipt[] };
      if (Array.isArray(data.orders)) {
        const serverOrders = data.orders
          .filter((o) => !o.userId || o.userId === userId)
          .map((o) => ({
            ...o,
            status: normalizeOrderStatus(o.status),
          }))
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
        setOrderHistory(serverOrders);
        setActiveReceipt((curr) => {
          if (!curr) return curr;
          const match = serverOrders.find((o) => o.id === curr.id);
          return match ? { ...curr, ...match } : curr;
        });
      }
    } catch {
      // ignore transient network errors when offline
    } finally {
      setSyncingStatuses(false);
    }
  }, []);

  const fetchWishlistForUser = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/wishlist', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { partIds?: string[] };
      if (Array.isArray(data.partIds)) {
        setWishlistIds(data.partIds);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      setIsAdminVerified(false);
      setAdminPasswordAttempts(0);
      setOrderHistory([]);
      setWishlistIds([]);
      setWishlistFilterActive(false);
      return;
    }
    let cancelled = false;
    const verifySession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          if (!cancelled) {
            setAuthToken(null);
            setCurrentUser(null);
            setIsAdminVerified(false);
            setAdminPasswordAttempts(0);
            setOrderHistory([]);
            setWishlistIds([]);
            setWishlistFilterActive(false);
            window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          }
          return;
        }
        const data = (await res.json()) as {
          user?: AuthUser;
          adminVerified?: boolean;
          adminPasswordAttempts?: number;
        };
        if (!cancelled && data.user) {
          setCurrentUser(data.user);
          setIsAdminVerified(
            data.user.role !== 'admin' ? false : Boolean(data.adminVerified),
          );
          setAdminPasswordAttempts(data.adminPasswordAttempts || 0);
          if (data.user.role === 'admin') {
            setOrderHistory([]);
            setWishlistIds([]);
            setWishlistFilterActive(false);
            setIsWishlistOpen(false);
          } else {
            setOrderHistory(loadUserOrderHistory(data.user.id));
            setWishlistIds(Array.isArray(data.user.wishlistPartIds) ? data.user.wishlistPartIds : []);
            if (data.user.savedCarBrand || data.user.savedCarModel || data.user.savedCarYear) {
              const accountVehicle: CustomerVehicleProfile = {
                brand: data.user.savedCarBrand || '',
                carModel: data.user.savedCarModel || '',
                yearOfMake: data.user.savedCarYear || '',
              };
              setCustomerVehicle(accountVehicle);
              persistCustomerVehicle(accountVehicle);
            }
            void fetchWishlistForUser(authToken);
            void fetchOrdersForUser(authToken, data.user.id);
          }
        }
      } catch {
        // ignore transient network failure
      }
    };
    void verifySession();
    return () => {
      cancelled = true;
    };
  }, [authToken, fetchOrdersForUser, fetchWishlistForUser]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RECENTLY_VIEWED_STORAGE_KEY,
        JSON.stringify(recentlyViewedParts),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [recentlyViewedParts]);

  useEffect(() => {
    if (!currentUser) return;
    try {
      window.localStorage.setItem(
        getUserOrderHistoryKey(currentUser.id),
        JSON.stringify(orderHistory),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [currentUser, orderHistory]);

  const fetchFilteredParts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedCategory !== 'All') params.set('category', selectedCategory);
      if (selectedSubcategory !== 'All') params.set('subcategory', selectedSubcategory);
      if (selectedBrand !== 'All') params.set('brand', selectedBrand);

      const res = await fetch(`/api/parts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load spare parts');
      const data = (await res.json()) as { parts?: SparePart[] };
      setParts(Array.isArray(data.parts) ? data.parts : []);
    } catch {
      setError('Unable to reach My Spare Zone inventory server.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedSubcategory, selectedBrand]);

  const fetchAllPartsForAdmin = useCallback(async () => {
    try {
      const canRequestAdminFields = Boolean(
        currentUser?.role === 'admin' && isAdminVerified && authToken,
      );
      const res = await fetch('/api/parts', {
        headers: canRequestAdminFields ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (!res.ok) return;
      const data = (await res.json()) as { parts?: SparePart[] };
      if (Array.isArray(data.parts)) {
        setAllParts(data.parts);
      }
    } catch {
      // ignore
    }
  }, [currentUser?.role, isAdminVerified, authToken]);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews');
      if (!res.ok) return;
      const data = (await res.json()) as {
        reviews?: CustomerReview[];
        averageRating?: number;
      };
      if (Array.isArray(data.reviews)) {
        setReviews(data.reviews);
      }
      if (typeof data.averageRating === 'number') {
        setReviewsAvgRating(data.averageRating);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchFilteredParts();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [fetchFilteredParts]);

  useEffect(() => {
    void fetchAllPartsForAdmin();
    void fetchReviews();
  }, [fetchAllPartsForAdmin, fetchReviews]);

  const handleSelectCategory = (category: 'All' | PrimaryCategory) => {
    setSelectedCategory(category);
    setSelectedSubcategory('All');
  };

  const handleAddToCart = (part: SparePart, quantity = 1) => {
    const existingGearboxQty = cart.find((item) => item.part.id === part.id)?.quantity ?? 0;
    const nextGearboxQty = existingGearboxQty + quantity;

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.part.id === part.id);
      if (idx === -1) {
        return [...prev, { part, quantity }];
      }
      return prev.map((item, i) =>
        i === idx ? { ...item, quantity: item.quantity + quantity } : item,
      );
    });
    setRecentlyAddedId(part.id);
    window.setTimeout(() => {
      setRecentlyAddedId((curr) => (curr === part.id ? null : curr));
    }, 1200);

    if (!isCartOpen && isGearboxPart(part)) {
      const catalogSource = allParts.length > 0 ? allParts : parts;
      const matchingInfo = getMatchingGearboxOils(part, catalogSource);
      if (matchingInfo.oils.length > 0) {
        const specificOilIds = new Set(
          matchingInfo.exactOilIds.length > 0
            ? matchingInfo.exactOilIds
            : matchingInfo.oils.map((o) => o.id),
        );
        const matchingOilsInCart = cart
          .filter((item) => specificOilIds.has(item.part.id))
          .reduce((sum, item) => sum + item.quantity, 0);
        const recommendedCans = nextGearboxQty * GEARBOX_OIL_PAIR_CANS;
        if (matchingOilsInCart < recommendedCans) {
          setGearboxOilPrompt({ gearbox: part, quantity });
        }
      }
    }
  };

  const handleAddGearboxBundle = (
    gearbox: SparePart,
    gearboxQty: number,
    oil: SparePart,
    oilCans: number,
  ) => {
    setCart((prev) => {
      const next = [...prev];
      const addOrIncrement = (targetPart: SparePart, qty: number) => {
        if (qty <= 0) return;
        const idx = next.findIndex((item) => item.part.id === targetPart.id);
        if (idx === -1) {
          next.push({ part: targetPart, quantity: qty });
        } else {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        }
      };
      addOrIncrement(gearbox, gearboxQty);
      addOrIncrement(oil, oilCans);
      return next;
    });
    setGearboxOilPrompt(null);
    setRecentlyAddedId(gearbox.id);
    window.setTimeout(() => {
      setRecentlyAddedId((curr) => (curr === gearbox.id ? null : curr));
    }, 1200);
  };

  const handleUpdateQuantity = (partId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.part.id !== partId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.part.id === partId ? { ...item, quantity } : item)),
    );
  };

  const handleRemoveItem = (partId: string) => {
    setCart((prev) => prev.filter((item) => item.part.id !== partId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderCompleted = (receipt: VirtualReceipt) => {
    const normalized: VirtualReceipt = {
      ...receipt,
      status: normalizeOrderStatus(receipt.status),
    };
    if (currentUser && (!normalized.userId || normalized.userId === currentUser.id)) {
      setOrderHistory((prev) => [normalized, ...prev.filter((r) => r.id !== normalized.id)]);
    }
    setActiveReceipt(normalized);
    void fetchFilteredParts();
    void fetchAllPartsForAdmin();

    const prevPartner = currentUser?.partnerProfile;
    const previousItemsCount = getPartnerLoyaltyItemsCount(prevPartner);
    const orderedUnits = normalized.items.reduce((sum, item) => sum + item.quantity, 0);

    if (authToken && prevPartner) {
      void fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { user?: AuthUser } | null) => {
          const nextUser = data?.user;
          if (nextUser) {
            setCurrentUser(nextUser);
          }
          const nextPartner = nextUser?.partnerProfile ?? prevPartner;
          const nextItemsCount = nextUser?.partnerProfile
            ? getPartnerLoyaltyItemsCount(nextUser.partnerProfile)
            : previousItemsCount + orderedUnits;
          const isProFlagged = isJoinedPartnerProgram(nextPartner);
          const milestone = getLoyaltyMilestoneToastData({
            receiptId: normalized.id,
            receiptNumber: normalized.receiptNumber,
            previousItemsCount,
            currentItemsCount: nextItemsCount,
            partnerStatus: nextPartner?.status,
            isProfessionalMechanicOrGarage: isProFlagged,
          });
          if (milestone) {
            setLoyaltyToast(milestone);
          }
        })
        .catch(() => {
          const isProFlagged =
            isAccountProfessionalPartner(currentUser) || isJoinedPartnerProgram(prevPartner);
          const milestone = getLoyaltyMilestoneToastData({
            receiptId: normalized.id,
            receiptNumber: normalized.receiptNumber,
            previousItemsCount,
            currentItemsCount: previousItemsCount + orderedUnits,
            partnerStatus: prevPartner.status,
            isProfessionalMechanicOrGarage: isProFlagged,
          });
          if (milestone) {
            setLoyaltyToast(milestone);
          }
        });
    }
  };

  const handleOrderUpdated = useCallback((updatedReceipt: VirtualReceipt) => {
    const normalized: VirtualReceipt = {
      ...updatedReceipt,
      status: normalizeOrderStatus(updatedReceipt.status),
    };
    if (currentUser) {
      setOrderHistory((prev) =>
        prev.map((r) => (r.id === normalized.id ? { ...r, ...normalized } : r)),
      );
    }
    setActiveReceipt((curr) =>
      curr && curr.id === normalized.id ? { ...curr, ...normalized } : curr,
    );
  }, [currentUser]);

  const handleOrderUpdatedRef = useRef(handleOrderUpdated);
  handleOrderUpdatedRef.current = handleOrderUpdated;

  const refreshOrderStatuses = useCallback(async () => {
    if (!authToken || !currentUser) {
      setOrderHistory([]);
      return;
    }
    await fetchOrdersForUser(authToken, currentUser.id);
  }, [authToken, currentUser, fetchOrdersForUser]);

  const refreshPartnerData = useCallback(async () => {
    if (!authToken || !currentUser) {
      setOrderHistory([]);
      return;
    }
    try {
      const [meRes] = await Promise.all([
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetchOrdersForUser(authToken, currentUser.id),
      ]);
      if (meRes.ok) {
        const data = (await meRes.json()) as { user?: AuthUser };
        if (data.user) {
          setCurrentUser(data.user);
        }
      }
    } catch {
      // ignore transient network failure
    }
  }, [authToken, currentUser, fetchOrdersForUser]);

  const isAdminAccount = currentUser?.role === 'admin';
  const isAdmin = Boolean(isAdminAccount && isAdminVerified);

  const upsertBargain = useCallback((bargain: BargainOffer) => {
    setBargains((prev) =>
      [bargain, ...prev.filter((item) => item.id !== bargain.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
  }, []);

  const fetchCustomerBargains = useCallback(async () => {
    if (isAdmin) return;
    setLoadingBargains(true);
    try {
      const headers: Record<string, string> = {
        'x-session-id': chatSessionId,
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch(
        `/api/bargains?sessionId=${encodeURIComponent(chatSessionId)}`,
        { headers },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { bargains?: BargainOffer[] };
      if (Array.isArray(data.bargains)) {
        setBargains(
          [...data.bargains].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoadingBargains(false);
    }
  }, [authToken, chatSessionId, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      setBargains([]);
      setIsMyBargainsOpen(false);
      setBargainTarget(null);
      setActiveBargainId(null);
      return;
    }
    void fetchCustomerBargains();
  }, [fetchCustomerBargains, isAdmin]);

  const actionableBargainsCount = useMemo(
    () =>
      isAdmin
        ? 0
        : bargains.filter((b) => b.status === 'countered' || b.status === 'accepted').length,
    [bargains, isAdmin],
  );

  const activeBargain = useMemo(
    () => bargains.find((b) => b.id === activeBargainId) ?? null,
    [bargains, activeBargainId],
  );

  const handleLoadBargainIntoCart = useCallback(
    (bargain: BargainOffer) => {
      const catalogSource = allParts.length > 0 ? allParts : parts;
      const byId = new Map(catalogSource.map((p) => [p.id, p]));

      setCart((prev) => {
        const next = [...prev];
        for (const bItem of bargain.items) {
          const catalogPart = byId.get(bItem.partId);
          const resolvedPart: SparePart = catalogPart ?? {
            id: bItem.partId,
            name: bItem.name,
            description: `${bItem.name} (Agreed bargain item)`,
            price: bItem.unitPrice,
            stock: Math.max(bItem.quantity, 1),
            sku: bItem.sku,
            category: bItem.category,
            subcategory: bItem.subcategory,
            imageUrl: '',
            createdAt: bargain.createdAt,
          };
          const idx = next.findIndex((c) => c.part.id === bItem.partId);
          if (idx === -1) {
            next.push({ part: resolvedPart, quantity: bItem.quantity });
          } else {
            next[idx] = { part: resolvedPart, quantity: bItem.quantity };
          }
        }
        return next;
      });

      upsertBargain(bargain);
      setActiveBargainId(bargain.id);
      setIsMyBargainsOpen(false);
      setBargainTarget(null);
      setInspectedPart(null);
      setIsCartOpen(true);
    },
    [allParts, parts, upsertBargain],
  );

  const handleBargainRedeemed = useCallback(
    (bargainId: string, receipt: VirtualReceipt) => {
      setBargains((prev) =>
        prev.map((b) =>
          b.id === bargainId
            ? {
                ...b,
                status: 'redeemed',
                redeemedReceiptId: receipt.id,
                redeemedReceiptNumber: receipt.receiptNumber,
                updatedAt: new Date().toISOString(),
              }
            : b,
        ),
      );
      setActiveBargainId((curr) => (curr === bargainId ? null : curr));
    },
    [],
  );

  const totalAdminUnreadChats = useMemo(
    () => Object.values(unreadAdminBySession).reduce((sum, count) => sum + count, 0),
    [unreadAdminBySession],
  );
  const unreadChatCount = isAdmin ? totalAdminUnreadChats : unreadSupportCount;

  const liveChatContextRef = useRef({
    isAdmin,
    isSupportOpen,
    isMyBargainsOpen,
    activePage,
    adminTab,
    selectedAdminSessionId,
    chatSessionId,
  });
  liveChatContextRef.current = {
    isAdmin,
    isSupportOpen,
    isMyBargainsOpen,
    activePage,
    adminTab,
    selectedAdminSessionId,
    chatSessionId,
  };

  const handleOpenCustomerSupport = useCallback(() => {
    setIsSupportOpen(true);
    setUnreadSupportCount(0);
    setChatAlert((curr) => (curr?.sessionId === chatSessionId ? null : curr));
  }, [chatSessionId]);

  const handleMarkSessionRead = useCallback((sessionId: string) => {
    setUnreadAdminBySession((prev) => {
      if (!prev[sessionId]) return prev;
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setChatAlert((curr) => (curr?.sessionId === sessionId ? null : curr));
  }, []);

  const handleRequestBrowserAlerts = useCallback(async () => {
    const nextPerm = await requestChatNotificationPermission();
    setNotificationPermission(nextPerm);
  }, []);

  const handleOpenAdminChats = useCallback(
    (targetSessionId?: string) => {
      if (!liveChatContextRef.current.isAdmin) {
        setIsAuthModalOpen(true);
        return;
      }
      if (targetSessionId) {
        setSelectedAdminSessionId(targetSessionId);
        handleMarkSessionRead(targetSessionId);
      }
      setAdminTab('inbox');
      setActivePage('admin');
      setChatAlert(null);
      void fetchAllPartsForAdmin();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [fetchAllPartsForAdmin, handleMarkSessionRead],
  );

  const handleOpenAdminBargains = useCallback(() => {
    if (!liveChatContextRef.current.isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
    setAdminTab('bargains');
    setActivePage('admin');
    setChatAlert(null);
    void fetchAllPartsForAdmin();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchAllPartsForAdmin]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (disposed) return;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams();
      params.set('sessionId', chatSessionId);
      if (authToken) {
        params.set('token', authToken);
      }
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat?${params.toString()}`);
      chatWsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as {
            type?: string;
            message?: ChatMessage;
            bargain?: BargainOffer;
            receipt?: VirtualReceipt;
          };

          if (parsed.type === 'order:update' && parsed.receipt) {
            handleOrderUpdatedRef.current(parsed.receipt);
            return;
          }

          if (parsed.type === 'bargain:update' && parsed.bargain) {
            const b = parsed.bargain;
            setLatestBargainEvent(b);
            upsertBargain(b);

            const ctx = liveChatContextRef.current;
            const tabVisible = document.visibilityState === 'visible';

            if (ctx.isAdmin) {
              const latestEntry = b.history[b.history.length - 1];
              const isCustomerAction =
                b.status === 'pending' ||
                (latestEntry && latestEntry.actor === 'customer');
              const activelyViewingBargains =
                tabVisible && ctx.activePage === 'admin' && ctx.adminTab === 'bargains';

              if (isCustomerAction && !activelyViewingBargains) {
                const preview =
                  b.status === 'accepted'
                    ? `${b.bargainCode}: Customer accepted KSh ${(b.agreedTotal ?? b.offeredTotal).toLocaleString('en-KE')}`
                    : `${b.bargainCode}: Offered KSh ${b.offeredTotal.toLocaleString('en-KE')} (listed KSh ${b.listedSubtotal.toLocaleString('en-KE')})`;
                setChatAlert({
                  id: `brg-${b.id}-${b.updatedAt}`,
                  sessionId: '__admin_bargains__',
                  title:
                    b.status === 'accepted'
                      ? 'Customer Accepted Counter'
                      : 'Customer Bargain Offer',
                  senderLabel: b.customerName,
                  preview,
                  createdAt: b.updatedAt,
                });
                playChatNotificationSound();
                showBrowserChatNotification({
                  title: `${b.customerName} · ${b.bargainCode}`,
                  body: preview,
                  tag: `msz-admin-bargain-${b.id}`,
                  onClick: () => handleOpenAdminBargains(),
                });
              }
            } else if (b.sessionId === ctx.chatSessionId) {
              const isAdminUpdate =
                b.status === 'countered' ||
                b.status === 'accepted' ||
                b.status === 'rejected';
              const activelyViewingBargains = tabVisible && ctx.isMyBargainsOpen;
              if (isAdminUpdate && !activelyViewingBargains) {
                const preview =
                  b.status === 'accepted'
                    ? `Your bargain ${b.bargainCode} was accepted at KSh ${(b.agreedTotal ?? b.offeredTotal).toLocaleString('en-KE')}.`
                    : b.status === 'countered'
                      ? `Shop counter-offer on ${b.bargainCode}: KSh ${(b.counterTotal ?? 0).toLocaleString('en-KE')}.`
                      : `Your bargain ${b.bargainCode} was declined.`;
                setChatAlert({
                  id: `brg-${b.id}-${b.updatedAt}`,
                  sessionId: '__my_bargains__',
                  title:
                    b.status === 'accepted'
                      ? 'Bargain Accepted'
                      : b.status === 'countered'
                        ? 'New Counter-Offer'
                        : 'Bargain Update',
                  senderLabel: `${SHOP_NAME} · ${b.bargainCode}`,
                  preview,
                  createdAt: b.updatedAt,
                });
                playChatNotificationSound();
                showBrowserChatNotification({
                  title: `${SHOP_NAME} · ${b.bargainCode}`,
                  body: preview,
                  tag: `msz-customer-bargain-${b.id}`,
                  onClick: () => {
                    setIsMyBargainsOpen(true);
                    setChatAlert(null);
                  },
                });
              }
            }
            return;
          }

          if (parsed.type !== 'chat:message' || !parsed.message) return;
          const msg = parsed.message;
          if (seenMessageIdsRef.current.has(msg.id)) return;
          seenMessageIdsRef.current.add(msg.id);
          if (seenMessageIdsRef.current.size > 500) {
            const first = seenMessageIdsRef.current.values().next().value;
            if (first) seenMessageIdsRef.current.delete(first);
          }

          setLatestChatMessage(msg);

          const ctx = liveChatContextRef.current;
          const tabVisible = document.visibilityState === 'visible';

          if (ctx.isAdmin) {
            if (msg.sender !== 'customer') return;
            const activelyViewingThread =
              tabVisible &&
              ctx.activePage === 'admin' &&
              ctx.adminTab === 'inbox' &&
              ctx.selectedAdminSessionId === msg.sessionId;
            if (activelyViewingThread) return;

            setUnreadAdminBySession((prev) => ({
              ...prev,
              [msg.sessionId]: (prev[msg.sessionId] || 0) + 1,
            }));
            setChatAlert({
              id: msg.id,
              sessionId: msg.sessionId,
              title: 'New Customer Message',
              senderLabel: msg.customerName || 'Customer',
              preview: msg.text,
              createdAt: msg.createdAt,
            });
            playChatNotificationSound();
            showBrowserChatNotification({
              title: `New message from ${msg.customerName || 'Customer'}`,
              body: msg.text,
              tag: `msz-admin-${msg.sessionId}`,
              onClick: () => handleOpenAdminChats(msg.sessionId),
            });
          } else {
            if (msg.sessionId !== ctx.chatSessionId || msg.sender !== 'support') return;
            const activelyViewingDrawer = tabVisible && ctx.isSupportOpen;
            if (activelyViewingDrawer) return;

            setUnreadSupportCount((prev) => prev + 1);
            setChatAlert({
              id: msg.id,
              sessionId: msg.sessionId,
              title: 'Customer Care Reply',
              senderLabel: `${SHOP_NAME} Customer Care`,
              preview: msg.text,
              createdAt: msg.createdAt,
            });
            playChatNotificationSound();
            showBrowserChatNotification({
              title: `${SHOP_NAME} Customer Care`,
              body: msg.text,
              tag: `msz-customer-${msg.sessionId}`,
              onClick: () => handleOpenCustomerSupport(),
            });
          }
        } catch {
          // ignore malformed WS frames
        }
      };

      ws.onclose = () => {
        if (chatWsRef.current === ws) {
          chatWsRef.current = null;
        }
        if (!disposed) {
          const delayMs = Math.min(30000, 3000 * Math.pow(2, reconnectAttempts));
          reconnectAttempts = Math.min(reconnectAttempts + 1, 4);
          reconnectTimer = window.setTimeout(connect, delayMs);
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (chatWsRef.current) {
        chatWsRef.current.close();
        chatWsRef.current = null;
      }
    };
  }, [chatSessionId]);

  useEffect(() => {
    const ws = chatWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          sessionId: chatSessionId,
          token: authToken || '',
        }),
      );
    }
    setChatAlert(null);
    if (isAdmin) {
      setUnreadSupportCount(0);
    } else {
      setUnreadAdminBySession({});
    }
  }, [authToken, isAdmin, chatSessionId]);

  const handleLoginSuccess = (token: string, user: AuthUser, adminVerified: boolean) => {
    try {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      if (user.name) {
        window.localStorage.setItem('msz_chat_customer_name', user.name);
      }
    } catch {
      // ignore
    }
    setSecurityLogoutNotice(null);
    setAuthNotice(null);
    setAuthToken(token);
    setCurrentUser(user);
    setAdminPasswordAttempts(0);
    setActiveReceipt(null);
    const isLoggingInAsAdmin = user.role === 'admin';
    const initialWishlist =
      !isLoggingInAsAdmin && Array.isArray(user.wishlistPartIds) ? user.wishlistPartIds : [];
    setWishlistIds(initialWishlist);
    if (isLoggingInAsAdmin) {
      setOrderHistory([]);
      setWishlistFilterActive(false);
      setIsWishlistOpen(false);
      if (activePage === 'orders') {
        setActivePage(adminVerified ? 'admin' : 'storefront');
      }
    } else {
      setOrderHistory(loadUserOrderHistory(user.id));
      if (user.savedCarBrand || user.savedCarModel || user.savedCarYear) {
        const accountVehicle: CustomerVehicleProfile = {
          brand: user.savedCarBrand || '',
          carModel: user.savedCarModel || '',
          yearOfMake: user.savedCarYear || '',
        };
        setCustomerVehicle(accountVehicle);
        persistCustomerVehicle(accountVehicle);
      }
      void fetchOrdersForUser(token, user.id);
    }

    const partToSave = isLoggingInAsAdmin ? null : pendingWishlistPartId;
    if (partToSave) {
      setPendingWishlistPartId(null);
      if (!initialWishlist.includes(partToSave)) {
        setWishlistIds((prev) => (prev.includes(partToSave) ? prev : [partToSave, ...prev]));
        void fetch('/api/wishlist/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ partId: partToSave }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { partIds?: string[] } | null) => {
            if (data && Array.isArray(data.partIds)) {
              setWishlistIds(data.partIds);
            }
          })
          .catch(() => {
            // ignore transient failure
          });
      }
    } else if (isLoggingInAsAdmin) {
      setPendingWishlistPartId(null);
    }

    if (user.role === 'admin') {
      setIsAdminVerified(adminVerified);
      setIsSupportOpen(false);
      if (adminVerified) {
        setAdminTab('inventory');
        setActivePage('admin');
        void fetchAllPartsForAdmin();
      } else if (activePage === 'admin') {
        setActivePage('storefront');
      }
    } else {
      setIsAdminVerified(false);
      if (activePage === 'admin') {
        setActivePage('storefront');
      }
    }
  };

  const handleAdminPasswordVerified = () => {
    setIsAdminVerified(true);
    setAdminPasswordAttempts(0);
    setSecurityLogoutNotice(null);
    setIsSupportOpen(false);
    setAdminTab('inventory');
    setActivePage('admin');
    void fetchAllPartsForAdmin();
  };

  const handleForceAdminLogout = (reason: string) => {
    try {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem('msz_chat_customer_name');
    } catch {
      // ignore
    }
    setAuthToken(null);
    setCurrentUser(null);
    setIsAdminVerified(false);
    setAdminPasswordAttempts(0);
    setOrderHistory([]);
    setWishlistIds([]);
    setWishlistFilterActive(false);
    setActiveReceipt(null);
    setSecurityLogoutNotice(reason);
    if (activePage === 'admin') {
      setActivePage('storefront');
    }
  };

  const handleLogout = async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // ignore
      }
    }
    try {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem('msz_chat_customer_name');
    } catch {
      // ignore
    }
    setAuthToken(null);
    setCurrentUser(null);
    setIsAdminVerified(false);
    setAdminPasswordAttempts(0);
    setOrderHistory([]);
    setWishlistIds([]);
    setWishlistFilterActive(false);
    setActiveReceipt(null);
    if (activePage === 'admin') {
      setActivePage('storefront');
    }
  };

  const handleToggleWishlist = useCallback(
    async (part: SparePart) => {
      if (!currentUser || !authToken) {
        setPendingWishlistPartId(part.id);
        setAuthNotice(
          `Sign in with your registered mobile number and email to save "${part.name}" to your wishlist.`,
        );
        setIsAuthModalOpen(true);
        return;
      }

      const previousIds = wishlistIds;
      const alreadySaved = previousIds.includes(part.id);
      const optimisticIds = alreadySaved
        ? previousIds.filter((id) => id !== part.id)
        : [part.id, ...previousIds];
      setWishlistIds(optimisticIds);

      try {
        const res = await fetch('/api/wishlist/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ partId: part.id }),
        });
        if (!res.ok) {
          if (res.status === 401) {
            setWishlistIds([]);
            setPendingWishlistPartId(part.id);
            setAuthNotice('Please sign in again to save items to your wishlist.');
            setIsAuthModalOpen(true);
            return;
          }
          setWishlistIds(previousIds);
          return;
        }
        const data = (await res.json()) as { partIds?: string[] };
        if (Array.isArray(data.partIds)) {
          setWishlistIds(data.partIds);
        }
      } catch {
        setWishlistIds(previousIds);
      }
    },
    [authToken, currentUser, wishlistIds],
  );

  const handleClearWishlist = useCallback(async () => {
    if (!currentUser || !authToken) return;
    const previousIds = wishlistIds;
    setWishlistIds([]);
    setWishlistFilterActive(false);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        setWishlistIds(previousIds);
      }
    } catch {
      setWishlistIds(previousIds);
    }
  }, [authToken, currentUser, wishlistIds]);

  const handleToggleWishlistFilter = useCallback(() => {
    if (!currentUser || !authToken) {
      setAuthNotice('Sign in with your registered account to view your saved wishlist parts.');
      setIsAuthModalOpen(true);
      return;
    }
    setWishlistFilterActive((prev) => !prev);
  }, [authToken, currentUser]);

  const handleNavigateStorefront = (scrollToSection?: 'catalog' | 'categories') => {
    setActivePage('storefront');
    if (scrollToSection) {
      window.setTimeout(() => {
        const targetId =
          scrollToSection === 'categories' ? 'categories-section' : 'catalog-section';
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleInspectPart = useCallback((part: SparePart) => {
    setInspectedPart(part);
    setRecentlyViewedParts((prev) =>
      [part, ...prev.filter((item) => item.id !== part.id)].slice(0, MAX_RECENTLY_VIEWED),
    );
  }, []);

  const handleClearRecentlyViewed = useCallback(() => {
    setRecentlyViewedParts([]);
  }, []);

  const resolvedRecentlyViewed = useMemo(() => {
    if (allParts.length === 0) return recentlyViewedParts;
    const byId = new Map(allParts.map((item) => [item.id, item]));
    return recentlyViewedParts
      .map((item) => byId.get(item.id))
      .filter((item): item is SparePart => Boolean(item));
  }, [recentlyViewedParts, allParts]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      map[item.part.id] = item.quantity;
    }
    return map;
  }, [cart]);

  const resolvedWishlistParts = useMemo(() => {
    const source = allParts.length > 0 ? allParts : parts;
    const byId = new Map(source.map((item) => [item.id, item]));
    return wishlistIds
      .map((id) => byId.get(id))
      .filter((item): item is SparePart => Boolean(item));
  }, [wishlistIds, allParts, parts]);

  const handleSaveCustomerVehicle = useCallback(
    async (nextVehicle: CustomerVehicleProfile) => {
      const normalized: CustomerVehicleProfile = {
        brand: nextVehicle.brand && nextVehicle.brand !== 'All' ? nextVehicle.brand : '',
        carModel: (nextVehicle.carModel || '').trim(),
        yearOfMake: (nextVehicle.yearOfMake || '').trim(),
      };
      setCustomerVehicle(normalized);
      persistCustomerVehicle(normalized);
      const hasAnyField = Boolean(
        normalized.brand || normalized.carModel || normalized.yearOfMake,
      );
      if (!hasAnyField) {
        setMatchMyCarOnly(false);
      }
      if (authToken && currentUser && currentUser.role !== 'admin') {
        try {
          const res = await fetch('/api/auth/vehicle', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              savedCarBrand: normalized.brand || '',
              savedCarModel: normalized.carModel || '',
              savedCarYear: normalized.yearOfMake || '',
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { user?: AuthUser };
            if (data.user) {
              setCurrentUser(data.user);
            }
          }
        } catch {
          // keep local persistence if offline
        }
      }
    },
    [authToken, currentUser],
  );

  const hasSavedVehicle = Boolean(
    (customerVehicle.brand && customerVehicle.brand !== 'All') ||
      (customerVehicle.carModel && customerVehicle.carModel.trim()) ||
      (customerVehicle.yearOfMake && customerVehicle.yearOfMake.trim()),
  );

  const matchingVehiclePartsCount = useMemo(() => {
    if (!hasSavedVehicle) return 0;
    return parts.filter((part) => doesPartMatchCustomerVehicle(part, customerVehicle)).length;
  }, [parts, hasSavedVehicle, customerVehicle]);

  const displayedCatalogParts = useMemo(() => {
    let list = parts;
    if (offersFilterActive) {
      list = list.filter(
        (part) =>
          Boolean(part.isOffer) &&
          typeof part.previousPrice === 'number' &&
          part.previousPrice > part.price,
      );
    }
    if (wishlistFilterActive && currentUser) {
      const savedSet = new Set(wishlistIds);
      list = list.filter((part) => savedSet.has(part.id));
    }
    if (hasSavedVehicle) {
      if (matchMyCarOnly) {
        list = list.filter((part) => doesPartMatchCustomerVehicle(part, customerVehicle));
      } else {
        list = [...list].sort((a, b) => {
          const aMatch = doesPartMatchCustomerVehicle(a, customerVehicle) ? 1 : 0;
          const bMatch = doesPartMatchCustomerVehicle(b, customerVehicle) ? 1 : 0;
          return bMatch - aMatch;
        });
      }
    }
    return list;
  }, [
    parts,
    offersFilterActive,
    wishlistFilterActive,
    currentUser,
    wishlistIds,
    hasSavedVehicle,
    matchMyCarOnly,
    customerVehicle,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-slate-900">
      <SeoMetadata
        activePage={activePage}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        selectedBrand={selectedBrand}
        inspectedPart={inspectedPart}
      />
      <MobileInstallBanner />
      <TopBar
        activePage={activePage}
        isAdmin={isAdmin}
        isAdminChatsActive={adminTab === 'inbox'}
        unreadChatCount={unreadChatCount}
        wishlistCount={wishlistIds.length}
        actionableBargainsCount={actionableBargainsCount}
        cartCount={cartCount}
        currentUser={currentUser}
        onNavigateStorefront={handleNavigateStorefront}
        onNavigateOrders={() => {
          if (isAdmin) return;
          setActivePage('orders');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigatePartner={() => {
          setActivePage('partner');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateAdmin={() => {
          if (!isAdmin) {
            setIsAuthModalOpen(true);
            return;
          }
          setAdminTab((prev) => (prev === 'inbox' ? 'inventory' : prev));
          setActivePage('admin');
          void fetchAllPartsForAdmin();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAdminChats={() => handleOpenAdminChats()}
        onOpenSupport={handleOpenCustomerSupport}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenBargains={() => setIsMyBargainsOpen(true)}
        onOpenAuth={() => {
          setAuthNotice(null);
          setPendingWishlistPartId(null);
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {securityLogoutNotice && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 px-4 sm:px-6 lg:px-8 py-3 no-print"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm text-red-800">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{securityLogoutNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSecurityLogoutNotice(null)}
              className="p-1 text-red-500 hover:text-red-800 rounded"
              aria-label="Dismiss security alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 no-print">
        {activePage === 'storefront' ? (
          <StorefrontView
            parts={displayedCatalogParts}
            allParts={allParts.length > 0 ? allParts : parts}
            loading={loading}
            error={error}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            selectedSubcategory={selectedSubcategory}
            selectedBrand={selectedBrand}
            cartQuantities={cartQuantities}
            recentlyAddedId={recentlyAddedId}
            onSearchChange={setSearchQuery}
            onSelectCategory={handleSelectCategory}
            onSelectSubcategory={setSelectedSubcategory}
            onSelectBrand={setSelectedBrand}
            onAddToCart={(part) => handleAddToCart(part, 1)}
            onAddGearboxBundle={handleAddGearboxBundle}
            onInspectPart={handleInspectPart}
            onOpenSupport={handleOpenCustomerSupport}
            currentUser={currentUser}
            authToken={authToken}
            onOpenPartnerModal={() => setIsPartnerModalOpen(true)}
            onOpenPartnerPortal={() => {
              setActivePage('partner');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            reviews={reviews}
            reviewsAvgRating={reviewsAvgRating}
            onReviewsChanged={fetchReviews}
            isAdmin={isAdmin}
            unreadChatCount={unreadChatCount}
            onOpenAdminChats={() => handleOpenAdminChats()}
            wishlistIds={isAdmin ? [] : wishlistIds}
            wishlistFilterActive={isAdmin ? false : wishlistFilterActive}
            offersFilterActive={offersFilterActive}
            onToggleWishlist={isAdmin ? undefined : (part) => void handleToggleWishlist(part)}
            onToggleWishlistFilter={isAdmin ? undefined : handleToggleWishlistFilter}
            onToggleOffersFilter={() => setOffersFilterActive((prev) => !prev)}
            onClearOffersFilter={() => setOffersFilterActive(false)}
            onOpenWishlist={isAdmin ? undefined : () => setIsWishlistOpen(true)}
            onOpenBargainPart={
              isAdmin
                ? undefined
                : (part) => setBargainTarget({ mode: 'part', items: [{ part, quantity: 1 }] })
            }
            onOpenMyBargains={isAdmin ? undefined : () => setIsMyBargainsOpen(true)}
            actionableBargainsCount={actionableBargainsCount}
            customerVehicle={customerVehicle}
            matchMyCarOnly={matchMyCarOnly}
            matchingVehiclePartsCount={matchingVehiclePartsCount}
            onSaveCustomerVehicle={(v) => void handleSaveCustomerVehicle(v)}
            onToggleMatchMyCarOnly={() => setMatchMyCarOnly((prev) => !prev)}
            onRetryFetch={() => void fetchFilteredParts()}
          />
        ) : activePage === 'orders' && !isAdmin ? (
          <OrderHistoryView
            currentUser={currentUser}
            authToken={authToken}
            receipts={orderHistory}
            syncingStatuses={syncingStatuses}
            onRefreshStatuses={refreshOrderStatuses}
            onOrderSynced={handleOrderUpdated}
            onViewReceipt={(receipt) => setActiveReceipt(receipt)}
            onBrowseCatalog={() => handleNavigateStorefront('catalog')}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        ) : activePage === 'partner' ? (
          <PartnerPortalView
            currentUser={currentUser}
            authToken={authToken}
            allParts={allParts.length > 0 ? allParts : parts}
            cart={cart}
            cartQuantities={cartQuantities}
            receipts={orderHistory}
            syncingData={syncingStatuses}
            onRefreshPartnerData={refreshPartnerData}
            onAddToCart={(part, quantity = 1) => handleAddToCart(part, quantity)}
            onOpenCart={() => setIsCartOpen(true)}
            onViewReceipt={(receipt) => setActiveReceipt(receipt)}
            onOpenSupport={handleOpenCustomerSupport}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenPartnerModal={() => setIsPartnerModalOpen(true)}
            onBrowseCatalog={() => handleNavigateStorefront('catalog')}
          />
        ) : isAdmin && authToken ? (
          <AdminPortalView
            parts={allParts}
            authToken={authToken}
            activeTab={adminTab}
            onTabChange={setAdminTab}
            selectedSessionId={selectedAdminSessionId}
            onSelectedSessionChange={setSelectedAdminSessionId}
            unreadBySession={unreadAdminBySession}
            totalUnreadChats={totalAdminUnreadChats}
            latestChatMessage={latestChatMessage}
            latestBargainEvent={latestBargainEvent}
            onMarkSessionRead={handleMarkSessionRead}
            notificationPermission={notificationPermission}
            onRequestNotificationPermission={() => void handleRequestBrowserAlerts()}
            onPartsChanged={async () => {
              await Promise.all([fetchFilteredParts(), fetchAllPartsForAdmin()]);
            }}
            onReviewsChanged={fetchReviews}
            onViewReceipt={(receipt) => setActiveReceipt(receipt)}
            onOrderUpdated={handleOrderUpdated}
            onBackToStorefront={() => handleNavigateStorefront('catalog')}
            onLogout={handleLogout}
          />
        ) : (
          <main className="max-w-lg mx-auto px-4 py-16 text-center">
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
              <h1 className="font-display text-xl font-bold text-slate-900">
                Administrator Sign-In Required
              </h1>
              <p className="text-sm text-slate-600">
                Sign in with the registered shop administrator phone number, email, and full name to access inventory publishing and customer care inbox tools.
              </p>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                Sign In
              </button>
            </div>
          </main>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 no-print">
        {activePage === 'storefront' && (
          <div className="border-b border-slate-200 bg-slate-50/70">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center justify-between gap-4 mb-3.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Recently Viewed
                  </h2>
                  {resolvedRecentlyViewed.length > 0 && (
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      ({resolvedRecentlyViewed.length} / {MAX_RECENTLY_VIEWED})
                    </span>
                  )}
                </div>
                {resolvedRecentlyViewed.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearRecentlyViewed}
                    className="text-xs font-medium text-slate-500 hover:text-orange-700 transition-colors"
                  >
                    Clear history
                  </button>
                )}
              </div>

              {resolvedRecentlyViewed.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No spare parts viewed yet. Click any part above to keep your last {MAX_RECENTLY_VIEWED} viewed items here.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {resolvedRecentlyViewed.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleInspectPart(item)}
                      className="group bg-white border border-slate-200 hover:border-orange-300 rounded-lg p-2.5 flex items-center gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                    >
                      <div className="w-14 h-12 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <PartImage
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-slate-500 truncate">
                          {item.brand ? `${item.brand} · ` : ''}
                          {item.subcategory}
                        </p>
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-orange-700 truncate mt-0.5">
                          {item.name}
                        </p>
                        <p className="text-xs font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <BrandWordmark size="footer" />
            <p className="text-xs text-slate-500 mt-1.5">{GUARANTEE_NOTICE}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-orange-600" />
                <span>{PHYSICAL_STORE_ADDRESS}</span>
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                <Clock className="w-3.5 h-3.5 text-orange-600" />
                <span>{PHYSICAL_STORE_HOURS}</span>
              </span>
              <a
                href={PHYSICAL_STORE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:text-orange-800 underline underline-offset-2"
              >
                <span>Google Maps Directions</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <a
              href={`tel:${CUSTOMER_CARE_NUMBER}`}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-orange-700"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="font-mono">{CUSTOMER_CARE_NUMBER}</span>
            </a>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <a
              href={CUSTOMER_CARE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Support</span>
            </a>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => handleOpenAdminChats()}
                className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-orange-700"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Customer Chats</span>
                {unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCustomerSupport}
                className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-orange-700"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Customer Care Chat</span>
                {unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            )}
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <button
              type="button"
              onClick={() => setIsPrivacyPolicyOpen(true)}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-orange-700"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <PWAInstallButton variant="subtle" />
            {lastReceipt && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setActiveReceipt(lastReceipt)}
                  className="inline-flex items-center gap-1.5 font-medium text-orange-700 hover:text-orange-800"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Last Receipt ({lastReceipt.receiptNumber})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      <OfflineIndicator />

      <ChatNotificationBanner
        alert={chatAlert}
        unreadCount={unreadChatCount}
        notificationPermission={notificationPermission}
        onOpenChat={(sessionId) => {
          if (sessionId === '__admin_bargains__') {
            handleOpenAdminBargains();
            return;
          }
          if (sessionId === '__my_bargains__') {
            setIsMyBargainsOpen(true);
            setChatAlert(null);
            return;
          }
          if (isAdmin) {
            handleOpenAdminChats(sessionId);
          } else {
            handleOpenCustomerSupport();
          }
        }}
        onDismiss={() => setChatAlert(null)}
        onEnableBrowserAlerts={() => void handleRequestBrowserAlerts()}
      />

      <LoyaltyMilestoneToast
        toast={loyaltyToast}
        onDismiss={() => setLoyaltyToast(null)}
        onOpenPartnerPortal={() => {
          setActiveReceipt(null);
          setActivePage('partner');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Overlays & Modals */}
      <CartDrawer
        isOpen={isCartOpen}
        items={cart}
        allParts={allParts.length > 0 ? allParts : parts}
        currentUser={currentUser}
        authToken={authToken}
        sessionId={chatSessionId}
        bargains={bargains}
        activeBargain={activeBargain}
        onSelectActiveBargain={(b) => setActiveBargainId(b ? b.id : null)}
        onOpenBargainCart={() => {
          if (cart.length === 0) return;
          setIsCartOpen(false);
          setBargainTarget({ mode: 'cart', items: cart });
        }}
        onOpenMyBargains={() => {
          setIsCartOpen(false);
          setIsMyBargainsOpen(true);
        }}
        onBargainRedeemed={handleBargainRedeemed}
        onClose={() => setIsCartOpen(false)}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOrderCompleted={handleOrderCompleted}
      />

      {!isAdmin && (
        <BargainOfferModal
          target={bargainTarget}
          currentUser={currentUser}
          authToken={authToken}
          sessionId={chatSessionId}
          onClose={() => setBargainTarget(null)}
          onSubmitted={(bargain) => {
            upsertBargain(bargain);
            if (bargain.status === 'accepted') {
              setActiveBargainId(bargain.id);
            }
          }}
          onApplyAcceptedToCart={handleLoadBargainIntoCart}
        />
      )}

      {!isAdmin && (
        <MyBargainsDrawer
          isOpen={isMyBargainsOpen}
          bargains={bargains}
          loading={loadingBargains}
          allParts={allParts.length > 0 ? allParts : parts}
          authToken={authToken}
          sessionId={chatSessionId}
          onClose={() => setIsMyBargainsOpen(false)}
          onRefresh={fetchCustomerBargains}
          onBargainUpdated={upsertBargain}
          onLoadBargainIntoCart={handleLoadBargainIntoCart}
        />
      )}

      {!isAdmin && (
        <WishlistDrawer
          isOpen={isWishlistOpen}
          currentUser={currentUser}
          parts={resolvedWishlistParts}
          onClose={() => setIsWishlistOpen(false)}
          onInspectPart={handleInspectPart}
          onAddToCart={(part) => handleAddToCart(part, 1)}
          onRemoveFromWishlist={(part) => void handleToggleWishlist(part)}
          onClearWishlist={() => void handleClearWishlist()}
          onOpenAuth={() => {
            setAuthNotice('Sign in with your mobile number and email to access your saved wishlist.');
            setIsAuthModalOpen(true);
          }}
          onBrowseCatalog={() => handleNavigateStorefront('catalog')}
          onFilterCatalogToWishlist={() => {
            setWishlistFilterActive(true);
            handleNavigateStorefront('catalog');
          }}
        />
      )}

      {!isAdmin && (
        <CustomerCareDrawer
          isOpen={isSupportOpen}
          sessionId={chatSessionId}
          currentUser={currentUser}
          authToken={authToken}
          latestChatMessage={latestChatMessage}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={() => void handleRequestBrowserAlerts()}
          onClose={() => setIsSupportOpen(false)}
        />
      )}

      <PartDetailModal
        part={inspectedPart}
        allParts={allParts.length > 0 ? allParts : parts}
        onClose={() => setInspectedPart(null)}
        onSelectPart={handleInspectPart}
        onAddToCart={handleAddToCart}
        onAddGearboxBundle={handleAddGearboxBundle}
        onOpenBargain={
          isAdmin
            ? undefined
            : (part, quantity) => {
                setInspectedPart(null);
                setBargainTarget({ mode: 'part', items: [{ part, quantity }] });
              }
        }
        onOpenSupport={handleOpenCustomerSupport}
        isAdmin={isAdmin}
        isWishlisted={Boolean(!isAdmin && inspectedPart && currentUser && wishlistIds.includes(inspectedPart.id))}
        onToggleWishlist={isAdmin ? undefined : (part) => void handleToggleWishlist(part)}
      />

      <GearboxOilPromptModal
        gearbox={gearboxOilPrompt?.gearbox ?? null}
        gearboxQuantity={gearboxOilPrompt?.quantity ?? 1}
        allParts={allParts.length > 0 ? allParts : parts}
        cartQuantities={cartQuantities}
        onClose={() => setGearboxOilPrompt(null)}
        onSelectPart={handleInspectPart}
        onAddOilPair={(oil, cans) => handleAddToCart(oil, cans)}
        onOpenCart={() => setIsCartOpen(true)}
      />

      <VirtualReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        currentUser={currentUser}
        sessionId={chatSessionId}
        wishlistCount={wishlistIds.length}
        authNotice={authNotice}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthNotice(null);
          setPendingWishlistPartId(null);
        }}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onOpenAdminPortal={() => {
          if (!isAdmin) return;
          setAdminTab('inventory');
          setActivePage('admin');
          void fetchAllPartsForAdmin();
        }}
        onOpenOrderHistory={() => setActivePage('orders')}
        onOpenWishlist={isAdmin ? undefined : () => setIsWishlistOpen(true)}
        onOpenPartnerModal={() => setIsPartnerModalOpen(true)}
        onOpenPartnerPortal={() => {
          setActivePage('partner');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)}
      />

      <PrivacyPolicyModal
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />

      <PartnerProgramModal
        isOpen={isPartnerModalOpen}
        currentUser={currentUser}
        onClose={() => setIsPartnerModalOpen(false)}
        onPartnerRegistered={(token, user) => {
          handleLoginSuccess(token, user, false);
          setIsPartnerModalOpen(false);
          setActivePage('partner');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPartnerPortal={() => {
          setActivePage('partner');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <AdminPasswordModal
        isOpen={Boolean(isAdminAccount && !isAdminVerified && authToken)}
        adminUser={currentUser}
        authToken={authToken}
        initialAttemptsUsed={adminPasswordAttempts}
        onVerified={handleAdminPasswordVerified}
        onForceLogout={handleForceAdminLogout}
        onCancelLogout={handleLogout}
      />
    </div>
  );
}
