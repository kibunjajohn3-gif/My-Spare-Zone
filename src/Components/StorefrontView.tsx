import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ShoppingBag,
  Phone,
  MessageSquare,
  MessageCircle,
  Wrench,
  Truck,
  Check,
  X,
  History,
  Car,
  Droplets,
  MapPin,
  Tag,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Star,
  Trash2,
  Percent,
  ExternalLink,
  Heart,
  ArrowRight,
  Calculator,
  Handshake,
  Share2,
} from 'lucide-react';
import type {
  AuthUser,
  CarBrand,
  CustomerReview,
  PrimaryCategory,
  ReviewAuthorType,
  SparePart,
} from '../types';
import {
  CAR_BRANDS,
  CATEGORY_SUBCATEGORIES,
  CUSTOMER_CARE_NUMBER,
  CUSTOMER_CARE_WHATSAPP_URL,
  DELIVERY_SERVICE_NOTICE,
  doesPartMatchCustomerVehicle,
  formatCurrency,
  GARAGE_FITTING_SERVICE_NOTICE,
  GEARBOX_OIL_CAN_LITRES,
  GEARBOX_OIL_PAIR_CANS,
  getBodyPartConditionInfo,
  getMatchingGearboxOils,
  getPartImageGallery,
  getPartOfferDetails,
  getPartnerLoyaltyItemsCount,
  getPartnerTierDiscountPct,
  getWhatsAppPartShareUrl,
  GUARANTEE_NOTICE,
  isGearboxPart,
  isJoinedPartnerProgram,
  MECHANIC_SERVICE_NOTICE,
  PARTNER_BULK_BONUS_PCT,
  PARTNER_MAX_DISCOUNT_PCT,
  PHYSICAL_STORE_ADDRESS,
  PHYSICAL_STORE_HOURS,
  PHYSICAL_STORE_MAPS_URL,
  PRIMARY_CATEGORIES,
  RETURN_EXCHANGE_POLICY_NOTICE,
  type CustomerVehicleProfile,
} from '../constants/catalog';
import { PartImage } from './PartImage';
import { PWAInstallButton } from './PWAInstallButton';
import { BrandWordmark } from './BrandWordmark';

const RECENT_SEARCHES_STORAGE_KEY = 'msz_recent_searches_v1';
const MAX_RECENT_SEARCHES = 6;

function loadRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length >= 2)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function persistRecentSearches(queries: string[]) {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(queries));
  } catch {
    // ignore storage quota errors
  }
}

interface StorefrontViewProps {
  parts: SparePart[];
  allParts?: SparePart[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: 'All' | PrimaryCategory;
  selectedSubcategory: string;
  selectedBrand: 'All' | CarBrand;
  cartQuantities: Record<string, number>;
  recentlyAddedId: string | null;
  onSearchChange: (value: string) => void;
  onSelectCategory: (category: 'All' | PrimaryCategory) => void;
  onSelectSubcategory: (subcategory: string) => void;
  onSelectBrand: (brand: 'All' | CarBrand) => void;
  onAddToCart: (part: SparePart) => void;
  onAddGearboxBundle?: (
    gearbox: SparePart,
    gearboxQty: number,
    oil: SparePart,
    oilCans: number,
  ) => void;
  onInspectPart: (part: SparePart) => void;
  onOpenSupport: () => void;
  currentUser?: AuthUser | null;
  authToken?: string | null;
  onOpenPartnerModal?: () => void;
  onOpenPartnerPortal?: () => void;
  reviews?: CustomerReview[];
  reviewsAvgRating?: number;
  onReviewsChanged?: () => Promise<void> | void;
  isAdmin?: boolean;
  unreadChatCount?: number;
  onOpenAdminChats?: () => void;
  wishlistIds?: string[];
  wishlistFilterActive?: boolean;
  offersFilterActive?: boolean;
  onToggleWishlist?: (part: SparePart) => void;
  onToggleWishlistFilter?: () => void;
  onToggleOffersFilter?: () => void;
  onClearOffersFilter?: () => void;
  onOpenWishlist?: () => void;
  onOpenBargainPart?: (part: SparePart) => void;
  onOpenMyBargains?: () => void;
  actionableBargainsCount?: number;
  customerVehicle?: CustomerVehicleProfile;
  matchMyCarOnly?: boolean;
  matchingVehiclePartsCount?: number;
  onSaveCustomerVehicle?: (vehicle: CustomerVehicleProfile) => void;
  onToggleMatchMyCarOnly?: () => void;
  onRetryFetch: () => void;
}

export function StorefrontView({
  parts,
  allParts,
  loading,
  error,
  searchQuery,
  selectedCategory,
  selectedSubcategory,
  selectedBrand,
  cartQuantities,
  recentlyAddedId,
  onSearchChange,
  onSelectCategory,
  onSelectSubcategory,
  onSelectBrand,
  onAddToCart,
  onAddGearboxBundle,
  onInspectPart,
  onOpenSupport,
  currentUser = null,
  authToken = null,
  onOpenPartnerModal,
  onOpenPartnerPortal,
  reviews = [],
  reviewsAvgRating = 5,
  onReviewsChanged,
  isAdmin = false,
  unreadChatCount = 0,
  onOpenAdminChats,
  wishlistIds = [],
  wishlistFilterActive = false,
  offersFilterActive = false,
  onToggleWishlist,
  onToggleWishlistFilter,
  onToggleOffersFilter,
  onClearOffersFilter,
  onOpenWishlist,
  onOpenBargainPart,
  onOpenMyBargains,
  actionableBargainsCount = 0,
  customerVehicle,
  matchMyCarOnly = false,
  matchingVehiclePartsCount = 0,
  onSaveCustomerVehicle,
  onToggleMatchMyCarOnly,
  onRetryFetch,
}: StorefrontViewProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [activeSearchBar, setActiveSearchBar] = useState<'hero' | 'inline' | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const lastLoggedRef = useRef<{ term: string; at: number } | null>(null);

  // Optional saved vehicle drafts
  const [vehicleEditorOpen, setVehicleEditorOpen] = useState(false);
  const [vehicleBrandDraft, setVehicleBrandDraft] = useState<string>(customerVehicle?.brand || '');
  const [vehicleModelDraft, setVehicleModelDraft] = useState(customerVehicle?.carModel || '');
  const [vehicleYearDraft, setVehicleYearDraft] = useState(customerVehicle?.yearOfMake || '');

  useEffect(() => {
    setVehicleBrandDraft(customerVehicle?.brand || '');
    setVehicleModelDraft(customerVehicle?.carModel || '');
    setVehicleYearDraft(customerVehicle?.yearOfMake || '');
  }, [customerVehicle?.brand, customerVehicle?.carModel, customerVehicle?.yearOfMake]);

  const hasSavedVehicle = Boolean(
    (customerVehicle?.brand && customerVehicle.brand !== 'All') ||
      (customerVehicle?.carModel && customerVehicle.carModel.trim()) ||
      (customerVehicle?.yearOfMake && customerVehicle.yearOfMake.trim()),
  );

  // Customer & Mechanic Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewAuthorName, setReviewAuthorName] = useState('');
  const [reviewAuthorType, setReviewAuthorType] = useState<ReviewAuthorType>('mechanic');
  const [reviewContext, setReviewContext] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const activeSubcategories =
    selectedCategory === 'All' ? [] : CATEGORY_SUBCATEGORIES[selectedCategory];

  const catalogSource = allParts && allParts.length > 0 ? allParts : parts;

  const offerParts = useMemo(
    () => catalogSource.filter((part) => getPartOfferDetails(part).hasOffer),
    [catalogSource],
  );

  // Build ranked popular categories + subcategories from live catalog counts and demand priority
  const categoryDirectory = useMemo(() => {
    const POPULAR_BOOST = new Map<string, number>([
      ['Mechanical Parts:Gearboxes', 40],
      ['Gearbox Oil:All', 36],
      ['Body parts:Headlights', 30],
      ['Mechanical Parts:Engines', 28],
      ['Body parts:Front Bumpers', 24],
      ['Electricals:Alternators', 22],
      ['Dashboard & Interior Parts:Dashboards', 20],
      ['Body parts:All', 18],
      ['Electricals:All', 16],
      ['Mechanical Parts:All', 15],
      ['Dashboard & Interior Parts:All', 14],
    ]);

    const entries: Array<{
      id: string;
      label: string;
      parentLabel?: string;
      category: PrimaryCategory;
      subcategory: string;
      count: number;
      popularityScore: number;
      keywords: string;
    }> = [];

    for (const cat of PRIMARY_CATEGORIES) {
      const catCount = catalogSource.filter((p) => p.category === cat).length;
      const catBoost = POPULAR_BOOST.get(`${cat}:All`) ?? 5;
      entries.push({
        id: `cat:${cat}`,
        label: cat,
        category: cat,
        subcategory: 'All',
        count: catCount,
        popularityScore: catCount * 3 + catBoost,
        keywords: `${cat} ${CATEGORY_SUBCATEGORIES[cat].join(' ')}`.toLowerCase(),
      });

      for (const sub of CATEGORY_SUBCATEGORIES[cat]) {
        const subCount = catalogSource.filter(
          (p) => p.category === cat && p.subcategory === sub,
        ).length;
        const subBoost = POPULAR_BOOST.get(`${cat}:${sub}`) ?? 0;
        entries.push({
          id: `sub:${cat}:${sub}`,
          label: sub,
          parentLabel: cat,
          category: cat,
          subcategory: sub,
          count: subCount,
          popularityScore: subCount * 4 + subBoost + (subCount > 0 ? 8 : 0),
          keywords: `${sub} ${cat}`.toLowerCase(),
        });
      }
    }

    return entries.sort(
      (a, b) =>
        b.popularityScore - a.popularityScore ||
        b.count - a.count ||
        a.label.localeCompare(b.label),
    );
  }, [catalogSource]);

  const logSearchToServer = (normalized: string) => {
    const key = normalized.toLowerCase();
    const now = Date.now();
    if (
      lastLoggedRef.current &&
      lastLoggedRef.current.term === key &&
      now - lastLoggedRef.current.at < 5000
    ) {
      return;
    }
    lastLoggedRef.current = { term: key, at: now };
    void fetch('/api/search-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: normalized }),
    }).catch(() => undefined);
  };

  const saveSearchQuery = (rawQuery: string) => {
    const normalized = rawQuery.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2) return;
    logSearchToServer(normalized);
    setRecentSearches((prev) => {
      const next = [
        normalized,
        ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);
      persistRecentSearches(next);
      return next;
    });
  };

  // Save search query automatically when the user pauses on a query (live search)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return undefined;
    const timer = window.setTimeout(() => {
      saveSearchQuery(trimmed);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Reset keyboard highlight whenever query or active search bar changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery, activeSearchBar]);

  const handleSelectSuggestion = (term: string, source: 'hero' | 'inline') => {
    onSearchChange(term);
    saveSearchQuery(term);
    setActiveSearchBar(null);
    setHighlightedIndex(-1);
    if (source === 'hero') {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectSuggestedCategory = (
    category: PrimaryCategory,
    subcategory: string,
    source: 'hero' | 'inline',
  ) => {
    onSearchChange('');
    onSelectCategory(category);
    onSelectSubcategory(subcategory);
    onSelectBrand('All');
    setActiveSearchBar(null);
    setHighlightedIndex(-1);
    if (source === 'hero') {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRemoveSuggestion = (term: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item.toLowerCase() !== term.toLowerCase());
      persistRecentSearches(next);
      return next;
    });
  };

  const handleClearSuggestions = () => {
    setRecentSearches([]);
    persistRecentSearches([]);
  };

  const handleInspectWithSave = (part: SparePart) => {
    if (searchQuery.trim().length >= 2) {
      saveSearchQuery(searchQuery);
    }
    setActiveSearchBar(null);
    onInspectPart(part);
  };

  const dropdownData = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    const filteredRecent = needle
      ? recentSearches.filter(
          (item) => item.toLowerCase().includes(needle) && item.toLowerCase() !== needle,
        )
      : recentSearches;

    const matchedCategories = needle
      ? categoryDirectory
          .filter((entry) => entry.keywords.includes(needle))
          .sort((a, b) => {
            const aStarts = a.label.toLowerCase().startsWith(needle) ? 1 : 0;
            const bStarts = b.label.toLowerCase().startsWith(needle) ? 1 : 0;
            if (bStarts !== aStarts) return bStarts - aStarts;
            return b.popularityScore - a.popularityScore;
          })
          .slice(0, 5)
      : categoryDirectory.filter((entry) => entry.count > 0).slice(0, 5);

    const matchedParts =
      needle.length >= 2
        ? catalogSource
            .filter((part) => {
              const haystack =
                `${part.name} ${part.brand || ''} ${part.carModel || ''} ${part.yearOfMake || ''} ${part.conditionGrade ? `grade ${part.conditionGrade}` : ''} ${part.category} ${part.subcategory} ${part.gearboxOilType || ''} ${part.sku}`.toLowerCase();
              return haystack.includes(needle);
            })
            .slice(0, 4)
        : [];

    return {
      recent: filteredRecent,
      categories: matchedCategories,
      parts: matchedParts,
    };
  }, [searchQuery, recentSearches, categoryDirectory, catalogSource]);

  const totalDropdownItems =
    dropdownData.recent.length + dropdownData.categories.length + dropdownData.parts.length;

  const activateDropdownIndex = (index: number, source: 'hero' | 'inline') => {
    const recentLen = dropdownData.recent.length;
    if (index < recentLen) {
      handleSelectSuggestion(dropdownData.recent[index], source);
      return;
    }
    const catIdx = index - recentLen;
    if (catIdx < dropdownData.categories.length) {
      const cat = dropdownData.categories[catIdx];
      handleSelectSuggestedCategory(cat.category, cat.subcategory, source);
      return;
    }
    const partIdx = catIdx - dropdownData.categories.length;
    if (partIdx < dropdownData.parts.length) {
      handleInspectWithSave(dropdownData.parts[partIdx]);
    }
  };

  const handleSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    source: 'hero' | 'inline',
  ) => {
    if (e.key === 'Escape') {
      setActiveSearchBar(null);
      setHighlightedIndex(-1);
      return;
    }
    if (activeSearchBar !== source || totalDropdownItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalDropdownItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? totalDropdownItems - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < totalDropdownItems) {
      e.preventDefault();
      activateDropdownIndex(highlightedIndex, source);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent, source: 'hero' | 'inline') => {
    e.preventDefault();
    if (highlightedIndex >= 0 && highlightedIndex < totalDropdownItems) {
      activateDropdownIndex(highlightedIndex, source);
      return;
    }
    saveSearchQuery(searchQuery);
    setActiveSearchBar(null);
    if (source === 'hero' && searchQuery.trim()) {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const renderHighlightedText = (text: string) => {
    const needle = searchQuery.trim();
    if (!needle) return text;
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + needle.length);
    const after = text.slice(idx + needle.length);
    return (
      <>
        {before}
        <mark className="bg-orange-100 text-orange-900 font-semibold rounded-xs px-0.5">
          {match}
        </mark>
        {after}
      </>
    );
  };

  const renderSuggestionsDropdown = (source: 'hero' | 'inline') => {
    if (activeSearchBar !== source || totalDropdownItems === 0) {
      return null;
    }

    const recentOffset = 0;
    const categoryOffset = dropdownData.recent.length;
    const partsOffset = categoryOffset + dropdownData.categories.length;

    return (
      <div
        className={`absolute top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden ${
          source === 'inline' ? 'left-0 right-0 lg:left-auto lg:w-[400px]' : 'left-0 right-0'
        }`}
        role="listbox"
        aria-label="Search suggestions"
      >
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {/* 1. Recent Searches */}
          {dropdownData.recent.length > 0 && (
            <div>
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <History className="w-3 h-3 text-slate-400" />
                  <span>{searchQuery.trim() ? 'Matching Recent Searches' : 'Recent Searches'}</span>
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleClearSuggestions();
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-orange-700 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {dropdownData.recent.map((term, idx) => {
                  const flatIndex = recentOffset + idx;
                  const isHighlighted = highlightedIndex === flatIndex;
                  return (
                    <li
                      key={term}
                      className={`flex items-center justify-between transition-colors ${
                        isHighlighted ? 'bg-orange-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(term, source);
                        }}
                        className="flex-1 flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-800 hover:text-orange-700 min-w-0"
                      >
                        <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{renderHighlightedText(term)}</span>
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveSuggestion(term);
                        }}
                        className="p-2 mr-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0"
                        aria-label={`Remove "${term}" from recent searches`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 2. Popular Categories */}
          {dropdownData.categories.length > 0 && (
            <div>
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <TrendingUp className="w-3 h-3 text-orange-600" />
                  <span>
                    {searchQuery.trim() ? 'Matching Categories' : 'Popular Categories'}
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">Browse directly</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {dropdownData.categories.map((catEntry, idx) => {
                  const flatIndex = categoryOffset + idx;
                  const isHighlighted = highlightedIndex === flatIndex;
                  return (
                    <li key={catEntry.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestedCategory(
                            catEntry.category,
                            catEntry.subcategory,
                            source,
                          );
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                          isHighlighted ? 'bg-orange-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0">
                            <Tag className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {renderHighlightedText(catEntry.label)}
                            </p>
                            {catEntry.parentLabel && (
                              <p className="text-[11px] text-slate-500 truncate">
                                in {catEntry.parentLabel}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                          <span>
                            {catEntry.count} {catEntry.count === 1 ? 'part' : 'parts'}
                          </span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 3. Matching Spare Parts (as user types) */}
          {dropdownData.parts.length > 0 && (
            <div>
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>Matching Spare Parts</span>
                </span>
                <span className="text-[11px] text-slate-400">Quick inspect</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {dropdownData.parts.map((part, idx) => {
                  const flatIndex = partsOffset + idx;
                  const isHighlighted = highlightedIndex === flatIndex;
                  return (
                    <li key={part.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInspectWithSave(part);
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors ${
                          isHighlighted ? 'bg-orange-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-7 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            <PartImage
                              src={part.imageUrl}
                              alt={part.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {renderHighlightedText(part.name)}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {part.brand ? `${part.brand} · ` : ''}
                              {part.subcategory}
                            </p>
                          </div>
                        </div>
                        {(() => {
                          const offer = getPartOfferDetails(part);
                          return (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono tabular-nums font-bold text-orange-700 block">
                                {formatCurrency(part.price)}
                              </span>
                              {offer.hasOffer && offer.previousPrice !== null && (
                                <span className="text-[10px] font-mono tabular-nums text-slate-400 line-through block">
                                  {formatCurrency(offer.previousPrice)}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="pb-16">
      {/* Storefront Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Hero Copy & Direct Search */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="mb-3">
                <BrandWordmark size="hero" />
              </div>
              <p className="text-xs font-medium text-slate-500">
                Body parts · Electricals · Mechanical Parts · Gearbox Oil · Dashboard & Interior Parts
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 mt-3 text-balance"
                style={{ fontSize: 'clamp(2.15rem, 3.6vw, 3.25rem)', lineHeight: 1.08 }}
              >
                Genuine spare parts, ready for the road.
              </h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                Search verified body panels, electrical components, and mechanical assemblies. Every order includes an instant virtual receipt and {GUARANTEE_NOTICE.toLowerCase()}.
              </p>

              {/* Hero Search Input */}
              <form
                onSubmit={(e) => handleSearchSubmit(e, 'hero')}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    saveSearchQuery(searchQuery);
                    setActiveSearchBar((prev) => (prev === 'hero' ? null : prev));
                  }
                }}
                className="mt-6 max-w-xl relative"
              >
                <label htmlFor="hero-part-search" className="sr-only">
                  Search spare parts by name
                </label>
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="hero-part-search"
                    type="text"
                    value={searchQuery}
                    role="combobox"
                    aria-expanded={activeSearchBar === 'hero' && totalDropdownItems > 0}
                    aria-autocomplete="list"
                    onFocus={() => setActiveSearchBar('hero')}
                    onKeyDown={(e) => handleSearchKeyDown(e, 'hero')}
                    onChange={(e) => {
                      onSearchChange(e.target.value);
                      setActiveSearchBar('hero');
                    }}
                    placeholder="Search item or car brand (e.g. Toyota Gearbox, Nissan, Headlight)..."
                    autoComplete="off"
                    className="w-full pl-10 pr-24 py-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className="absolute right-2.5 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-200/70 rounded"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  ) : (
                    <a
                      href="#catalog-section"
                      className="absolute right-2 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                    >
                      Browse
                    </a>
                  )}
                </div>
                {renderSuggestionsDropdown('hero')}
              </form>

              {/* Customer Care, WhatsApp & Mobile App Adjacency Strip */}
              <div className="mt-6 pt-5 border-t border-slate-200 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm">
                <a
                  href={`tel:${CUSTOMER_CARE_NUMBER}`}
                  className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-orange-700 transition-colors"
                >
                  <Phone className="w-4 h-4 text-orange-600" />
                  <span>Call:</span>
                  <span className="font-mono font-semibold">{CUSTOMER_CARE_NUMBER}</span>
                </a>
                <a
                  href={CUSTOMER_CARE_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat on WhatsApp</span>
                </a>
                {isAdmin && onOpenAdminChats ? (
                  <button
                    type="button"
                    onClick={onOpenAdminChats}
                    className="inline-flex items-center gap-2 font-semibold text-orange-700 hover:text-orange-800 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Customer Chats</span>
                    {unreadChatCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                        {unreadChatCount}
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenSupport}
                    className="inline-flex items-center gap-2 font-semibold text-orange-700 hover:text-orange-800 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Live Support Chat</span>
                    {unreadChatCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                        {unreadChatCount}
                      </span>
                    )}
                  </button>
                )}
                <PWAInstallButton />
              </div>
            </div>

            {/* Hero Visual */}
            <div className="lg:col-span-6">
              <div className="h-full min-h-[260px] lg:min-h-[360px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                <PartImage
                  src="/src/assets/images/hero_spare_zone_1794558117479.jpg"
                  alt="Precision automotive spare parts at My Spare Zone"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Mobile Mechanics + Partner Program, Paid Delivery & Physical Store Pickup Strip */}
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Mobile Mechanics &amp; In-Garage Fitting
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {MECHANIC_SERVICE_NOTICE} {GARAGE_FITTING_SERVICE_NOTICE}{' '}
                    <a
                      href={CUSTOMER_CARE_WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      Book Fitting / Mechanic via WhatsApp ({CUSTOMER_CARE_NUMBER})
                    </a>
                    .
                  </p>
                </div>

                {(onOpenPartnerModal || onOpenPartnerPortal) && (
                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                    {currentUser?.partnerProfile ? (
                      <>
                        <button
                          type="button"
                          onClick={onOpenPartnerPortal ?? onOpenPartnerModal}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800"
                        >
                          <Percent className="w-3.5 h-3.5 shrink-0" />
                          {currentUser.partnerProfile.status === 'active' ? (
                            <span>
                              Partner Tier:{' '}
                              {getPartnerTierDiscountPct(
                                getPartnerLoyaltyItemsCount(currentUser.partnerProfile),
                                currentUser.partnerProfile.discountTierPercent,
                                isJoinedPartnerProgram(currentUser.partnerProfile),
                              )}
                              % off (+{PARTNER_BULK_BONUS_PCT}% bulk) · Code{' '}
                              <span className="font-mono">
                                {currentUser.partnerProfile.referralCode}
                              </span>
                            </span>
                          ) : currentUser.partnerProfile.status === 'pending' ? (
                            <span className="text-blue-700">
                              Partner Application Pending Admin Verification
                            </span>
                          ) : currentUser.partnerProfile.status === 'rejected' ? (
                            <span className="text-red-700">
                              Partner Verification Rejected — Upload New Proof
                            </span>
                          ) : (
                            <span className="text-amber-700">
                              Partner Account Paused
                            </span>
                          )}
                        </button>
                        {onOpenPartnerPortal && (
                          <button
                            type="button"
                            onClick={onOpenPartnerPortal}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            <span>Open Partner Portal</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {onOpenPartnerModal && (
                          <button
                            type="button"
                            onClick={onOpenPartnerModal}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-orange-900 bg-orange-100/80 hover:bg-orange-200/80 border border-orange-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            <Percent className="w-3 h-3" />
                            <span>
                              Garage & Mechanic Partner Accounts (Up to {PARTNER_MAX_DISCOUNT_PCT}% Bulk Off)
                            </span>
                          </button>
                        )}
                        {onOpenPartnerPortal && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenPartnerPortal();
                              window.setTimeout(() => {
                                document
                                  .getElementById('bulk-discount-calculator')
                                  ?.scrollIntoView({ behavior: 'smooth' });
                              }, 80);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            <Calculator className="w-3 h-3 text-orange-600" />
                            <span>Bulk Calculator</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-slate-900">
                  Upfront Delivery Services (Nairobi &amp; Nationwide)
                </h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {DELIVERY_SERVICE_NOTICE}
                </p>
                <p className="text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-200/80 leading-relaxed">
                  <strong className="text-slate-800">Mismatch / Fitment Policy:</strong>{' '}
                  {RETURN_EXCHANGE_POLICY_NOTICE}
                </p>
              </div>
            </div>

            <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-4 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Counter Pickup &amp; Drive-In Fitting Garage
                  </h2>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                    Pick up your part in person or drive in with your vehicle to get it fitted while you wait at{' '}
                    <strong className="text-slate-900">{PHYSICAL_STORE_ADDRESS}</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2 border-t border-orange-200/80 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
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
            </div>
          </div>
        </div>
      </section>

      {/* Special Offers Showcase (visible whenever Admin has posted active offers) */}
      {offerParts.length > 0 && (
        <section
          id="offers-section"
          aria-labelledby="offers-section-heading"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-orange-200/80">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                <Tag className="w-3.5 h-3.5" />
                <span>
                  {offerParts.length} {offerParts.length === 1 ? 'Active Offer' : 'Active Offers'}
                </span>
              </div>
              <h2
                id="offers-section-heading"
                className="font-display text-2xl font-bold text-slate-900 mt-0.5"
              >
                Special Offers & Price Drops
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Limited-time reduced prices on genuine spare parts — previous price shown for instant comparison.
              </p>
            </div>
            {onToggleOffersFilter && (
              <button
                type="button"
                onClick={() => {
                  if (!offersFilterActive) {
                    onToggleOffersFilter();
                  }
                  document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
              >
                <span>View All in Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
            {offerParts.slice(0, 4).map((part) => {
              const offer = getPartOfferDetails(part);
              const justAdded = recentlyAddedId === part.id;
              const isSaved = Boolean(currentUser) && wishlistIds.includes(part.id);

              return (
                <article
                  key={`offer-${part.id}`}
                  className="bg-white border border-orange-200 rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden group">
                      <button
                        type="button"
                        onClick={() => handleInspectWithSave(part)}
                        className="block w-full h-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                      >
                        <PartImage
                          src={part.imageUrl}
                          alt={part.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </button>

                      {offer.hasOffer && (
                        <span className="absolute top-2.5 left-2.5 z-10 px-2 py-1 text-[11px] font-mono tabular-nums font-bold text-white bg-orange-600 rounded-md shadow-xs">
                          -{offer.discountPercent}% OFF
                        </span>
                      )}
                      {getPartImageGallery(part).length > 1 && (
                        <span className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-semibold text-white bg-slate-900/75 rounded">
                          1/{getPartImageGallery(part).length}
                        </span>
                      )}

                      {onToggleWishlist && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWishlist(part);
                          }}
                          aria-pressed={isSaved}
                          aria-label={
                            isSaved
                              ? `Remove ${part.name} from wishlist`
                              : `Save ${part.name} to wishlist`
                          }
                          className={`absolute top-2.5 right-2.5 z-10 w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-150 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                            isSaved
                              ? 'bg-white/95 border-rose-200 text-rose-600 hover:bg-rose-50'
                              : 'bg-white/90 border-slate-200/90 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-white'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform duration-150 ${
                              isSaved ? 'fill-rose-500 text-rose-600 scale-105' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    <div className="p-3.5 sm:p-4 pb-2.5 sm:pb-3">
                      <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                        {[part.brand, part.carModel, part.yearOfMake].filter(Boolean).join(' · ') || ''}
                        {[part.brand, part.carModel, part.yearOfMake].some(Boolean) ? ' · ' : ''}
                        {part.category} · {part.subcategory}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleInspectWithSave(part)}
                        className="mt-1 text-left block w-full"
                      >
                        <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 hover:text-orange-700 transition-colors line-clamp-1">
                          {part.name}
                        </h3>
                      </button>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {part.description}
                      </p>
                      {(() => {
                        const condInfo =
                          part.category === 'Body parts'
                            ? getBodyPartConditionInfo(part.conditionGrade)
                            : null;
                        return (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            {condInfo ? (
                              <span className="font-semibold text-slate-700">
                                {condInfo.shortLabel}
                              </span>
                            ) : (
                              <span />
                            )}
                            <a
                              href={getWhatsAppPartShareUrl(part, part.imageUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                              title="Share this photo to another party on WhatsApp"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Share Photo</span>
                            </a>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-2.5 sm:pt-3 border-t border-orange-100 bg-orange-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-orange-700">
                          {formatCurrency(part.price)}
                        </span>
                        {offer.previousPrice !== null && (
                          <span className="text-xs font-mono tabular-nums text-slate-400 line-through">
                            {formatCurrency(offer.previousPrice)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-emerald-700 tabular-nums">
                        Save {formatCurrency(offer.savingsAmount)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                      {!isAdmin && onOpenBargainPart && (
                        <button
                          type="button"
                          onClick={() => onOpenBargainPart(part)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-orange-400 hover:text-orange-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Handshake className="w-3.5 h-3.5" />
                          <span>Bargain</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onAddToCart(part)}
                        className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          justAdded
                            ? 'bg-emerald-700 text-white'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }`}
                      >
                        {justAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Catalog & Category Filtering Section */}
      <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div
          id="categories-section"
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200"
        >
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Spare Parts Catalog
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Select your car type first, then choose a part category and part type, or search directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onToggleOffersFilter && (
              <button
                type="button"
                onClick={onToggleOffersFilter}
                aria-pressed={offersFilterActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  offersFilterActive
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:text-orange-700'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Offers ({offerParts.length})</span>
              </button>
            )}
            {onToggleWishlistFilter && (
              <button
                type="button"
                onClick={onToggleWishlistFilter}
                aria-pressed={wishlistFilterActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  wishlistFilterActive
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:text-rose-700'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    wishlistFilterActive
                      ? 'fill-white text-white'
                      : wishlistIds.length > 0 && currentUser
                        ? 'fill-rose-500 text-rose-600'
                        : ''
                  }`}
                />
                <span>
                  Saved Wishlist
                  {currentUser ? ` (${wishlistIds.length})` : ''}
                </span>
              </button>
            )}
            {onOpenWishlist && currentUser && wishlistIds.length > 0 && !wishlistFilterActive && (
              <button
                type="button"
                onClick={onOpenWishlist}
                className="text-xs font-semibold text-rose-700 hover:text-rose-800 underline underline-offset-2 whitespace-nowrap shrink-0"
              >
                Open Saved Drawer
              </button>
            )}
            {!isAdmin && onOpenMyBargains && (
              <button
                type="button"
                onClick={onOpenMyBargains}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Handshake className="w-3.5 h-3.5 text-orange-600" />
                <span>My Bargains</span>
                {actionableBargainsCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] leading-none font-mono tabular-nums font-bold bg-emerald-600 text-white rounded">
                    {actionableBargainsCount}
                  </span>
                )}
              </button>
            )}
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {loading ? 'Loading...' : `${parts.length} ${parts.length === 1 ? 'item' : 'items'} shown`}
            </span>
          </div>
        </div>

        {/* Step 1: Car Type (Car Brand) Selector FIRST */}
        <div className="mt-5 bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 mr-1">
            <Car className="w-3.5 h-3.5 text-orange-600" />
            <span>1. Car Type:</span>
          </span>
          <button
            type="button"
            onClick={() => onSelectBrand('All')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              selectedBrand === 'All'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-white'
            }`}
          >
            All Car Types
          </button>
          {CAR_BRANDS.map((brand) => {
            const active = selectedBrand === brand;
            return (
              <button
                key={brand}
                type="button"
                onClick={() => onSelectBrand(brand)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-orange-600 text-white border-orange-600 font-semibold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                {brand}
              </button>
            );
          })}
        </div>

        {/* Optional Customer Saved Vehicle (Car Model & Year of Make) */}
        {!isAdmin && onSaveCustomerVehicle && (
          <div className="mt-2.5 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5">
            {!vehicleEditorOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 min-w-0">
                  <Car className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  {hasSavedVehicle ? (
                    <>
                      <span className="font-semibold text-slate-900">Saved Car:</span>
                      <span className="font-medium text-slate-800">
                        {[
                          customerVehicle?.brand,
                          customerVehicle?.carModel,
                          customerVehicle?.yearOfMake,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 font-mono tabular-nums">
                        {matchingVehiclePartsCount}{' '}
                        {matchingVehiclePartsCount === 1 ? 'matching part' : 'matching parts'}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600">
                      <strong className="font-semibold text-slate-900">Optional:</strong> Save your
                      car model &amp; year of make so matching spare parts appear first.
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {hasSavedVehicle && onToggleMatchMyCarOnly && (
                    <button
                      type="button"
                      onClick={onToggleMatchMyCarOnly}
                      aria-pressed={matchMyCarOnly}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                        matchMyCarOnly
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
                      }`}
                    >
                      {matchMyCarOnly ? 'Showing My Car Only' : 'Show My Car Parts Only'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVehicleEditorOpen(true)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                  >
                    {hasSavedVehicle ? 'Edit Car' : 'Save My Car'}
                  </button>
                  {hasSavedVehicle && (
                    <button
                      type="button"
                      onClick={() => {
                        onSaveCustomerVehicle({ brand: '', carModel: '', yearOfMake: '' });
                        setVehicleBrandDraft('');
                        setVehicleModelDraft('');
                        setVehicleYearDraft('');
                      }}
                      className="text-xs font-medium text-slate-500 hover:text-red-600 whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveCustomerVehicle({
                    brand: (vehicleBrandDraft as CarBrand | '') || '',
                    carModel: vehicleModelDraft.trim(),
                    yearOfMake: vehicleYearDraft.trim(),
                  });
                  setVehicleEditorOpen(false);
                }}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Car Brand (Optional)
                  </label>
                  <select
                    value={vehicleBrandDraft}
                    onChange={(e) => setVehicleBrandDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    <option value="">Any Brand</option>
                    {CAR_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Car Model (Optional)
                  </label>
                  <input
                    type="text"
                    value={vehicleModelDraft}
                    onChange={(e) => setVehicleModelDraft(e.target.value)}
                    placeholder="e.g. Fielder, Premio, Note"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Year of Make
                  </label>
                  <input
                    type="text"
                    value={vehicleYearDraft}
                    onChange={(e) => setVehicleYearDraft(e.target.value)}
                    placeholder="e.g. 2015"
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div className="sm:col-span-3 flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors whitespace-nowrap"
                  >
                    Save Car
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleEditorOpen(false)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Step 2: Part Category Tabs & Inline Search */}
        <div className="mt-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              2. Part Category:
            </span>
            <div
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start"
              role="tablist"
              aria-label="Primary spare part categories"
            >
              {(['All', ...PRIMARY_CATEGORIES] as const).map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelectCategory(cat)}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat === 'All' ? 'All Parts' : cat}
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={(e) => handleSearchSubmit(e, 'inline')}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                saveSearchQuery(searchQuery);
                setActiveSearchBar((prev) => (prev === 'inline' ? null : prev));
              }
            }}
            className="relative w-full lg:w-80"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              role="combobox"
              aria-expanded={activeSearchBar === 'inline' && totalDropdownItems > 0}
              aria-autocomplete="list"
              onFocus={() => setActiveSearchBar('inline')}
              onKeyDown={(e) => handleSearchKeyDown(e, 'inline')}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setActiveSearchBar('inline');
              }}
              placeholder="Filter visible items..."
              aria-label="Filter spare parts"
              autoComplete="off"
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {renderSuggestionsDropdown('inline')}
          </form>
        </div>

        {/* Step 3: Part Type Subcategory Selector (shown after selecting a primary category) */}
        {activeSubcategories.length > 0 && (
          <div className="mt-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Part Type:
              </span>
              <button
                type="button"
                onClick={() => onSelectSubcategory('All')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  selectedSubcategory === 'All'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                All {selectedCategory}
              </button>
              {activeSubcategories.map((sub) => {
                const active = selectedSubcategory === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => onSelectSubcategory(sub)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Catalog Grid States */}
        {error ? (
          <div className="mt-8 bg-white border border-red-200 rounded-xl p-8 text-center">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={onRetryFetch}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Retry Loading Parts
            </button>
          </div>
        ) : loading ? (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
              >
                <div className="aspect-4/3 bg-slate-200" />
                <div className="p-3.5 sm:p-5 space-y-2.5 sm:space-y-3">
                  <div className="h-3 w-24 sm:w-28 bg-slate-200 rounded" />
                  <div className="h-4 sm:h-5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3.5 sm:h-4 w-full bg-slate-100 rounded" />
                  <div className="h-8 sm:h-9 w-full bg-slate-200 rounded-lg mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : parts.length === 0 ? (
          <div className="mt-8 bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {wishlistFilterActive
                ? 'No saved wishlist parts match these filters'
                : offersFilterActive
                  ? 'No active offer items match these filters'
                  : 'No matching spare parts found'}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5">
              {wishlistFilterActive ? (
                'Tap the heart icon on any spare part card in the catalog to bookmark parts here, or view all catalog items.'
              ) : offersFilterActive ? (
                'No items are currently listed on special offer for these filters. Clear the Offers filter to browse the full catalog.'
              ) : (
                <>
                  Try clearing your search filter or contact Customer Care on{' '}
                  <span className="font-mono font-medium text-slate-800">{CUSTOMER_CARE_NUMBER}</span>{' '}
                  to source the exact part for your vehicle.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {wishlistFilterActive && onToggleWishlistFilter && (
                <button
                  type="button"
                  onClick={onToggleWishlistFilter}
                  className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                >
                  Show All Catalog Parts
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  onSelectCategory('All');
                  onSelectSubcategory('All');
                  onSelectBrand('All');
                  onClearOffersFilter?.();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Reset Filters
              </button>
              {isAdmin && onOpenAdminChats ? (
                <button
                  type="button"
                  onClick={onOpenAdminChats}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  View Customer Chats
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSupport}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Ask Customer Care
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
            {parts.map((part) => {
              const qtyInCart = cartQuantities[part.id] || 0;
              const justAdded = recentlyAddedId === part.id;
              const isSaved = Boolean(currentUser) && wishlistIds.includes(part.id);
              const offer = getPartOfferDetails(part);

              return (
                <article
                  key={part.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden group">
                      <button
                        type="button"
                        onClick={() => handleInspectWithSave(part)}
                        className="block w-full h-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                      >
                        <PartImage
                          src={part.imageUrl}
                          alt={part.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </button>

                      {offer.hasOffer && (
                        <span className="absolute top-2.5 left-2.5 z-10 px-2 py-1 text-[11px] font-mono tabular-nums font-bold text-white bg-orange-600 rounded-md shadow-xs">
                          -{offer.discountPercent}% OFF
                        </span>
                      )}
                      {getPartImageGallery(part).length > 1 && (
                        <span className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-semibold text-white bg-slate-900/75 rounded">
                          1/{getPartImageGallery(part).length}
                        </span>
                      )}

                      {onToggleWishlist && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWishlist(part);
                          }}
                          aria-pressed={isSaved}
                          aria-label={
                            isSaved
                              ? `Remove ${part.name} from wishlist`
                              : `Save ${part.name} to wishlist`
                          }
                          title={
                            currentUser
                              ? isSaved
                                ? 'Saved in wishlist — click to remove'
                                : 'Save to wishlist'
                              : 'Sign in to save to wishlist'
                          }
                          className={`absolute top-2.5 right-2.5 z-10 w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-150 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                            isSaved
                              ? 'bg-white/95 border-rose-200 text-rose-600 hover:bg-rose-50'
                              : 'bg-white/90 border-slate-200/90 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-white'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform duration-150 ${
                              isSaved ? 'fill-rose-500 text-rose-600 scale-105' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    <div className="p-3.5 sm:p-4 pb-2.5 sm:pb-3">
                      {(() => {
                        const vehicleLabel = [part.brand, part.carModel, part.yearOfMake]
                          .filter(Boolean)
                          .join(' · ');
                        const isCarMatch =
                          hasSavedVehicle &&
                          doesPartMatchCustomerVehicle(part, customerVehicle);
                        return (
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                              {vehicleLabel ? `${vehicleLabel} · ` : ''}
                              {part.category} · {part.subcategory}
                            </p>
                            {isCarMatch && (
                              <span className="text-[10px] font-semibold text-orange-700 whitespace-nowrap shrink-0">
                                Matches Car
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => handleInspectWithSave(part)}
                        className="mt-1 sm:mt-1.5 text-left block w-full"
                      >
                        <h3 className="font-display text-sm sm:text-base font-semibold text-slate-900 hover:text-orange-700 transition-colors line-clamp-1">
                          {part.name}
                        </h3>
                      </button>
                      <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {part.description}
                      </p>
                      {(() => {
                        const condInfo =
                          part.category === 'Body parts'
                            ? getBodyPartConditionInfo(part.conditionGrade)
                            : null;
                        return (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            {condInfo ? (
                              <span className="font-semibold text-slate-700">
                                {condInfo.shortLabel}
                              </span>
                            ) : (
                              <span />
                            )}
                            <a
                              href={getWhatsAppPartShareUrl(part, part.imageUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                              title="Share this photo to another party on WhatsApp"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Share Photo</span>
                            </a>
                          </div>
                        );
                      })()}
                      {isGearboxPart(part) && (() => {
                        const catalogSource = allParts && allParts.length > 0 ? allParts : parts;
                        const oilMatch = getMatchingGearboxOils(part, catalogSource);
                        const primaryOil = oilMatch.primaryOil;
                        const pairTotal = primaryOil ? primaryOil.price * GEARBOX_OIL_PAIR_CANS : 0;
                        return (
                          <div className="mt-2.5 rounded-lg bg-orange-50/80 border border-orange-200 px-2.5 py-2 space-y-1.5">
                            <div className="flex items-start gap-1.5">
                              <Droplets className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                              <div className="min-w-0 text-[11px] leading-snug text-slate-800">
                                <span className="font-semibold text-orange-800">Uses:</span>{' '}
                                <span className="font-semibold">{oilMatch.oilSpecLabel}</span>
                              </div>
                            </div>
                            {primaryOil && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-orange-200/70">
                                <button
                                  type="button"
                                  onClick={() => handleInspectWithSave(primaryOil)}
                                  className="min-w-0 text-left text-[11px] font-medium text-slate-800 hover:text-orange-700 truncate underline decoration-orange-300 underline-offset-2"
                                  title={`Inspect ${primaryOil.name}`}
                                >
                                  Pair: {primaryOil.name}
                                </button>
                                {onAddGearboxBundle && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onAddGearboxBundle(part, 1, primaryOil, GEARBOX_OIL_PAIR_CANS)
                                    }
                                    className="px-2 py-1 text-[10px] font-semibold text-orange-900 bg-white hover:bg-orange-100 border border-orange-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                                    title={`Add ${part.name} + ${GEARBOX_OIL_PAIR_CANS} × ${GEARBOX_OIL_CAN_LITRES}L ${primaryOil.name}`}
                                  >
                                    + Bundle ({formatCurrency(pairTotal)})
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div>
                      {offer.hasOffer && offer.previousPrice !== null ? (
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <p className="text-sm sm:text-base font-mono tabular-nums font-bold text-orange-700">
                            {formatCurrency(part.price)}
                          </p>
                          <span className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-400 line-through">
                            {formatCurrency(offer.previousPrice)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm sm:text-base font-mono tabular-nums font-bold text-slate-900">
                          {formatCurrency(part.price)}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {offer.hasOffer && (
                          <span className="text-emerald-700 font-medium">
                            Save {formatCurrency(offer.savingsAmount)} ·{' '}
                          </span>
                        )}
                        {part.stock > 0 ? `${part.stock} available` : 'Order basis'}
                        {qtyInCart > 0 ? ` · ${qtyInCart} in cart` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                      {!isAdmin && onOpenBargainPart && (
                        <button
                          type="button"
                          onClick={() => onOpenBargainPart(part)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-orange-400 hover:text-orange-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Handshake className="w-3.5 h-3.5" />
                          <span>Bargain</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onAddToCart(part)}
                        className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          justAdded
                            ? 'bg-emerald-700 text-white'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }`}
                      >
                        {justAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Mechanic Testimonials & Customer Reviews */}
      <section
        id="reviews-section"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">
              <Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span>
                {reviewsAvgRating.toFixed(1)} / 5.0 · {reviews.length}{' '}
                {reviews.length === 1 ? 'Verified Review' : 'Verified Reviews'}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
              Mechanic Testimonials & Customer Reviews
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Real feedback from mobile mechanics, independent garages, and vehicle owners across Kenya.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowReviewForm((prev) => !prev);
              setReviewError(null);
              setReviewSuccess(null);
              if (currentUser && !reviewAuthorName) {
                setReviewAuthorName(currentUser.name);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors self-start md:self-auto whitespace-nowrap shrink-0"
          >
            <Star className="w-3.5 h-3.5 text-orange-400" />
            <span>{showReviewForm ? 'Close Review Form' : 'Write a Review / Testimonial'}</span>
          </button>
        </div>

        {reviewSuccess && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{reviewSuccess}</span>
          </div>
        )}

        {showReviewForm && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setReviewError(null);
              setReviewSuccess(null);
              setSubmittingReview(true);
              try {
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (authToken) headers.Authorization = `Bearer ${authToken}`;
                const res = await fetch('/api/reviews', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    authorName: reviewAuthorName.trim(),
                    authorType: reviewAuthorType,
                    garageOrVehicle: reviewContext.trim(),
                    rating: reviewRating,
                    comment: reviewComment.trim(),
                  }),
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) {
                  setReviewError(data.error || 'Could not submit review.');
                  return;
                }
                setReviewAuthorName('');
                setReviewContext('');
                setReviewComment('');
                setReviewRating(5);
                setShowReviewForm(false);
                setReviewSuccess('Thank you! Your review has been published.');
                await onReviewsChanged?.();
              } catch {
                setReviewError('Network error while submitting review.');
              } finally {
                setSubmittingReview(false);
              }
            }}
            className="mt-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900">
                Share Your Experience with {`My Spare Zone`}
              </h3>
              <span className="text-[11px] text-slate-500">
                Respectful feedback only — abusive language is filtered and moderated
              </span>
            </div>

            {reviewError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {reviewError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={reviewAuthorName}
                  onChange={(e) => setReviewAuthorName(e.target.value)}
                  placeholder="e.g. Peter Mwangi"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Role
                </label>
                <select
                  value={reviewAuthorType}
                  onChange={(e) => setReviewAuthorType(e.target.value as ReviewAuthorType)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                >
                  <option value="mechanic">Mobile / Independent Mechanic</option>
                  <option value="garage">Garage / Workshop</option>
                  <option value="customer">Vehicle Owner / Customer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Workshop or Car Model (Optional)
                </label>
                <input
                  type="text"
                  value={reviewContext}
                  onChange={(e) => setReviewContext(e.target.value)}
                  placeholder="e.g. Apex Garage or Toyota Fielder"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1">Rating</span>
              <div className="inline-flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starValue) => (
                  <button
                    key={starValue}
                    type="button"
                    onClick={() => setReviewRating(starValue)}
                    className="p-1 text-orange-500 hover:scale-110 transition-transform"
                    aria-label={`Rate ${starValue} stars`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        starValue <= reviewRating
                          ? 'fill-orange-500 text-orange-500'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-mono text-slate-600 ml-2">{reviewRating} / 5</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Testimonial / Review
              </label>
              <textarea
                rows={3}
                required
                minLength={8}
                maxLength={500}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Tell fellow mechanics and drivers about part fitment, delivery speed, or service quality..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {submittingReview ? 'Publishing...' : 'Publish Review'}
              </button>
            </div>
          </form>
        )}

        {reviews.length === 0 ? (
          <div className="mt-6 bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            No customer or mechanic reviews posted yet. Be the first to share your experience.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reviews.map((rev) => {
              const roleLabel =
                rev.authorType === 'garage'
                  ? 'Partner Garage'
                  : rev.authorType === 'mechanic'
                    ? 'Mechanic Testimonial'
                    : 'Customer Review';
              return (
                <article
                  key={rev.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          rev.authorType === 'customer'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-orange-50 text-orange-800 border-orange-200'
                        }`}
                      >
                        {roleLabel}
                      </span>
                      <div className="flex items-center gap-0.5" aria-label={`${rev.rating} out of 5 stars`}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating
                                ? 'fill-orange-500 text-orange-500'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      “{rev.comment}”
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{rev.authorName}</p>
                      {rev.garageOrVehicle && (
                        <p className="text-[11px] text-slate-500 truncate">{rev.garageOrVehicle}</p>
                      )}
                    </div>
                    {isAdmin && authToken && (
                      <button
                        type="button"
                        disabled={deletingReviewId === rev.id}
                        onClick={async () => {
                          setDeletingReviewId(rev.id);
                          try {
                            const res = await fetch(`/api/reviews/${encodeURIComponent(rev.id)}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${authToken}` },
                            });
                            if (res.ok) {
                              await onReviewsChanged?.();
                            }
                          } finally {
                            setDeletingReviewId(null);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors shrink-0"
                        title="Admin: Delete review"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{deletingReviewId === rev.id ? '...' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
