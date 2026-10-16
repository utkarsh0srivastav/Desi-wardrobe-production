import React from 'react';
import {
  LogIn,
  UserPlus,
  ArrowRight,
  Store,
  Shield,
  Truck,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { getCurrentLanguage, translations } from '../utils/i18n';

interface EntryPageProps {
  onOpenCustomerLogin: () => void;
  onOpenCustomerRegister: () => void;
  onSkipForNow: () => void;
  onExploreLocalShops: () => void;
  onOpenDeliveryPartnerLogin: () => void;
  onOpenShopkeeperPortal: () => void;
  onOpenAdminPortal: () => void;
}

/**
 * DESI WARDROBE — Customer Landing Page
 *
 * Clean, modern, mobile-first customer entry point.
 * Features:
 * - Brand logo and name
 * - Prominent "Customer" heading & concise description
 * - Primary Login and Register buttons
 * - "Skip for Now" guest browsing trigger
 * - Attractive, compact fashion & local-boutique visual preview
 * - Clear "Explore Local Shops" call-to-action
 * - Three compact, separated role links in footer:
 *     1. Delivery Partner Login
 *     2. Shopkeeper Login / Register
 *     3. Admin Login
 */
export const EntryPage: React.FC<EntryPageProps> = ({
  onOpenCustomerLogin,
  onOpenCustomerRegister,
  onSkipForNow,
  onExploreLocalShops,
  onOpenDeliveryPartnerLogin,
  onOpenShopkeeperPortal,
  onOpenAdminPortal,
}) => {
  const lang = getCurrentLanguage();
  const t = translations[lang];

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-12 min-h-[calc(100vh-8rem)] flex flex-col justify-between gap-8">
      {/* Top Section: Brand & Customer Entry */}
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3 pt-2">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              DESI WARDROBE
            </h1>
            <p className="text-xs font-semibold text-[var(--accent-primary)] mt-0.5">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Customer Portal Card */}
        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 shadow-xs space-y-5 text-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] text-[11px] font-bold uppercase tracking-wider">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Customer Portal</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              Customer
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
              {lang === 'Hindi'
                ? 'अपने आस-पास की स्थानीय दुकानें और कपड़े खोजें।'
                : 'Discover local shops and products near you.'}
            </p>
          </div>

          {/* Customer Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onOpenCustomerLogin}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>

              <button
                type="button"
                onClick={onOpenCustomerRegister}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] active:scale-[0.98] border-2 border-[var(--accent-primary)] text-[var(--accent-primary)] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register</span>
              </button>
            </div>

            {/* Skip for Now Option */}
            <button
              type="button"
              onClick={onSkipForNow}
              className="w-full py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors underline underline-offset-4 decoration-dotted"
            >
              {lang === 'Hindi' ? 'बिना लॉगिन के आगे बढ़ें (Skip for Now)' : 'Skip for Now'}
            </button>
          </div>
        </div>

        {/* Compact Visual Local Shopping Area */}
        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {lang === 'Hindi' ? 'स्थानीय फैशन मार्केट' : 'Local Fashion Collections'}
              </span>
            </div>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Clothing · Footwear · Accessories
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-center space-y-1">
              <div className="text-xs font-bold text-[var(--text-primary)]">Clothing</div>
              <div className="text-[10px] text-[var(--text-muted)]">Men · Women · Kids</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-center space-y-1">
              <div className="text-xs font-bold text-[var(--text-primary)]">Footwear</div>
              <div className="text-[10px] text-[var(--text-muted)]">Shoes & Sandals</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-center space-y-1">
              <div className="text-xs font-bold text-[var(--text-primary)]">Accessories</div>
              <div className="text-[10px] text-[var(--text-muted)]">Bags, Watches & more</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onExploreLocalShops}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[var(--bg-secondary)] hover:bg-[var(--border-subtle)] active:scale-[0.99] text-[var(--text-primary)] text-xs font-bold flex items-center justify-between transition-colors border border-[var(--border-subtle)]"
          >
            <span>{t.exploreLocalShopsBtn}</span>
            <ArrowRight className="w-4 h-4 text-[var(--accent-primary)]" />
          </button>
        </div>
      </div>

      {/* Footer Role Links — Small, clearly separated, non-intrusive */}
      <footer className="pt-4 border-t border-[var(--border-subtle)]/70 text-center space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs">
          <button
            type="button"
            onClick={onOpenDeliveryPartnerLogin}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors py-1 px-1.5"
          >
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            <span>Delivery Partner Login</span>
          </button>

          <span className="text-[var(--border-strong)]" aria-hidden="true">
            •
          </span>

          <button
            type="button"
            onClick={onOpenShopkeeperPortal}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors py-1 px-1.5"
          >
            <Store className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Shopkeeper Login / Register</span>
          </button>

          <span className="text-[var(--border-strong)]" aria-hidden="true">
            •
          </span>

          <button
            type="button"
            onClick={onOpenAdminPortal}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors py-1 px-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-stone-500" />
            <span>Admin Login</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
