import { useEffect, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  ShieldCheck,
  Phone,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  MessageCircle,
  Wrench,
  Droplets,
  Heart,
  Handshake,
  Share2,
} from 'lucide-react';
import type { PrimaryCategory, SparePart } from '../types';
import {
  CUSTOMER_CARE_NUMBER,
  formatCurrency,
  GARAGE_FITTING_SERVICE_NOTICE,
  GEARBOX_OIL_CAN_LITRES,
  GEARBOX_OIL_LITRES_NEEDED,
  GEARBOX_OIL_PAIR_CANS,
  getBodyPartConditionInfo,
  getMatchingGearboxOils,
  getPartImageGallery,
  getPartOfferDetails,
  getWhatsAppPartShareUrl,
  getWhatsAppSupportUrl,
  GUARANTEE_NOTICE,
  isGearboxPart,
  MECHANIC_SERVICE_NOTICE,
  PHYSICAL_STORE_HOURS,
  resolveAbsoluteAssetUrl,
} from '../constants/catalog';
import { PartImage } from './PartImage';

interface PartDetailModalProps {
  part: SparePart | null;
  allParts: SparePart[];
  onClose: () => void;
  onSelectPart: (part: SparePart) => void;
  onAddToCart: (part: SparePart, quantity: number) => void;
  onAddGearboxBundle?: (
    gearbox: SparePart,
    gearboxQty: number,
    oil: SparePart,
    oilCans: number,
  ) => void;
  onOpenBargain?: (part: SparePart, quantity: number) => void;
  onOpenSupport: () => void;
  isAdmin?: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: (part: SparePart) => void;
}

const COMPLEMENTARY_CATEGORIES: Record<PrimaryCategory, PrimaryCategory[]> = {
  'Body parts': ['Body parts', 'Electricals', 'Mechanical Parts', 'Dashboard & Interior Parts', 'Gearbox Oil'],
  Electricals: ['Electricals', 'Body parts', 'Mechanical Parts', 'Dashboard & Interior Parts', 'Gearbox Oil'],
  'Mechanical Parts': ['Mechanical Parts', 'Gearbox Oil', 'Electricals', 'Body parts', 'Dashboard & Interior Parts'],
  'Gearbox Oil': ['Gearbox Oil', 'Mechanical Parts', 'Electricals', 'Body parts', 'Dashboard & Interior Parts'],
  'Dashboard & Interior Parts': ['Dashboard & Interior Parts', 'Electricals', 'Body parts', 'Mechanical Parts', 'Gearbox Oil'],
};

function getFrequentlyBoughtTogether(
  current: SparePart,
  catalog: SparePart[],
  matchingOils: SparePart[],
): SparePart[] {
  const matchingOilIds = new Set(matchingOils.map((o) => o.id));
  const candidates = catalog.filter(
    (item) => item.id !== current.id && !matchingOilIds.has(item.id),
  );
  const priorityOrder = COMPLEMENTARY_CATEGORIES[current.category];

  const sortedOthers = [...candidates].sort((a, b) => {
    const rankA = priorityOrder.indexOf(a.category);
    const rankB = priorityOrder.indexOf(b.category);
    if (rankA !== rankB) return rankA - rankB;
    const diffSubA = a.subcategory !== current.subcategory ? 0 : 1;
    const diffSubB = b.subcategory !== current.subcategory ? 0 : 1;
    return diffSubA - diffSubB;
  });

  const targetCount = Math.max(3, matchingOils.length);
  return [...matchingOils, ...sortedOthers].slice(0, targetCount);
}

const ZOOM_STEPS = [1, 1.5, 2, 2.5];

export function PartDetailModal({
  part,
  allParts,
  onClose,
  onSelectPart,
  onAddToCart,
  onAddGearboxBundle,
  onOpenBargain,
  onOpenSupport,
  isAdmin = false,
  isWishlisted = false,
  onToggleWishlist,
}: PartDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [panOrigin, setPanOrigin] = useState({ x: 50, y: 50 });
  const [addedRecIds, setAddedRecIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setQuantity(1);
    setActiveImageIndex(0);
    setIsLightboxOpen(false);
    setZoomIndex(0);
    setPanOrigin({ x: 50, y: 50 });
    setAddedRecIds({});
  }, [part?.id]);

  useEffect(() => {
    if (!part) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLightboxOpen) {
          setIsLightboxOpen(false);
          setZoomIndex(0);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [part, isLightboxOpen, onClose]);

  if (!part) return null;

  const galleryImages = getPartImageGallery(part);
  const safeActiveIndex = activeImageIndex < galleryImages.length ? activeImageIndex : 0;
  const activeImageSrc = galleryImages[safeActiveIndex] || part.imageUrl;
  const condInfo =
    part.category === 'Body parts' ? getBodyPartConditionInfo(part.conditionGrade) : null;
  const vehicleFitment = [part.brand, part.carModel, part.yearOfMake].filter(Boolean).join(' · ');
  const whatsappShareUrl = getWhatsAppPartShareUrl(part, activeImageSrc);
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativePhotoShare = async () => {
    if (!canNativeShare) return;
    try {
      const resolvedUrl = resolveAbsoluteAssetUrl(activeImageSrc);
      const res = await fetch(resolvedUrl);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const file = new File([blob], `${part.sku || 'spare-part'}.${ext}`, {
        type: blob.type || 'image/jpeg',
      });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: part.name,
          text: `${part.name}${vehicleFitment ? ` (${vehicleFitment})` : ''} — ${formatCurrency(part.price)} at My Spare Zone`,
          files: [file],
        });
        return;
      }
      await navigator.share({
        title: part.name,
        text: `${part.name}${vehicleFitment ? ` (${vehicleFitment})` : ''} — ${formatCurrency(part.price)}`,
        url: resolvedUrl,
      });
    } catch {
      // user cancelled or share unsupported
    }
  };

  const zoomScale = ZOOM_STEPS[zoomIndex];
  const isGearbox = isGearboxPart(part);
  const matchingOilInfo = isGearbox ? getMatchingGearboxOils(part, allParts) : null;
  const matchingOils = matchingOilInfo?.oils ?? [];
  const primaryOil = matchingOilInfo?.primaryOil ?? null;
  const exactOilIds = new Set(matchingOilInfo?.exactOilIds ?? []);
  const featuredOilIds = new Set(matchingOils.map((o) => o.id));
  const recommendedParts = getFrequentlyBoughtTogether(part, allParts, matchingOils);

  const handleAdd = () => {
    onAddToCart(part, quantity);
    setQuantity(1);
    onClose();
  };

  const handleAddBundle = () => {
    if (!primaryOil || !onAddGearboxBundle) {
      handleAdd();
      return;
    }
    const bundleOilCans = quantity * GEARBOX_OIL_PAIR_CANS;
    onAddGearboxBundle(part, quantity, primaryOil, bundleOilCans);
    setQuantity(1);
    onClose();
  };

  const handleAddRecommended = (rec: SparePart, qty = 1) => {
    onAddToCart(rec, qty);
    setAddedRecIds((prev) => ({ ...prev, [rec.id]: true }));
    window.setTimeout(() => {
      setAddedRecIds((prev) => ({ ...prev, [rec.id]: false }));
    }, 1400);
  };

  const openLightbox = () => {
    setZoomIndex(0);
    setPanOrigin({ x: 50, y: 50 });
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setZoomIndex(0);
    setPanOrigin({ x: 50, y: 50 });
  };

  const handleLightboxPointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setPanOrigin({ x, y });
  };

  const handleToggleImageZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setPanOrigin({ x, y });
    setZoomIndex((prev) => (prev === 0 ? 2 : 0));
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdp-title"
      >
        <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden my-6 grid grid-cols-1 md:grid-cols-2">
          {/* Left: Clickable Product Gallery (up to 3 photos, 1st = Cover) */}
          <div className="bg-slate-100 flex flex-col">
            <div className="aspect-4/3 md:flex-1 md:min-h-[320px] relative group overflow-hidden">
              <button
                type="button"
                onClick={openLightbox}
                className="w-full h-full block relative overflow-hidden cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                aria-label={`Inspect ${part.name} in full-screen zoom lightbox`}
              >
                <PartImage
                  src={activeImageSrc}
                  alt={`${part.name} photo ${safeActiveIndex + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {galleryImages.length > 1 && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 text-[11px] font-mono tabular-nums font-semibold text-white bg-slate-900/75 rounded">
                    {safeActiveIndex === 0 ? 'Cover' : `Angle ${safeActiveIndex + 1}`} · {safeActiveIndex + 1}/{galleryImages.length}
                  </span>
                )}
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900/80 backdrop-blur-xs rounded-lg opacity-90 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Zoom</span>
                </span>
              </button>
            </div>
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-white border-t border-slate-200">
                {galleryImages.map((imgSrc, idx) => {
                  const isActiveThumb = idx === safeActiveIndex;
                  return (
                    <button
                      key={`${part.id}-thumb-${idx}`}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative aspect-4/3 rounded-md overflow-hidden border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                        isActiveThumb
                          ? 'border-orange-600 ring-2 ring-orange-600/30'
                          : 'border-slate-200 opacity-80 hover:opacity-100 hover:border-slate-400'
                      }`}
                    >
                      <PartImage
                        src={imgSrc}
                        alt={`${part.name} view ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white bg-slate-900/75 rounded-xs">
                        {idx === 0 ? 'Cover' : `#${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Gallery Share Strip */}
            <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                Send picture to a mechanic or friend:
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Photo on WhatsApp</span>
                </a>
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={() => void handleNativePhotoShare()}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap"
                  >
                    <span>Send File</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-medium text-slate-500">
                  {vehicleFitment ? `${vehicleFitment} · ` : ''}
                  {part.category} · {part.subcategory}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onToggleWishlist && (
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(part)}
                      aria-pressed={isWishlisted}
                      aria-label={
                        isWishlisted
                          ? `Remove ${part.name} from wishlist`
                          : `Save ${part.name} to wishlist`
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                        isWishlisted
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : 'bg-white text-slate-600 border-slate-200 hover:text-rose-600 hover:border-rose-200'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          isWishlisted ? 'fill-rose-500 text-rose-600' : ''
                        }`}
                      />
                      <span>{isWishlisted ? 'Saved' : 'Save'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
                    aria-label="Close product details"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h2
                id="pdp-title"
                className="font-display text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 text-balance"
              >
                {part.name}
              </h2>

              {(() => {
                const offer = getPartOfferDetails(part);
                return (
                  <div className="mt-3 space-y-1.5">
                    {offer.hasOffer && offer.previousPrice !== null && (
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-orange-800 bg-orange-50 border border-orange-200 rounded-md px-2.5 py-1">
                        <span>Special Offer · {offer.discountPercent}% OFF</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono tabular-nums">
                          Save {formatCurrency(offer.savingsAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-2xl font-mono tabular-nums font-bold text-slate-900">
                        {formatCurrency(part.price)}
                      </span>
                      {offer.hasOffer && offer.previousPrice !== null && (
                        <span className="text-sm font-mono tabular-nums text-slate-400 line-through">
                          {formatCurrency(offer.previousPrice)}
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-500">SKU: {part.sku}</span>
                    </div>
                  </div>
                );
              })()}

              <p className="mt-4 text-sm text-slate-600 leading-relaxed">{part.description}</p>

              {(part.carModel || part.yearOfMake || condInfo) && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 space-y-1.5 text-xs">
                  {(part.carModel || part.yearOfMake) && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Vehicle Fitment</span>
                      <span className="font-semibold text-slate-900">
                        {[part.brand, part.carModel, part.yearOfMake].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  {condInfo && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Body Part Condition</span>
                      <span className="font-semibold text-slate-900">{condInfo.label}</span>
                    </div>
                  )}
                </div>
              )}

              {isGearbox && matchingOilInfo && (
                <div className="mt-4 rounded-lg bg-orange-50/80 border border-orange-200 px-3.5 py-3 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Droplets className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-800">
                        Required Gearbox Oil
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {matchingOilInfo.oilSpecLabel}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Approx. {GEARBOX_OIL_LITRES_NEEDED}L capacity ({quantity * GEARBOX_OIL_PAIR_CANS} ×{' '}
                        {GEARBOX_OIL_CAN_LITRES}L cans recommended)
                      </p>
                    </div>
                  </div>
                  {primaryOil && (
                    <div className="pt-2 border-t border-orange-200/80 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onSelectPart(primaryOil)}
                        className="text-left font-semibold text-slate-900 hover:text-orange-700 underline decoration-orange-300 underline-offset-2 truncate"
                      >
                        Exact Match: {primaryOil.name}
                      </button>
                      <span className="font-mono font-bold text-orange-800 whitespace-nowrap shrink-0">
                        {formatCurrency(primaryOil.price * quantity * GEARBOX_OIL_PAIR_CANS)} (
                        {quantity * GEARBOX_OIL_PAIR_CANS} cans)
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Availability</span>
                  <span className="font-medium text-slate-900 tabular-nums">
                    {part.stock > 0 ? `In stock (${part.stock} units)` : 'Available on order'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 pt-1">
                  <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>{GUARANTEE_NOTICE}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-slate-300 rounded-lg bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-slate-600 hover:text-slate-900"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm font-mono tabular-nums font-semibold text-slate-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2.5 text-slate-600 hover:text-slate-900"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Cart</span>
                </button>
              </div>

              {!isAdmin && onOpenBargain && (
                <button
                  type="button"
                  onClick={() => onOpenBargain(part, quantity)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-700 rounded-lg transition-colors"
                >
                  <Handshake className="w-4 h-4 text-orange-600" />
                  <span>
                    Make an Offer / Bargain ({quantity} × {formatCurrency(part.price)})
                  </span>
                </button>
              )}

              {isGearbox && primaryOil && onAddGearboxBundle && (
                <button
                  type="button"
                  onClick={handleAddBundle}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Droplets className="w-4 h-4 text-orange-400" />
                  <span>
                    Add Gearbox + {quantity * GEARBOX_OIL_PAIR_CANS} × {GEARBOX_OIL_CAN_LITRES}L{' '}
                    {primaryOil.subcategory} Oil (
                    {formatCurrency(
                      part.price * quantity +
                        primaryOil.price * quantity * GEARBOX_OIL_PAIR_CANS,
                    )}
                    )
                  </span>
                </button>
              )}

              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Need fitment or mechanic help?</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={getWhatsAppSupportUrl(`Hello My Spare Zone, I am inquiring about ${part.name} (${part.sku}).`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                    {isAdmin ? (
                      <a
                        href={`tel:${CUSTOMER_CARE_NUMBER}`}
                        className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-orange-700"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call {CUSTOMER_CARE_NUMBER}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSupport();
                        }}
                        className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-orange-700"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call / Chat {CUSTOMER_CARE_NUMBER}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
                  <Wrench className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p>{MECHANIC_SERVICE_NOTICE}</p>
                    <p className="text-slate-500">
                      {GARAGE_FITTING_SERVICE_NOTICE} ({PHYSICAL_STORE_HOURS})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Frequently Bought Together Strip (includes matching Gearbox Oils in pairs for gearboxes) */}
          {recommendedParts.length > 0 && (
            <div className="md:col-span-2 border-t border-slate-200 bg-slate-50 px-6 sm:px-8 py-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Frequently Bought Together
                  </h3>
                  {matchingOilInfo && matchingOils.length > 0 ? (
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Detected <strong>{matchingOilInfo.label}</strong> — matching{' '}
                      <strong>{matchingOilInfo.oilSpecLabel}</strong> is suggested in pairs (
                      <strong>{GEARBOX_OIL_PAIR_CANS} × {GEARBOX_OIL_CAN_LITRES}L cans</strong>) because a gearbox uses around{' '}
                      <strong>{GEARBOX_OIL_LITRES_NEEDED} litres</strong> while each can is{' '}
                      <strong>{GEARBOX_OIL_CAN_LITRES} litres</strong>.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Recommended spare parts commonly paired with {part.category}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {recommendedParts.map((rec) => {
                  const wasAdded = !!addedRecIds[rec.id];
                  const isSuggestedOilPair = isGearbox && featuredOilIds.has(rec.id);
                  const isExactMatch = isSuggestedOilPair && exactOilIds.has(rec.id);
                  const addQty = isSuggestedOilPair ? GEARBOX_OIL_PAIR_CANS : 1;
                  const displayPrice = rec.price * addQty;

                  return (
                    <div
                      key={rec.id}
                      className={`rounded-lg p-3 flex items-center gap-3 border ${
                        isExactMatch
                          ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200'
                          : isSuggestedOilPair
                            ? 'bg-orange-50/60 border-orange-200'
                            : 'bg-white border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectPart(rec)}
                        className="w-16 h-12 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                        aria-label={`Inspect ${rec.name}`}
                      >
                        <PartImage
                          src={rec.imageUrl}
                          alt={rec.name}
                          className="w-full h-full object-cover"
                        />
                      </button>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[11px] truncate ${
                            isExactMatch
                              ? 'text-orange-800 font-semibold'
                              : isSuggestedOilPair
                                ? 'text-orange-700 font-medium'
                                : 'text-slate-500'
                          }`}
                        >
                          {isExactMatch
                            ? `Exact Oil Match · Pair (${GEARBOX_OIL_PAIR_CANS} × ${GEARBOX_OIL_CAN_LITRES}L)`
                            : isSuggestedOilPair
                              ? `Compatible Oil · Pair (${GEARBOX_OIL_PAIR_CANS} × ${GEARBOX_OIL_CAN_LITRES}L)`
                              : `${rec.brand ? `${rec.brand} · ` : ''}${rec.category} · ${rec.subcategory}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectPart(rec)}
                          className="text-left block w-full"
                        >
                          <p className="text-xs font-semibold text-slate-900 hover:text-orange-700 truncate">
                            {rec.name}
                          </p>
                        </button>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-mono tabular-nums font-bold text-slate-900">
                              {formatCurrency(displayPrice)}
                            </span>
                            {isSuggestedOilPair && (
                              <span className="text-[10px] text-slate-500 ml-1 tabular-nums">
                                ({formatCurrency(rec.price)}/can)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddRecommended(rec, addQty)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                              wasAdded
                                ? 'bg-emerald-700 text-white'
                                : isSuggestedOilPair
                                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                  : 'bg-slate-900 hover:bg-orange-600 text-white'
                            }`}
                          >
                            {wasAdded ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>{isSuggestedOilPair ? 'Pair Added' : 'Added'}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>
                                  {isSuggestedOilPair
                                    ? `Add Pair (${GEARBOX_OIL_PAIR_CANS})`
                                    : 'Add'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Image Zoom Overlay */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-sm flex flex-col no-print"
          role="dialog"
          aria-modal="true"
          aria-label={`Zoomed view of ${part.name}`}
          onClick={closeLightbox}
        >
          {/* Lightbox Toolbar */}
          <div
            className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between gap-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{part.name}</p>
              <p className="text-xs text-slate-400 font-mono truncate">
                {part.brand ? `${part.brand} · ` : ''}
                {part.category} · {part.subcategory} · {part.sku}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setZoomIndex((idx) => Math.max(0, idx - 1))}
                disabled={zoomIndex === 0}
                className="p-2 text-slate-200 hover:text-white hover:bg-white/10 disabled:opacity-35 rounded-lg transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono tabular-nums text-slate-200 min-w-[46px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() =>
                  setZoomIndex((idx) => Math.min(ZOOM_STEPS.length - 1, idx + 1))
                }
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
                className="p-2 text-slate-200 hover:text-white hover:bg-white/10 disabled:opacity-35 rounded-lg transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomIndex(0);
                  setPanOrigin({ x: 50, y: 50 });
                }}
                disabled={zoomIndex === 0}
                className="p-2 text-slate-200 hover:text-white hover:bg-white/10 disabled:opacity-35 rounded-lg transition-colors"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={closeLightbox}
                className="ml-2 p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Canvas */}
          <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
            <div
              onClick={handleToggleImageZoom}
              onMouseMove={handleLightboxPointerMove}
              className={`relative max-w-5xl max-h-full w-full h-full flex items-center justify-center overflow-hidden rounded-xl bg-slate-900/60 border border-white/10 select-none ${
                zoomScale > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
            >
              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-150 ease-out"
                style={{
                  transform: `scale(${zoomScale})`,
                  transformOrigin: `${panOrigin.x}% ${panOrigin.y}%`,
                }}
              >
                <PartImage
                  src={activeImageSrc}
                  alt={part.name}
                  className="max-w-full max-h-[78vh] w-auto h-auto object-contain"
                />
              </div>
            </div>
          </div>

          {galleryImages.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 pb-2"
              onClick={(e) => e.stopPropagation()}
            >
              {galleryImages.map((imgSrc, idx) => (
                <button
                  key={`lb-thumb-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveImageIndex(idx);
                    setZoomIndex(0);
                  }}
                  className={`w-14 h-11 rounded overflow-hidden border transition ${
                    idx === safeActiveIndex
                      ? 'border-orange-500 ring-2 ring-orange-500/40'
                      : 'border-white/20 opacity-70 hover:opacity-100'
                  }`}
                >
                  <PartImage
                    src={imgSrc}
                    alt={`${part.name} lightbox view ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Subtle Hint */}
          <div className="pb-4 text-center text-xs text-slate-400 pointer-events-none">
            {zoomScale > 1
              ? 'Move cursor to pan across part details · Click image to reset'
              : 'Click image or use + / − controls to zoom in and inspect part quality'}
          </div>
        </div>
      )}
    </>
  );
}
