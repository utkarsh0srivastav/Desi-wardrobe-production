import React, { useState, useMemo, useEffect } from 'react';
import {
  MapPin,
  Store,
  Search,
  Tag,
  Navigation,
  RefreshCw,
  AlertCircle,
  Clock,
  SlidersHorizontal,
  X,
  Truck,
  ShoppingBag,
  CheckCircle2,
  Package,
  Shield,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  CustomerCoordinates,
  DeliveryMode,
  Product,
  Shop,
  ShopSponsor,
} from '../../types/models';
import {
  locationService,
  LocationServiceError,
  PublicShopWithDistance,
} from '../../services/locationService';
import {
  formatPricePolicyLabel,
  formatShopCategoryLabel,
  isShopOnline,
  MainCategoryFilter,
  matchesProductCategoryAndSubcategory,
  resolveProductGender,
  resolveProductMainCategory,
  SubCategoryFilter,
} from '../../utils/category';
import {
  calculateDeliveryCharge,
  isDeliveryOperatingHoursIST,
  MAX_DELIVERY_RADIUS_KM,
  MAX_TAKEAWAY_RADIUS_KM,
} from '../../services/deliveryService';
import { getCurrentLanguage, translations } from '../../utils/i18n';
import { ResilientImage } from '../../components/ResilientImage';
import { storage } from '../../utils/storage';

interface CustomerHomePageProps {
  shops: Shop[];
  products: Product[];
  sponsorMap?: Record<string, ShopSponsor>;
  customerCoords: CustomerCoordinates | null;
  locationStatus: 'IDLE' | 'LOADING' | 'GRANTED' | 'UNAVAILABLE';
  locationError: LocationServiceError | null;
  onRetryLocation: () => void;
  onSelectShop: (shopId: string) => void;
  onSelectProduct: (productId: string) => void;
  onOpenCustomerLogin?: () => void;
  onOpenCustomerRegister?: () => void;
  onOpenDeliveryPartnerLogin?: () => void;
  onOpenShopkeeperPortal?: () => void;
  onOpenAdminPortal?: () => void;
}

type SortOption = 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'NEWEST';
type DiscoveryView = 'SHOPS' | 'PRODUCTS';

export const CustomerHomePage: React.FC<CustomerHomePageProps> = ({
  shops,
  products,
  sponsorMap = {},
  customerCoords,
  locationStatus,
  locationError,
  onRetryLocation,
  onSelectShop,
  onSelectProduct,
  onOpenCustomerLogin,
  onOpenCustomerRegister,
  onOpenDeliveryPartnerLogin,
  onOpenShopkeeperPortal,
  onOpenAdminPortal,
}) => {
  const lang = getCurrentLanguage();
  const t = translations[lang];
  const locationLoading = locationStatus === 'LOADING';

  // 1. Mandatory Takeaway / Delivery Mode Selector
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(() => {
    return storage.getSelectedDeliveryMode();
  });

  const handleDeliveryModeChange = (mode: DeliveryMode) => {
    setDeliveryMode(mode);
    storage.saveSelectedDeliveryMode(mode);
  };

  // 2. Search query
  const [searchQuery, setSearchQuery] = useState('');

  // 3. Mandatory Main Category & Subcategory Filters
  const [mainCategory, setMainCategory] = useState<MainCategoryFilter>('ALL');
  const [subCategory, setSubCategory] = useState<SubCategoryFilter>('ALL');

  // When main category changes, reset subcategory if not applicable
  const handleMainCategoryChange = (cat: MainCategoryFilter) => {
    setMainCategory(cat);
    if (cat === 'ACCESSORIES') {
      setSubCategory('ALL');
    }
  };

  // 4. Additional Customer Filters
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string>('ALL');
  const [selectedSize, setSelectedSize] = useState<string>('ALL');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [selectedDistanceLimit, setSelectedDistanceLimit] = useState<number>(() =>
    deliveryMode === 'DELIVERY' ? MAX_DELIVERY_RADIUS_KM : MAX_TAKEAWAY_RADIUS_KM
  );
  const [sortBy, setSortBy] = useState<SortOption>('RELEVANCE');

  // Synchronize max distance when mode changes
  useEffect(() => {
    if (deliveryMode === 'DELIVERY') {
      setSelectedDistanceLimit((prev) => Math.min(prev, MAX_DELIVERY_RADIUS_KM));
    } else {
      setSelectedDistanceLimit(MAX_TAKEAWAY_RADIUS_KM);
    }
  }, [deliveryMode]);

  // 5. View Mode: "Shops" vs "Products"
  const [discoveryView, setDiscoveryView] = useState<DiscoveryView>('SHOPS');

  // Delivery Hours Check (10:00 PM to 10:00 AM IST)
  const isDeliveryOpen = useMemo(() => isDeliveryOperatingHoursIST(), []);

  // Filter Online and Eligible Shops with Distance
  const eligiblePublicShops = useMemo<PublicShopWithDistance[]>(() => {
    const maxRadius =
      deliveryMode === 'DELIVERY' ? MAX_DELIVERY_RADIUS_KM : MAX_TAKEAWAY_RADIUS_KM;
    const effectiveRadius = Math.min(maxRadius, selectedDistanceLimit);

    // Filter strictly to ACTIVE, COMPLETED, and ONLINE shops
    const onlineShops = shops.filter(
      (s) =>
        s.shopStatus === 'ACTIVE' &&
        s.profileStatus === 'COMPLETED' &&
        isShopOnline(s)
    );

    const withDist = locationService.filterShopsWithinRadius(
      onlineShops,
      customerCoords,
      effectiveRadius
    );

    return locationService.sortShopsByDistance(withDist, sponsorMap);
  }, [shops, deliveryMode, selectedDistanceLimit, customerCoords, sponsorMap]);

  // Map of eligible shop IDs for fast lookup
  const eligibleShopIdSet = useMemo(() => {
    return new Set(eligiblePublicShops.map((s) => s.shopId));
  }, [eligiblePublicShops]);

  // Derive available filter values from real product inventory
  const availableFilterOptions = useMemo(() => {
    const types = new Set<string>();
    const sizes = new Set<string>();
    const colors = new Set<string>();

    products.forEach((p) => {
      if (p.sizes && Array.isArray(p.sizes)) {
        p.sizes.forEach((sz: string) => sz && sizes.add(sz.trim()));
      }
      if (p.colors && Array.isArray(p.colors)) {
        p.colors.forEach((clr: string) => clr && colors.add(clr.trim()));
      }
      // Infer product type keyword from name (e.g., Shirt, Kurti, Saree, Kurta, Shoes, Sandals, Watch, etc.)
      const words = p.name.split(/\s+/);
      if (words.length > 0) {
        types.add(words[0]);
      }
    });

    return {
      sizes: Array.from(sizes).sort(),
      colors: Array.from(colors).sort(),
      types: Array.from(types).sort(),
    };
  }, [products]);

  // Filtered Shops based on Category & Search
  const filteredShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return eligiblePublicShops.filter((shop) => {
      // 1. Shop Category filter
      let matchesCat = true;
      if (mainCategory === 'CLOTHING') {
        if (subCategory === 'MEN') {
          matchesCat = shop.category === 'MEN' || shop.category === 'BOTH';
        } else if (subCategory === 'WOMEN') {
          matchesCat = shop.category === 'WOMEN' || shop.category === 'BOTH';
        }
      }

      // Check if shop contains matching products if category selected
      if (mainCategory !== 'ALL') {
        const shopProds = products.filter((p) => p.shopId === shop.shopId);
        const hasMatchingProduct = shopProds.some((p) =>
          matchesProductCategoryAndSubcategory(p, mainCategory, subCategory)
        );
        matchesCat = matchesCat || hasMatchingProduct;
      }

      // 2. Search query (shop name, location, or product name in shop)
      let matchesQuery = true;
      if (q) {
        const matchesShopName = shop.shopName.toLowerCase().includes(q);
        const matchesLocation = shop.locationName.toLowerCase().includes(q);
        const shopProds = products.filter((p) => p.shopId === shop.shopId);
        const matchesAnyProduct = shopProds.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
        matchesQuery = matchesShopName || matchesLocation || matchesAnyProduct;
      }

      return matchesCat && matchesQuery;
    });
  }, [eligiblePublicShops, mainCategory, subCategory, searchQuery, products]);

  // Filtered Products based on all active filters
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minP = minPrice ? parseFloat(minPrice) : null;
    const maxP = maxPrice ? parseFloat(maxPrice) : null;

    let result = products.filter((p) => {
      // Must belong to an eligible, active, online shop within distance limit
      if (!eligibleShopIdSet.has(p.shopId)) {
        return false;
      }

      // 1. Main category & Subcategory
      if (!matchesProductCategoryAndSubcategory(p, mainCategory, subCategory)) {
        return false;
      }

      // 2. Search query
      if (q) {
        const shop = shops.find((s) => s.shopId === p.shopId);
        const matchesPName = p.name.toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const matchesShop = shop ? shop.shopName.toLowerCase().includes(q) : false;
        if (!matchesPName && !matchesDesc && !matchesShop) {
          return false;
        }
      }

      // 3. Size filter
      if (selectedSize !== 'ALL') {
        if (!p.sizes || !p.sizes.includes(selectedSize)) {
          return false;
        }
      }

      // 4. Color filter
      if (selectedColor !== 'ALL') {
        if (!p.colors || !p.colors.includes(selectedColor)) {
          return false;
        }
      }

      // 5. In stock only
      if (inStockOnly && p.quantity <= 0) {
        return false;
      }

      // 6. Price range
      if (minP !== null && !isNaN(minP) && p.price < minP) {
        return false;
      }
      if (maxP !== null && !isNaN(maxP) && p.price > maxP) {
        return false;
      }

      // 7. Product type
      if (selectedProductType !== 'ALL') {
        if (!p.name.toLowerCase().includes(selectedProductType.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // Apply Sorting
    result.sort((a, b) => {
      if (sortBy === 'PRICE_ASC') {
        return a.price - b.price;
      }
      if (sortBy === 'PRICE_DESC') {
        return b.price - a.price;
      }
      if (sortBy === 'NEWEST') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // RELEVANCE: In-stock first, then newest
      if (a.quantity > 0 && b.quantity <= 0) return -1;
      if (a.quantity <= 0 && b.quantity > 0) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [
    products,
    eligibleShopIdSet,
    mainCategory,
    subCategory,
    searchQuery,
    selectedSize,
    selectedColor,
    inStockOnly,
    minPrice,
    maxPrice,
    selectedProductType,
    sortBy,
    shops,
  ]);

  const activeFilterCount =
    (mainCategory !== 'ALL' ? 1 : 0) +
    (subCategory !== 'ALL' ? 1 : 0) +
    (selectedSize !== 'ALL' ? 1 : 0) +
    (selectedColor !== 'ALL' ? 1 : 0) +
    (selectedProductType !== 'ALL' ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (sortBy !== 'RELEVANCE' ? 1 : 0);

  const handleClearFilters = () => {
    setMainCategory('ALL');
    setSubCategory('ALL');
    setSelectedSize('ALL');
    setSelectedColor('ALL');
    setSelectedProductType('ALL');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSearchQuery('');
    setSortBy('RELEVANCE');
    setSelectedDistanceLimit(
      deliveryMode === 'DELIVERY' ? MAX_DELIVERY_RADIUS_KM : MAX_TAKEAWAY_RADIUS_KM
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 pb-20 space-y-5">
      {/* 1. Mandatory Takeaway / Delivery Mode Selector */}
      <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2 shadow-xs">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleDeliveryModeChange('TAKEAWAY')}
            className={`min-h-[50px] px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              deliveryMode === 'TAKEAWAY'
                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <div className="font-bold leading-tight">Takeaway</div>
              <div
                className={`text-[10px] normal-case font-normal ${
                  deliveryMode === 'TAKEAWAY' ? 'text-white/80' : 'text-[var(--text-muted)]'
                }`}
              >
                In-store pickup · Up to 100 KM
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDeliveryModeChange('DELIVERY')}
            className={`min-h-[50px] px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              deliveryMode === 'DELIVERY'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
            }`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <div className="font-bold leading-tight">Delivery</div>
              <div
                className={`text-[10px] normal-case font-normal ${
                  deliveryMode === 'DELIVERY' ? 'text-white/80' : 'text-[var(--text-muted)]'
                }`}
              >
                Doorstep delivery · Up to 15 KM
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Delivery Hours Notice (10:00 PM to 10:00 AM IST) */}
      {deliveryMode === 'DELIVERY' && !isDeliveryOpen && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-[var(--text-primary)] flex items-start gap-3">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-700 dark:text-amber-400">
              Delivery is currently closed
            </span>
            <p className="text-[var(--text-secondary)] leading-relaxed text-[11px]">
              Normal Delivery hours are between 10:00 AM and 10:00 PM IST. You can browse products
              now, or switch to <strong>Takeaway</strong> mode to place a 48-hour in-store hold.
            </p>
          </div>
        </div>
      )}

      {/* 2. Compact Location Indicator (Clean & Minimalist — Old oversized hero completely removed) */}
      <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <MapPin className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          {locationLoading ? (
            <span className="text-[var(--text-muted)]">Detecting location...</span>
          ) : customerCoords ? (
            <span className="font-medium">
              Showing {deliveryMode === 'DELIVERY' ? 'delivery shops within 15 KM' : 'shops within 100 KM'}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              {locationError?.customerMessage || 'Location access needed to filter distance'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRetryLocation}
          disabled={locationLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${locationLoading ? 'animate-spin' : ''}`} />
          <span>{customerCoords ? 'Update Location' : 'Detect Location'}</span>
        </button>
      </div>

      {/* 3. Search Bar with Clear Button */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            lang === 'Hindi'
              ? 'दुकान, कपड़े, फुटवियर या एक्सेसरीज़ खोजें...'
              : 'Search shops, clothing, footwear, accessories...'
          }
          className="w-full min-h-[46px] pl-10 pr-10 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="w-8 h-8 rounded-xl absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 4. Mandatory Shop & Product Category Filter Bar (Section 8) */}
      <div className="space-y-2.5">
        {/* Main Categories: All, Clothing, Footwear, Accessories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => handleMainCategoryChange('ALL')}
            className={`min-h-[40px] px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              mainCategory === 'ALL'
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            }`}
          >
            All Categories
          </button>

          <button
            type="button"
            onClick={() => handleMainCategoryChange('CLOTHING')}
            className={`min-h-[40px] px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              mainCategory === 'CLOTHING'
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            }`}
          >
            Clothing
          </button>

          <button
            type="button"
            onClick={() => handleMainCategoryChange('FOOTWEAR')}
            className={`min-h-[40px] px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              mainCategory === 'FOOTWEAR'
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            }`}
          >
            Footwear
          </button>

          <button
            type="button"
            onClick={() => handleMainCategoryChange('ACCESSORIES')}
            className={`min-h-[40px] px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              mainCategory === 'ACCESSORIES'
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            }`}
          >
            Accessories
          </button>

          {/* More Filters Toggle */}
          <button
            type="button"
            onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
            className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap ml-auto flex items-center gap-1.5 transition-all ${
              activeFilterCount > 0
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/40'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Subcategories (Men, Women, Kids) for Clothing & Footwear */}
        {(mainCategory === 'CLOTHING' || mainCategory === 'FOOTWEAR') && (
          <div className="flex items-center gap-2 pl-1 pt-1 overflow-x-auto pb-1 animate-fadeIn">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0">
              {mainCategory === 'CLOTHING' ? 'Clothing for:' : 'Footwear for:'}
            </span>

            <button
              type="button"
              onClick={() => setSubCategory('ALL')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                subCategory === 'ALL'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All
            </button>

            <button
              type="button"
              onClick={() => setSubCategory('MEN')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                subCategory === 'MEN'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Men
            </button>

            <button
              type="button"
              onClick={() => setSubCategory('WOMEN')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                subCategory === 'WOMEN'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Women
            </button>

            <button
              type="button"
              onClick={() => setSubCategory('KIDS')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                subCategory === 'KIDS'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Kids
            </button>
          </div>
        )}
      </div>

      {/* 5. Additional Filters Drawer (Section 9 & 10) */}
      {showFiltersDrawer && (
        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                Filter &amp; Sort Options
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-[var(--accent-primary)] font-bold hover:underline"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFiltersDrawer(false)}
                className="w-7 h-7 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Sort By */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-[var(--text-secondary)]">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium"
              >
                <option value="RELEVANCE">Relevance</option>
                <option value="PRICE_ASC">Price: Low to High</option>
                <option value="PRICE_DESC">Price: High to Low</option>
                <option value="NEWEST">Newest First</option>
              </select>
            </div>

            {/* Size */}
            {availableFilterOptions.sizes.length > 0 && (
              <div className="space-y-1.5">
                <label className="block font-semibold text-[var(--text-secondary)]">Size</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium"
                >
                  <option value="ALL">All Sizes</option>
                  {availableFilterOptions.sizes.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Color */}
            {availableFilterOptions.colors.length > 0 && (
              <div className="space-y-1.5">
                <label className="block font-semibold text-[var(--text-secondary)]">Color</label>
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium"
                >
                  <option value="ALL">All Colors</option>
                  {availableFilterOptions.colors.map((clr) => (
                    <option key={clr} value={clr}>
                      {clr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Price Range */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-[var(--text-secondary)]">
                Price Range (₹)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono-tabular"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono-tabular"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)] text-xs">
            {/* In Stock Only Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
              />
              <span className="font-semibold text-[var(--text-primary)]">In-Stock Only</span>
            </label>

            <button
              type="button"
              onClick={() => setShowFiltersDrawer(false)}
              className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white font-bold"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* 6. Dual Discovery Switch: "Shops" vs "Products" */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setDiscoveryView('SHOPS')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              discoveryView === 'SHOPS'
                ? 'bg-[var(--accent-primary)] text-white shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Shops ({filteredShops.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDiscoveryView('PRODUCTS')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              discoveryView === 'PRODUCTS'
                ? 'bg-[var(--accent-primary)] text-white shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Products ({filteredProducts.length})</span>
          </button>
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-[var(--accent-primary)] font-semibold hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 7. SHOPS VIEW */}
      {discoveryView === 'SHOPS' && (
        <div className="space-y-4">
          {filteredShops.length === 0 ? (
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-12 text-center space-y-3">
              <Store className="w-10 h-10 text-[var(--accent-primary)] mx-auto opacity-70" />
              <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                No Eligible Shops Found
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                {deliveryMode === 'DELIVERY'
                  ? 'No online shops offering delivery within 15 KM match your current filters. Try switching to Takeaway mode or clearing filters.'
                  : 'No shops match your current search or category filters. Try clearing filters.'}
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredShops.map((shop) => {
                const shopProducts = products.filter((p) => p.shopId === shop.shopId);
                const hasDelivery = deliveryMode === 'DELIVERY';
                const estDeliveryFee = hasDelivery
                  ? calculateDeliveryCharge(shop.distanceKm || 0)
                  : 0;

                return (
                  <div
                    key={shop.shopId}
                    onClick={() => onSelectShop(shop.shopId)}
                    className="cursor-pointer group rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Shop Photo */}
                      <div className="relative h-48 w-full bg-[var(--bg-secondary)] overflow-hidden">
                        <ResilientImage
                          src={shop.photo}
                          alt={shop.shopName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                        {/* Category & Distance Badges */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                          <div>
                            <span className="inline-block px-2.5 py-0.5 rounded-lg bg-white/20 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider">
                              {formatShopCategoryLabel(shop.category, lang)}
                            </span>
                            <h3 className="font-display text-xl font-bold text-white mt-1">
                              {shop.shopName}
                            </h3>
                          </div>

                          {shop.distanceKm !== null && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600/90 text-white font-mono-tabular text-xs font-bold shrink-0">
                              <Navigation className="w-3 h-3" />
                              {locationService.formatDistance(shop.distanceKm)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Shop Info */}
                      <div className="p-4 space-y-2 text-xs">
                        <div className="flex items-start gap-1.5 text-[var(--text-secondary)]">
                          <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{shop.locationName}</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
                          <span className="text-[var(--text-muted)] font-mono-tabular text-[11px]">
                            {shopProducts.length} {shopProducts.length === 1 ? 'item' : 'items'} in store
                          </span>

                          {hasDelivery ? (
                            <span className="text-blue-600 dark:text-blue-400 font-mono-tabular font-bold text-[11px] flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5" />
                              Delivery: ₹{estDeliveryFee}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              48h Store Hold
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectShop(shop.shopId);
                        }}
                        className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[var(--bg-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-white border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>VIEW PRODUCTS</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 8. PRODUCTS VIEW (Section 13 — Real Product Cards with real pricing, stock, savings) */}
      {discoveryView === 'PRODUCTS' && (
        <div className="space-y-4">
          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-12 text-center space-y-3">
              <Package className="w-10 h-10 text-[var(--accent-primary)] mx-auto opacity-70" />
              <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                No Products Found
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                No products match the selected categories, filters, or search terms. Try adjusting your filters.
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const shop = shops.find((s) => s.shopId === product.shopId);
                const outOfStock = product.quantity <= 0;
                const hasMrp = typeof product.mrp === 'number' && product.mrp > product.price;
                const savingsAmount = hasMrp ? product.mrp! - product.price : 0;
                const discountPct = hasMrp ? Math.round((savingsAmount / product.mrp!) * 100) : 0;
                const pMainCat = resolveProductMainCategory(product);
                const pGender = resolveProductGender(product);

                return (
                  <div
                    key={product.productId}
                    onClick={() => onSelectProduct(product.productId)}
                    className="cursor-pointer group rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Product Image */}
                      <div className="relative h-56 w-full bg-[var(--bg-secondary)] overflow-hidden">
                        <ResilientImage
                          src={product.thumbnails?.[0] || product.images[0] || ''}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        {/* Category Tag */}
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                          <span className="px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider">
                            {pMainCat} {pGender !== 'UNISEX' ? `· ${pGender}` : ''}
                          </span>
                          {discountPct > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold uppercase">
                              {discountPct}% OFF
                            </span>
                          )}
                        </div>

                        {/* Stock Badge */}
                        <div className="absolute top-3 right-3">
                          {outOfStock ? (
                            <span className="px-2.5 py-0.5 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase">
                              OUT OF STOCK
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600/90 text-white text-[10px] font-bold">
                              In Stock ({product.quantity})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-4 space-y-2 text-xs">
                        <div className="space-y-1">
                          <h3 className="font-display text-base font-bold text-[var(--text-primary)] line-clamp-1">
                            {product.name}
                          </h3>
                          {shop && (
                            <div className="text-[11px] text-[var(--text-muted)] line-clamp-1 flex items-center gap-1">
                              <Store className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                              <span>{shop.shopName}</span>
                            </div>
                          )}
                        </div>

                        {/* Pricing with MRP & Savings */}
                        <div className="pt-1 flex items-baseline gap-2">
                          <span className="font-mono-tabular text-lg font-bold text-[var(--accent-primary)]">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                          {hasMrp && (
                            <span className="font-mono-tabular text-xs text-[var(--text-muted)] line-through">
                              ₹{product.mrp!.toLocaleString('en-IN')}
                            </span>
                          )}
                          {savingsAmount > 0 && (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              Save ₹{savingsAmount}
                            </span>
                          )}
                        </div>

                        {/* Available Sizes & Colors */}
                        <div className="pt-1 flex flex-wrap gap-1 text-[10px] text-[var(--text-secondary)]">
                          {product.sizes && product.sizes.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                              Sizes: {product.sizes.slice(0, 4).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(product.productId);
                        }}
                        className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[var(--bg-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-white border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>VIEW PRODUCT DETAILS</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 9. Footer Role Links — Small, compact, clearly separated */}
      <footer className="pt-8 border-t border-[var(--border-subtle)]/70 text-center space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs">
          {onOpenDeliveryPartnerLogin && (
            <button
              type="button"
              onClick={onOpenDeliveryPartnerLogin}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors py-1 px-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>Delivery Partner Login</span>
            </button>
          )}

          {onOpenShopkeeperPortal && (
            <>
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
            </>
          )}

          {onOpenAdminPortal && (
            <>
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
            </>
          )}
        </div>
      </footer>
    </div>
  );
};
