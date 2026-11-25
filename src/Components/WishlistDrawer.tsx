import { X, Heart, ShoppingBag, Trash2, ArrowRight, UserCheck } from 'lucide-react';
import type { AuthUser, SparePart } from '../types';
import { formatCurrency, getPartOfferDetails } from '../constants/catalog';
import { PartImage } from './PartImage';

interface WishlistDrawerProps {
  isOpen: boolean;
  currentUser: AuthUser | null;
  parts: SparePart[];
  onClose: () => void;
  onInspectPart: (part: SparePart) => void;
  onAddToCart: (part: SparePart) => void;
  onRemoveFromWishlist: (part: SparePart) => void;
  onClearWishlist: () => void;
  onOpenAuth: () => void;
  onBrowseCatalog: () => void;
  onFilterCatalogToWishlist?: () => void;
}

export function WishlistDrawer({
  isOpen,
  currentUser,
  parts,
  onClose,
  onInspectPart,
  onAddToCart,
  onRemoveFromWishlist,
  onClearWishlist,
  onOpenAuth,
  onBrowseCatalog,
  onFilterCatalogToWishlist,
}: WishlistDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wishlist-drawer-title"
    >
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Heart className="w-5 h-5 text-rose-600 fill-rose-500 shrink-0" />
            <div>
              <h2 id="wishlist-drawer-title" className="font-display text-lg font-bold text-slate-900">
                Saved Wishlist
              </h2>
              <p className="text-xs text-slate-500">
                {currentUser
                  ? `${parts.length} ${parts.length === 1 ? 'part' : 'parts'} saved for later`
                  : 'Registered account required'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close wishlist drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {!currentUser ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-3.5 my-6">
              <div className="w-11 h-11 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
                <UserCheck className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Sign In to Save Spare Parts
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Wishlist saves are tied to your registered My Spare Zone account so you can bookmark parts now and return to order them anytime.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                <span>Sign In / Register</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : parts.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-3 my-6">
              <div className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto">
                <Heart className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Your Wishlist is Empty
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tap the heart icon on any spare part card in the catalog to save items for your vehicle service or garage order.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBrowseCatalog();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            parts.map((part) => (
              <div
                key={part.id}
                className="bg-white border border-slate-200 rounded-xl p-3.5 flex gap-3.5 items-start"
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInspectPart(part);
                  }}
                  className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                  aria-label={`Inspect ${part.name}`}
                >
                  <PartImage
                    src={part.imageUrl}
                    alt={part.name}
                    className="w-full h-full object-cover"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-500 truncate">
                    {part.brand ? `${part.brand} · ` : ''}
                    {part.subcategory}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onInspectPart(part);
                    }}
                    className="text-left block w-full mt-0.5"
                  >
                    <h3 className="font-display text-sm font-semibold text-slate-900 hover:text-orange-700 transition-colors line-clamp-2">
                      {part.name}
                    </h3>
                  </button>

                  {(() => {
                    const offer = getPartOfferDetails(part);
                    return (
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                            {formatCurrency(part.price)}
                          </span>
                          {offer.hasOffer && offer.previousPrice !== null && (
                            <>
                              <span className="text-xs font-mono tabular-nums text-slate-400 line-through">
                                {formatCurrency(offer.previousPrice)}
                              </span>
                              <span className="text-[10px] font-semibold text-orange-700">
                                -{offer.discountPercent}%
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                          {part.stock > 0 ? `${part.stock} in stock` : 'On order'}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAddToCart(part)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromWishlist(part)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 rounded-lg transition-colors"
                      aria-label={`Remove ${part.name} from wishlist`}
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {currentUser && parts.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 space-y-2.5">
            {onFilterCatalogToWishlist && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFilterCatalogToWishlist();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                <span>Show Saved Parts in Catalog</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClearWishlist}
              className="w-full px-4 py-2 text-xs font-semibold text-slate-600 hover:text-red-700 bg-white border border-slate-200 hover:border-red-200 rounded-lg transition-colors"
            >
              Clear Wishlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
