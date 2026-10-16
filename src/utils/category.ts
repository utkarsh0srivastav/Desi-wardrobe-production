import { PricePolicy, Product, Shop, ShopCategory } from '../types/models';

export type CanonicalShopCategory = 'MEN' | 'WOMEN' | 'BOTH';
export type CustomerCategoryFilter = 'ALL' | 'MEN' | 'WOMEN' | 'BOTH';

export type MainCategoryFilter = 'ALL' | 'CLOTHING' | 'FOOTWEAR' | 'ACCESSORIES';
export type SubCategoryFilter = 'ALL' | 'MEN' | 'WOMEN' | 'KIDS';

/**
 * Customer-safe Shop representation that strips private Shopkeeper contact details
 * (such as Shopkeeper personal mobile number and Shopkeeper personal name).
 */
export type CustomerPublicShop = Omit<Shop, 'mobile' | 'shopkeeperName'>;

export function toCustomerPublicShop(shop: Shop): CustomerPublicShop {
  const { mobile: _mobile, shopkeeperName: _shopkeeperName, ...publicShop } = shop;
  return publicShop;
}

/**
 * Verifies whether a shop is strictly Online and open for business.
 * Offline or closed shops are immediately hidden from customer search, listings, and order placement.
 */
export function isShopOnline(
  shop: Shop | CustomerPublicShop | null | undefined
): boolean {
  if (!shop) return false;
  if ((shop as any).isOnline === false) return false;
  if ((shop as any).onlineStatus === 'OFFLINE') return false;
  if (shop.status === 'CLOSED') return false;
  if (shop.shopStatus && shop.shopStatus !== 'ACTIVE') return false;
  return true;
}

/**
 * Normalizes any legacy or current ShopCategory value into canonical 'MEN' | 'WOMEN' | 'BOTH'.
 */
export function normalizeShopCategory(
  category?: ShopCategory | string | null
): CanonicalShopCategory {
  const raw = (category || '').trim().toUpperCase();
  if (raw === 'MEN' || raw === "MEN'S WEAR" || raw === 'MENS WEAR') {
    return 'MEN';
  }
  if (raw === 'WOMEN' || raw === "WOMEN'S WEAR" || raw === 'WOMENS WEAR') {
    return 'WOMEN';
  }
  return 'BOTH';
}

/**
 * Formats a shop category for display badges across Customer, Shopkeeper, and Admin screens.
 */
export function formatShopCategoryLabel(
  category?: ShopCategory | string | null,
  language: 'English' | 'Hindi' = 'English'
): string {
  const canonical = normalizeShopCategory(category);
  if (language === 'Hindi') {
    if (canonical === 'MEN') return 'पुरुष परिधान (MEN)';
    if (canonical === 'WOMEN') return 'महिला परिधान (WOMEN)';
    return 'पुरुष एवं महिला (BOTH)';
  }
  if (canonical === 'MEN') return "Men's Wear";
  if (canonical === 'WOMEN') return "Women's Wear";
  return 'Men & Women (Both)';
}

/**
 * Checks whether a shop's category matches the selected Customer category filter.
 */
export function matchesCustomerCategoryFilter(
  shopCategory: ShopCategory | string | undefined,
  filter: CustomerCategoryFilter
): boolean {
  if (filter === 'ALL') return true;
  const canonical = normalizeShopCategory(shopCategory);
  if (filter === 'MEN') {
    return canonical === 'MEN' || canonical === 'BOTH';
  }
  if (filter === 'WOMEN') {
    return canonical === 'WOMEN' || canonical === 'BOTH';
  }
  if (filter === 'BOTH') {
    return canonical === 'BOTH';
  }
  return true;
}

export function formatPricePolicyLabel(
  policy?: PricePolicy | null,
  language: 'English' | 'Hindi' = 'English'
): string {
  const isBargaining =
    policy === 'BARGAINING_AVAILABLE' || policy === 'NEGOTIABLE';
  if (language === 'Hindi') {
    return isBargaining
      ? 'मोलभाव उपलब्ध (BARGAINING AVAILABLE)'
      : 'निश्चित मूल्य (FIXED PRICE)';
  }
  return isBargaining ? 'BARGAINING AVAILABLE' : 'FIXED PRICE';
}

const FOOTWEAR_KEYWORDS = [
  'shoe',
  'shoes',
  'sneaker',
  'sneakers',
  'sandal',
  'sandals',
  'chappal',
  'slipper',
  'slippers',
  'heel',
  'heels',
  'boot',
  'boots',
  'loafer',
  'loafers',
  'mojari',
  'jutti',
  'kolhapuri',
  'footwear',
];

const ACCESSORY_KEYWORDS = [
  'watch',
  'watches',
  'bag',
  'handbag',
  'handbags',
  'wallet',
  'wallets',
  'belt',
  'belts',
  'sunglasses',
  'jewel',
  'jewellery',
  'jewelry',
  'necklace',
  'earring',
  'earrings',
  'bangle',
  'bangles',
  'dupatta',
  'scarf',
  'scarves',
  'tie',
  'ties',
  'cap',
  'caps',
  'socks',
  'clutch',
  'accessory',
  'accessories',
];

/**
 * Resolves a product's main category: 'CLOTHING', 'FOOTWEAR', or 'ACCESSORIES'.
 * Uses explicit product fields if present; otherwise infers accurately from name & description.
 */
export function resolveProductMainCategory(
  product: Product
): 'CLOTHING' | 'FOOTWEAR' | 'ACCESSORIES' {
  if (product.productCategory) {
    const raw = product.productCategory.trim().toUpperCase();
    if (raw === 'FOOTWEAR' || raw.includes('SHOE')) return 'FOOTWEAR';
    if (raw === 'ACCESSORIES' || raw.includes('ACCESSOR')) return 'ACCESSORIES';
    if (raw === 'CLOTHING' || raw.includes('CLOTH') || raw.includes('APPAREL'))
      return 'CLOTHING';
  }

  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  for (const kw of FOOTWEAR_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(text)) {
      return 'FOOTWEAR';
    }
  }
  for (const kw of ACCESSORY_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(text)) {
      return 'ACCESSORIES';
    }
  }

  return 'CLOTHING';
}

/**
 * Resolves a product's target gender / subcategory: 'MEN', 'WOMEN', 'KIDS', or 'UNISEX'.
 */
export function resolveProductGender(
  product: Product
): 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX' {
  if (product.gender) {
    const raw = product.gender.trim().toUpperCase();
    if (raw === 'MEN' || raw === 'MALE') return 'MEN';
    if (raw === 'WOMEN' || raw === 'FEMALE') return 'WOMEN';
    if (raw === 'KIDS' || raw === 'CHILDREN') return 'KIDS';
    if (raw === 'UNISEX') return 'UNISEX';
  }

  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  if (/\b(kids|kid|child|children|baby|infant|toddler|boy|girl)\b/i.test(text)) {
    return 'KIDS';
  }
  if (
    /\b(women|woman|ladies|girl|saree|sari|kurti|lehenga|salwar|dupatta|blouse|gown|bra|heels)\b/i.test(
      text
    )
  ) {
    return 'WOMEN';
  }
  if (
    /\b(men|man|gent|gents|shirt|kurta|sherwani|trouser|trousers|pants|blazer|tie|loafer)\b/i.test(
      text
    )
  ) {
    return 'MEN';
  }

  return 'UNISEX';
}

/**
 * Checks whether a product matches the selected main category and subcategory filters.
 */
export function matchesProductCategoryAndSubcategory(
  product: Product,
  mainCategory: MainCategoryFilter,
  subCategory: SubCategoryFilter
): boolean {
  if (mainCategory !== 'ALL') {
    const pMain = resolveProductMainCategory(product);
    if (pMain !== mainCategory) {
      return false;
    }
  }

  if (subCategory !== 'ALL') {
    const pGender = resolveProductGender(product);
    if (pGender !== 'UNISEX' && pGender !== subCategory) {
      return false;
    }
  }

  return true;
}
