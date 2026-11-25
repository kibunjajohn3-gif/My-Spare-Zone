import { ShoppingBag, LogOut } from 'lucide-react';
import type { AuthUser } from '../types';
import { SHOP_NAME } from '../constants/catalog';
import { BrandWordmark } from './BrandWordmark';

export type ActivePage = 'storefront' | 'orders' | 'partner' | 'admin';

interface TopBarProps {
  activePage: ActivePage;
  isAdmin?: boolean;
  isAdminChatsActive?: boolean;
  unreadChatCount?: number;
  wishlistCount?: number;
  actionableBargainsCount?: number;
  cartCount: number;
  currentUser: AuthUser | null;
  onNavigateStorefront: (scrollToSection?: 'catalog' | 'categories') => void;
  onNavigateOrders: () => void;
  onNavigatePartner: () => void;
  onNavigateAdmin: () => void;
  onOpenAdminChats: () => void;
  onOpenSupport: () => void;
  onOpenWishlist: () => void;
  onOpenBargains?: () => void;
  onOpenAuth: () => void;
  onLogout?: () => Promise<void> | void;
  onOpenCart: () => void;
}

export function TopBar({
  activePage,
  isAdmin: isAdminProp,
  isAdminChatsActive = false,
  unreadChatCount = 0,
  wishlistCount = 0,
  actionableBargainsCount = 0,
  cartCount,
  currentUser,
  onNavigateStorefront,
  onNavigateOrders,
  onNavigatePartner,
  onNavigateAdmin,
  onOpenAdminChats,
  onOpenSupport,
  onOpenWishlist,
  onOpenBargains,
  onOpenAuth,
  onLogout,
  onOpenCart,
}: TopBarProps) {
  const isAdmin = isAdminProp ?? currentUser?.role === 'admin';
  const isPartner = Boolean(!isAdmin && currentUser?.partnerProfile);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] sm:h-20 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Bold spare-parts brand mark */}
        <button
          type="button"
          onClick={() => onNavigateStorefront()}
          aria-label={`${SHOP_NAME} Home`}
          className="whitespace-nowrap shrink-0 hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 rounded-md py-1"
        >
          <BrandWordmark size="header" />
        </button>

        {/* Zone 2: Concise single-line text navigation links (role-aware) */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onNavigateStorefront('catalog')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activePage === 'storefront'
                ? 'border-orange-600 text-slate-900'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Catalog
          </button>
          {!isAdmin && (
            <button
              type="button"
              onClick={() => onNavigateStorefront('categories')}
              className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              Categories
            </button>
          )}
          {!isAdmin && (
            <button
              type="button"
              onClick={onNavigateOrders}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activePage === 'orders'
                  ? 'border-orange-600 text-slate-900'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Order History
            </button>
          )}
          {isPartner && (
            <button
              type="button"
              onClick={onNavigatePartner}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activePage === 'partner'
                  ? 'border-orange-600 text-slate-900'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Partner Portal
            </button>
          )}
          {!isAdmin && (
            <button
              type="button"
              onClick={onOpenWishlist}
              className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              <span>Wishlist</span>
              {currentUser && wishlistCount > 0 && (
                <span className="font-mono tabular-nums text-xs text-rose-600 font-bold">
                  ({wishlistCount})
                </span>
              )}
            </button>
          )}
          {!isAdmin && onOpenBargains && (
            <button
              type="button"
              onClick={onOpenBargains}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              <span>Bargains</span>
              {actionableBargainsCount > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-emerald-600 text-white rounded-md">
                  {actionableBargainsCount}
                </span>
              )}
            </button>
          )}
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={onOpenAdminChats}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  activePage === 'admin' && isAdminChatsActive
                    ? 'border-orange-600 text-slate-900'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>Customer Chats</span>
                {unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                    {unreadChatCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onNavigateAdmin}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  activePage === 'admin' && !isAdminChatsActive
                    ? 'border-orange-600 text-slate-900'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                Admin Portal
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenSupport}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              <span>Customer Care</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                  {unreadChatCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAuth}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            {currentUser ? (isAdmin ? 'Admin Account' : 'Account') : 'Sign In'}
          </button>
          {isAdmin && onLogout && (
            <button
              type="button"
              onClick={() => void onLogout()}
              className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 py-1 text-red-700 hover:text-red-800 border-b-2 border-transparent hover:border-red-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="tabular-nums">Cart ({cartCount})</span>
          </button>
        </div>
      </div>

      {/* Compact mobile nav row */}
      <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto text-xs font-medium text-slate-600">
        <button
          type="button"
          onClick={() => onNavigateStorefront('catalog')}
          className={`whitespace-nowrap shrink-0 px-2 py-1 rounded ${
            activePage === 'storefront' ? 'text-slate-900 font-semibold' : ''
          }`}
        >
          Catalog
        </button>
        {!isAdmin && (
          <button
            type="button"
            onClick={onNavigateOrders}
            className={`whitespace-nowrap shrink-0 px-2 py-1 rounded ${
              activePage === 'orders' ? 'text-slate-900 font-semibold' : ''
            }`}
          >
            Order History
          </button>
        )}
        {isPartner && (
          <button
            type="button"
            onClick={onNavigatePartner}
            className={`whitespace-nowrap shrink-0 px-2 py-1 rounded ${
              activePage === 'partner' ? 'text-slate-900 font-semibold' : ''
            }`}
          >
            Partner Portal
          </button>
        )}
        {!isAdmin && (
          <button
            type="button"
            onClick={onOpenWishlist}
            className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-1 rounded"
          >
            <span>Wishlist</span>
            {currentUser && wishlistCount > 0 && (
              <span className="font-mono tabular-nums text-rose-600 font-bold">
                ({wishlistCount})
              </span>
            )}
          </button>
        )}
        {!isAdmin && onOpenBargains && (
          <button
            type="button"
            onClick={onOpenBargains}
            className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-1 rounded"
          >
            <span>Bargains</span>
            {actionableBargainsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] leading-none font-mono tabular-nums font-bold bg-emerald-600 text-white rounded-md">
                {actionableBargainsCount}
              </span>
            )}
          </button>
        )}
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={onOpenAdminChats}
              className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-1 rounded ${
                activePage === 'admin' && isAdminChatsActive ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              <span>Customer Chats</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                  {unreadChatCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onNavigateAdmin}
              className={`whitespace-nowrap shrink-0 px-2 py-1 rounded ${
                activePage === 'admin' && !isAdminChatsActive ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Admin Portal
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenSupport}
            className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-1 rounded"
          >
            <span>Customer Care</span>
            {unreadChatCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] leading-none font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md">
                {unreadChatCount}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenAuth}
          className="whitespace-nowrap shrink-0 px-2 py-1 rounded"
        >
          {currentUser ? 'Account' : 'Sign In'}
        </button>
        {isAdmin && onLogout && (
          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-1 rounded text-red-700 font-semibold"
          >
            <LogOut className="w-3 h-3" />
            <span>Log Out</span>
          </button>
        )}
      </div>
    </header>
  );
}
