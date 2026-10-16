import React, { useState, useRef, useEffect } from 'react';
import {
  ClipboardList,
  Upload,
  Package,
  Store,
  LogOut,
  Plus,
  Minus,
  Trash2,
  Edit3,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Bell,
  Search,
  Phone,
  QrCode,
  ShieldCheck,
  Truck,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Filter,
  Copy,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Booking,
  DeliveryPartner,
  Product,
  ProductGender,
  Shop,
  Shopkeeper,
  ShopkeeperNotification,
  STANDARD_COLORS,
  STANDARD_SIZES,
} from '../../types/models';
import { productService } from '../../services/productService';
import { bookingService } from '../../services/bookingService';
import { deliveryService } from '../../services/deliveryService';
import { imageService } from '../../services/imageService';
import { shopService } from '../../services/shopService';
import { notificationService } from '../../services/notificationService';
import { ResilientImage } from '../../components/ResilientImage';
import { ShopProfileSetupPage } from './ShopProfileSetupPage';

interface ShopkeeperDashboardPageProps {
  shopkeeper: Shopkeeper;
  shop: Shop;
  products: Product[];
  bookings: Booking[];
  onLogout: () => void;
  onRefreshData: () => void;
}

type DashboardView = 'HOME' | 'ORDERS' | 'UPLOAD_PRODUCT' | 'MANAGE_PRODUCTS' | 'SHOP_PROFILE';
type OrderFilter = 'ALL' | 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'SOLD' | 'NOT_SOLD';
type ProductFilter = 'ALL' | 'AVAILABLE' | 'OUT_OF_STOCK';

interface CompressedPhotoPair {
  optimized: string;
  thumbnail: string;
  sizeKB: number;
}

export const ShopkeeperDashboardPage: React.FC<ShopkeeperDashboardPageProps> = ({
  shopkeeper,
  shop,
  products,
  bookings,
  onLogout,
  onRefreshData,
}) => {
  const [view, setView] = useState<DashboardView>('HOME');
  const [selectedOrder, setSelectedOrder] = useState<Booking | null>(null);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('ALL');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<ShopkeeperNotification[]>([]);

  // Handover Code / Verification State in Order Modal
  const [enteredHandoverCode, setEnteredHandoverCode] = useState('');
  const [handoverSuccess, setHandoverSuccess] = useState(false);
  const [verifiedPartnerIdentity, setVerifiedPartnerIdentity] = useState<DeliveryPartner | null>(null);
  const [partnerHandoverConfirmed, setPartnerHandoverConfirmed] = useState(false);

  // UPI QR Code Modal State
  const [showUpiQrModal, setShowUpiQrModal] = useState(false);
  const [upiQrOrder, setUpiQrOrder] = useState<Booking | null>(null);

  // Upload Product State
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodMrp, setProdMrp] = useState('');
  const [prodGender, setProdGender] = useState<ProductGender>('UNISEX');
  const [prodCategory, setProdCategory] = useState('CLOTHING');
  const [prodQty, setProdQty] = useState('10');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['M', 'L', 'XL']);
  const [customSize, setCustomSize] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>(['Black', 'White', 'Red']);
  const [customColor, setCustomColor] = useState('');
  const [colorOptions, setColorOptions] = useState<string[]>(STANDARD_COLORS);
  const [photos, setPhotos] = useState<CompressedPhotoPair[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editGender, setEditGender] = useState<ProductGender>('UNISEX');
  const [editQty, setEditQty] = useState('');
  const [editSizes, setEditSizes] = useState<string[]>([]);
  const [editColors, setEditColors] = useState<string[]>([]);
  const [editCustomColor, setEditCustomColor] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = notificationService.getShopkeeperNotifications(shopkeeper.shopkeeperId);
    setNotifications(list);
  }, [shopkeeper.shopkeeperId]);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const handleToggleStoreStatus = () => {
    try {
      const updated = shopService.toggleShopOpenStatus(shop.shopId);
      onRefreshData();
      notify(`Store is now ${updated.status === 'OPEN' ? 'OPEN' : 'CLOSED'}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not change store status.');
    }
  };

  // Compress uploaded photos (~300-400 KB target + thumbnail)
  const handlePhotoFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);

    if (photos.length + fileList.length > 8) {
      setErrorMsg('Maximum 8 photos allowed per product.');
      return;
    }

    setIsCompressing(true);
    try {
      const batch: CompressedPhotoPair[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const res = await imageService.compressImageFile(fileList[i]);
        batch.push({
          optimized: res.optimizedDataUrl,
          thumbnail: res.thumbnailDataUrl,
          sizeKB: res.compressedSizeKB,
        });
      }
      setPhotos((prev) => [...prev, ...batch].slice(0, 8));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to compress photo.');
    } finally {
      setIsCompressing(false);
    }
  };

  const toggleItem = (item: string, list: string[], setter: (next: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleAddCustomColor = () => {
    const clean = customColor.trim();
    if (!clean) return;
    const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (!colorOptions.includes(formatted)) {
      setColorOptions((prev) => [...prev, formatted]);
    }
    if (!selectedColors.includes(formatted)) {
      setSelectedColors((prev) => [...prev, formatted]);
    }
    setCustomColor('');
  };

  const handleAddCustomSize = () => {
    const clean = customSize.trim().toUpperCase();
    if (!clean) return;
    if (!selectedSizes.includes(clean)) {
      setSelectedSizes((prev) => [...prev, clean]);
    }
    setCustomSize('');
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const priceNum = Number(prodPrice);
    const mrpNum = prodMrp ? Number(prodMrp) : priceNum;

    if (mrpNum < priceNum) {
      setErrorMsg('MRP cannot be less than the Offer Price.');
      return;
    }

    try {
      productService.createProduct({
        shopId: shop.shopId,
        name: prodName,
        description: prodDesc,
        price: priceNum,
        mrp: mrpNum,
        gender: prodGender,
        productCategory: prodCategory,
        quantity: Number(prodQty),
        sizes: selectedSizes,
        colors: selectedColors,
        images: photos.map((p) => p.optimized),
        thumbnails: photos.map((p) => p.thumbnail),
      });

      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdMrp('');
      setProdQty('10');
      setPhotos([]);
      onRefreshData();
      notify('Product uploaded to your shop.');
      setView('MANAGE_PRODUCTS');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload product.');
    }
  };

  const handleMarkSold = (bookingId: string) => {
    setErrorMsg(null);
    try {
      const updated = bookingService.markOrderSold(bookingId);
      setSelectedOrder(updated);
      onRefreshData();
      notify(`Order ${bookingId} marked SOLD & COMPLETED.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to mark order SOLD.');
    }
  };

  const handleMarkNotSold = (bookingId: string) => {
    setErrorMsg(null);
    try {
      const updated = bookingService.markOrderNotSold(bookingId);
      setSelectedOrder(updated);
      onRefreshData();
      notify(`Order ${bookingId} marked NOT SOLD. Reserved stock released.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to mark order NOT SOLD.');
    }
  };

  const handleVerifyHandoverOtp = (order: Booking) => {
    const cleanCode = enteredHandoverCode.trim();
    if (!cleanCode) {
      setErrorMsg('Please enter the handover code.');
      return;
    }
    setErrorMsg(null);

    if (order.deliveryMode === 'DELIVERY') {
      try {
        const { partner } = deliveryService.verifyPickupCodePreHandover({
          bookingId: order.bookingId,
          enteredCode: cleanCode,
        });
        setVerifiedPartnerIdentity(partner);
        setPartnerHandoverConfirmed(false);
        notify(`6-digit code verified! Please visually confirm Delivery Partner ${partner.name}.`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Invalid pickup code.');
      }
    } else {
      // Direct Customer Takeaway
      try {
        const updated = bookingService.verifyAndHandoverBooking({
          bookingId: order.bookingId,
          enteredCode: cleanCode,
          shopkeeperId: shopkeeper.shopkeeperId,
        });
        setSelectedOrder(updated);
        setHandoverSuccess(true);
        onRefreshData();
        notify('Customer pickup verified! Order marked COMPLETED / SOLD.');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Handover verification failed.');
      }
    }
  };

  const handleConfirmPartnerHandover = (order: Booking) => {
    if (!verifiedPartnerIdentity) return;
    setErrorMsg(null);
    try {
      const updated = deliveryService.confirmShopkeeperHandover({
        bookingId: order.bookingId,
        shopkeeperId: shopkeeper.shopkeeperId,
        acknowledgedPartnerId: verifiedPartnerIdentity.partnerId,
      });
      setSelectedOrder(updated);
      setHandoverSuccess(true);
      setVerifiedPartnerIdentity(null);
      setEnteredHandoverCode('');
      onRefreshData();
      notify(`Identity confirmed! Order handed over to Partner ${verifiedPartnerIdentity.name} (OUT FOR DELIVERY).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Handover authorization failed.');
    }
  };

  const handleQuantityStep = (productId: string, delta: number) => {
    try {
      productService.adjustQuantityByDelta(productId, delta);
      onRefreshData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update quantity.');
    }
  };

  const handleToggleProductAvailability = (productId: string, currentlyAvailable: boolean) => {
    try {
      productService.setAvailabilityStatus(productId, !currentlyAvailable);
      onRefreshData();
      notify(`Product status updated to ${!currentlyAvailable ? 'AVAILABLE' : 'OUT OF STOCK'}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update status.');
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditDesc(product.description);
    setEditPrice(String(product.price));
    setEditMrp(String(product.mrp || product.price));
    setEditGender(product.gender || 'UNISEX');
    setEditQty(String(product.quantity));
    setEditSizes([...product.sizes]);
    setEditColors([...product.colors]);
    setEditCustomColor('');
  };

  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setErrorMsg(null);

    const priceNum = Number(editPrice);
    const mrpNum = editMrp ? Number(editMrp) : priceNum;

    if (mrpNum < priceNum) {
      setErrorMsg('MRP cannot be less than the Offer Price.');
      return;
    }

    try {
      productService.updateProduct(editingProduct.productId, {
        name: editName,
        description: editDesc,
        price: priceNum,
        mrp: mrpNum,
        gender: editGender,
        quantity: Number(editQty),
        sizes: editSizes,
        colors: editColors,
      });
      setEditingProduct(null);
      onRefreshData();
      notify('Product updated successfully.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update product.');
    }
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const status = b.bookingStatus || b.status;
    if (orderFilter === 'CONFIRMED') {
      if (status !== 'CONFIRMED' && status !== 'BOOKED' && status !== 'READY_FOR_DELIVERY') return false;
    } else if (orderFilter === 'OUT_FOR_DELIVERY') {
      if (status !== 'OUT_FOR_DELIVERY') return false;
    } else if (orderFilter === 'SOLD') {
      if (status !== 'SOLD' && status !== 'DELIVERED') return false;
    } else if (orderFilter === 'NOT_SOLD') {
      if (status !== 'NOT_SOLD' && status !== 'CANCELLED' && status !== 'PAYMENT_REJECTED' && status !== 'EXPIRED')
        return false;
    }

    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      const matchId = b.bookingId.toLowerCase().includes(q) || (b.bookingReference || '').toLowerCase().includes(q);
      const matchCustomer = b.customerName.toLowerCase().includes(q) || b.customerMobile.includes(q);
      const matchProd = b.productName.toLowerCase().includes(q);
      if (!matchId && !matchCustomer && !matchProd) return false;
    }

    return true;
  });

  // Filter Products
  const filteredProducts = products.filter((p) => {
    if (productFilter === 'AVAILABLE' && p.quantity <= 0) return false;
    if (productFilter === 'OUT_OF_STOCK' && p.quantity > 0) return false;
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const shopUpi = shop.shopkeeperUpiId || shopkeeper.upiId || '';

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-24 space-y-6">
      {/* Shopkeeper Header */}
      <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shrink-0">
              <ResilientImage src={shop.photo} alt={shop.shopName} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <span>{shopkeeper.name}</span>
                <span>·</span>
                <span className="font-mono-tabular text-[var(--accent-primary)] font-bold">
                  {shopkeeper.shopkeeperId}
                </span>
                <span>·</span>
                <span className="font-mono-tabular">{shop.mobile}</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                {shop.shopName}
              </h1>
              <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{shop.locationName}</span>
                {shop.state && <span>({shop.state})</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Store OPEN / CLOSED Toggle */}
            <button
              type="button"
              onClick={handleToggleStoreStatus}
              className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                shop.status === 'OPEN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <span>{shop.status === 'OPEN' ? '🟢 STORE OPEN' : '🔴 STORE CLOSED'}</span>
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setShowNotifications(true)}
              className="relative min-h-[44px] min-w-[44px] px-3 py-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] flex items-center justify-center transition-colors"
              title="Shop Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white font-mono-tabular text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] px-4 py-2 rounded-2xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--status-danger)] hover:bg-red-500/10 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>LOGOUT</span>
            </button>
          </div>
        </div>

        {/* UPI Banner */}
        <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
            <QrCode className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Product Payment UPI ID:</span>
            {shopUpi ? (
              <span className="font-mono-tabular font-bold text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                {shopUpi}
              </span>
            ) : (
              <span className="text-[var(--status-warning)] font-semibold">
                Not configured (Update in Shop Profile)
              </span>
            )}
            {shopUpi && (
              <button
                type="button"
                onClick={() => {
                  setUpiQrOrder(null);
                  setShowUpiQrModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-[var(--accent-primary)] text-white text-[11px] font-bold flex items-center gap-1 hover:opacity-90 transition-opacity"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>SHOW QR</span>
              </button>
            )}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            Timing: {shop.openingTime || '10:00 AM'} – {shop.closingTime || '09:00 PM'} ·{' '}
            <span className="font-semibold text-[var(--text-primary)]">{shop.pricePolicy}</span>
          </div>
        </div>
      </div>

      {/* Dashboard Navigation Pills */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-x-auto shadow-2xs">
        {(
          [
            { id: 'HOME', label: 'Overview' },
            { id: 'ORDERS', label: `ORDERS (${bookings.length})` },
            { id: 'UPLOAD_PRODUCT', label: '+ UPLOAD PRODUCT' },
            { id: 'MANAGE_PRODUCTS', label: `MANAGE PRODUCTS (${products.length})` },
            { id: 'SHOP_PROFILE', label: 'SHOP PROFILE' },
          ] as { id: DashboardView; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
              view === tab.id
                ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global Alerts / Toasts */}
      {toastMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-[var(--status-success)] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </span>
          <button type="button" onClick={() => setToastMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-[var(--status-danger)] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ----------------- VIEW 1: OVERVIEW DASHBOARD ----------------- */}
      {view === 'HOME' && (
        <div className="space-y-4">
          {/* Main Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setView('ORDERS')}
              className="text-left p-6 rounded-3xl bg-[var(--bg-card)] border-2 border-[var(--accent-primary)]/35 hover:border-[var(--accent-primary)] transition-all space-y-3 group shadow-2xs"
            >
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)] text-white flex items-center justify-center">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                    CUSTOMER ORDERS
                  </h2>
                  <span className="font-mono-tabular text-sm font-bold px-2 py-0.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                    {bookings.length}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Process customer bookings, verify handover codes, and collect product payment.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setView('UPLOAD_PRODUCT')}
              className="text-left p-6 rounded-3xl bg-[var(--bg-card)] border-2 border-[var(--accent-primary)]/35 hover:border-[var(--accent-primary)] transition-all space-y-3 group shadow-2xs"
            >
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)] text-white flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                    UPLOAD PRODUCT
                  </h2>
                  <span className="font-mono-tabular text-sm font-bold px-2 py-0.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                    + Add
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Add photos, sizes, colors, MRP & offer prices to attract local buyers.
                </p>
              </div>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-1">
              <div className="text-[11px] text-[var(--text-muted)] font-medium">TOTAL PRODUCTS</div>
              <div className="font-display text-2xl font-bold text-[var(--text-primary)] font-mono-tabular">
                {products.length}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-1">
              <div className="text-[11px] text-[var(--text-muted)] font-medium">PENDING HANDOVER</div>
              <div className="font-display text-2xl font-bold text-amber-500 font-mono-tabular">
                {
                  bookings.filter(
                    (b) =>
                      b.status === 'CONFIRMED' ||
                      b.status === 'BOOKED' ||
                      b.status === 'READY_FOR_DELIVERY'
                  ).length
                }
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-1">
              <div className="text-[11px] text-[var(--text-muted)] font-medium">COMPLETED / SOLD</div>
              <div className="font-display text-2xl font-bold text-emerald-500 font-mono-tabular">
                {bookings.filter((b) => b.status === 'SOLD' || b.status === 'DELIVERED').length}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-1">
              <div className="text-[11px] text-[var(--text-muted)] font-medium">STORE STATUS</div>
              <div
                className={`font-display text-lg font-bold ${
                  shop.status === 'OPEN' ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {shop.status === 'OPEN' ? 'OPEN' : 'CLOSED'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- VIEW 2: ORDERS SECTION ----------------- */}
      {view === 'ORDERS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                Shop Orders
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Verify customer bookings, collect remaining amount, and manage handovers.
              </p>
            </div>

            {/* Order Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search orders, phone, ID..."
                className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'ALL' as OrderFilter, label: `All (${bookings.length})` },
              {
                id: 'CONFIRMED' as OrderFilter,
                label: `Ready / Confirmed (${
                  bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'BOOKED').length
                })`,
              },
              {
                id: 'OUT_FOR_DELIVERY' as OrderFilter,
                label: `Out for Delivery (${
                  bookings.filter((b) => b.status === 'OUT_FOR_DELIVERY').length
                })`,
              },
              {
                id: 'SOLD' as OrderFilter,
                label: `Completed / Sold (${
                  bookings.filter((b) => b.status === 'SOLD' || b.status === 'DELIVERED').length
                })`,
              },
              {
                id: 'NOT_SOLD' as OrderFilter,
                label: `Cancelled / Not Sold (${
                  bookings.filter(
                    (b) =>
                      b.status === 'NOT_SOLD' ||
                      b.status === 'CANCELLED' ||
                      b.status === 'PAYMENT_REJECTED'
                  ).length
                })`,
              },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setOrderFilter(f.id)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  orderFilter === f.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-12 text-center space-y-2">
              <ShoppingBag className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
              <p className="font-display text-xl font-bold text-[var(--text-primary)]">
                No orders match your filter.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Customer bookings for {shop.shopName} will appear here with real-time updates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredBookings.map((order) => {
                const currentStatus = order.bookingStatus || order.status;
                const isConfirmedReady =
                  currentStatus === 'CONFIRMED' ||
                  currentStatus === 'BOOKED' ||
                  currentStatus === 'READY_FOR_DELIVERY';
                const isPendingPayment =
                  currentStatus === 'PAYMENT_PENDING' ||
                  order.paymentStatus === 'PENDING_VERIFICATION';
                const isSold = currentStatus === 'SOLD' || currentStatus === 'DELIVERED';
                const isCancelled =
                  currentStatus === 'NOT_SOLD' ||
                  currentStatus === 'CANCELLED' ||
                  currentStatus === 'PAYMENT_REJECTED' ||
                  currentStatus === 'EXPIRED';

                const totalProductPrice = order.price;
                const advancePaid =
                  order.advanceAmount !== undefined
                    ? order.advanceAmount
                    : order.paymentAmount || 75 * order.quantity;
                const remainingToCollect =
                  order.remainingAmount !== undefined
                    ? order.remainingAmount
                    : Math.max(0, totalProductPrice - advancePaid);

                const isDeliveryMode = order.deliveryMode === 'DELIVERY';

                return (
                  <div
                    key={order.bookingId}
                    onClick={() => {
                      setSelectedOrder(order);
                      setEnteredHandoverCode('');
                      setHandoverSuccess(false);
                    }}
                    className="cursor-pointer rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] p-5 space-y-4 shadow-2xs transition-colors"
                  >
                    {/* Top Row: Booking ID + Delivery Mode Badge + Status Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-sm font-bold text-[var(--accent-primary)]">
                          {/^DW-\d{8}-[A-Z0-9]{6}$/.test(order.bookingId)
                            ? order.bookingId
                            : order.bookingReference || 'Order Reference'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                            isDeliveryMode
                              ? 'bg-blue-500/15 text-blue-600'
                              : 'bg-purple-500/15 text-purple-600'
                          }`}
                        >
                          {isDeliveryMode ? <Truck className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                          <span>{isDeliveryMode ? 'HOME DELIVERY' : 'STORE TAKEAWAY'}</span>
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                          isSold
                            ? 'bg-emerald-500/15 text-[var(--status-success)]'
                            : isConfirmedReady
                              ? 'bg-emerald-500/15 text-[var(--status-success)]'
                              : isPendingPayment
                                ? 'bg-amber-500/15 text-[var(--status-warning)]'
                                : 'bg-red-500/15 text-[var(--status-danger)]'
                        }`}
                      >
                        {isSold
                          ? 'SOLD • COMPLETED'
                          : isConfirmedReady
                            ? 'CONFIRMED • READY FOR HANDOVER'
                            : isPendingPayment
                              ? 'AWAITING ADMIN PAYMENT VERIFICATION'
                              : currentStatus}
                      </span>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="text-[var(--text-muted)]">Customer Details</div>
                        <div className="font-semibold text-sm text-[var(--text-primary)]">
                          {order.customerName}
                        </div>
                        <a
                          href={`tel:${order.customerMobile}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono-tabular text-[var(--accent-primary)] font-semibold flex items-center gap-1 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          <span>+91 {order.customerMobile}</span>
                        </a>
                        {isDeliveryMode && order.deliveryAddress && (
                          <div className="text-[11px] text-[var(--text-muted)]">
                            📍 {order.deliveryAddress.city}, {order.deliveryAddress.state}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="text-[var(--text-muted)]">Product & Pricing</div>
                        <div className="font-semibold text-sm text-[var(--text-primary)]">
                          {order.productName}
                        </div>
                        <div className="text-[var(--text-secondary)]">
                          Size: <strong>{order.size}</strong> · Color: <strong>{order.color}</strong> · Qty:{' '}
                          <strong className="font-mono-tabular">{order.quantity}</strong>
                        </div>
                        <div className="flex items-center gap-2 pt-1 font-mono-tabular">
                          <span className="text-[var(--text-muted)]">Total: ₹{totalProductPrice}</span>
                          <span className="text-emerald-600 font-bold">
                            Remaining to collect: ₹{remainingToCollect}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div
                      className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                        Deadline:{' '}
                        {new Date(order.pickupDeadline).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!isConfirmedReady}
                          onClick={() => handleMarkSold(order.bookingId)}
                          className="min-h-[40px] px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>MARK SOLD</span>
                        </button>

                        <button
                          type="button"
                          disabled={!isConfirmedReady}
                          onClick={() => handleMarkNotSold(order.bookingId)}
                          className="min-h-[40px] px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>NOT SOLD</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------- VIEW 3: UPLOAD PRODUCT SECTION ----------------- */}
      {view === 'UPLOAD_PRODUCT' && (
        <form
          onSubmit={handleUploadSubmit}
          className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 sm:p-8 space-y-6 shadow-xs"
        >
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
              Upload New Product
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Add photos, set offer price, and list available sizes & colors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Product Title <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <input
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="e.g. Pure Cotton Festive Kurta or Banarasi Silk Saree"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Product Description <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Describe fabric, fit, pattern, work, and occasion..."
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
              />
            </div>

            {/* Gender / Category */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Target Category / Gender <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <select
                value={prodGender}
                onChange={(e) => setProdGender(e.target.value as ProductGender)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
              >
                <option value="MEN">Men's Wear</option>
                <option value="WOMEN">Women's Wear</option>
                <option value="KIDS">Kids' Wear</option>
                <option value="UNISEX">Unisex / All</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Stock Quantity <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={prodQty}
                onChange={(e) => setProdQty(e.target.value)}
                placeholder="e.g. 15"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)]"
              />
            </div>

            {/* Offer Price */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Offer Price (₹) <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                placeholder="e.g. 799"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)]"
              />
            </div>

            {/* MRP */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Maximum Retail Price (MRP ₹)
              </label>
              <input
                type="number"
                min={1}
                value={prodMrp}
                onChange={(e) => setProdMrp(e.target.value)}
                placeholder="e.g. 1299"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)]"
              />
              {prodPrice && prodMrp && Number(prodMrp) > Number(prodPrice) && (
                <div className="text-[11px] text-emerald-600 font-bold mt-1">
                  {Math.round(((Number(prodMrp) - Number(prodPrice)) / Number(prodMrp)) * 100)}% Discount shown to customers!
                </div>
              )}
            </div>
          </div>

          {/* Photos Upload */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Product Photos (Up to 8 photos) <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <span className="font-mono-tabular text-xs text-[var(--text-muted)]">{photos.length} / 8</span>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoFiles(e.target.files)}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handlePhotoFiles(e.target.files)}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>TAKE PHOTO</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs font-semibold flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>CHOOSE FROM GALLERY</span>
              </button>
            </div>

            {isCompressing && (
              <p className="text-xs text-[var(--accent-primary)] font-medium flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Compressing images to ~300-400 KB target...</span>
              </p>
            )}

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {photos.map((p, idx) => (
                  <div key={idx} className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-2 space-y-1.5">
                    <div className="aspect-3/4 rounded-xl overflow-hidden bg-[var(--bg-secondary)]">
                      <ResilientImage src={p.thumbnail} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[var(--text-muted)] px-1">
                      <span>~{p.sizeKB} KB</span>
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[var(--status-danger)] font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sizes */}
          <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
            <label className="block text-xs font-semibold text-[var(--text-primary)]">
              Available Sizes <span className="text-[var(--accent-primary)]">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STANDARD_SIZES.map((sz) => {
                const active = selectedSizes.includes(sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => toggleItem(sz, selectedSizes, setSelectedSizes)}
                    className={`min-h-[40px] min-w-[44px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 max-w-xs pt-1">
              <input
                type="text"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                placeholder="Add custom size..."
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
              <button
                type="button"
                onClick={handleAddCustomSize}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-semibold"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
            <label className="block text-xs font-semibold text-[var(--text-primary)]">
              Available Colors <span className="text-[var(--accent-primary)]">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((clr) => {
                const active = selectedColors.includes(clr);
                return (
                  <button
                    key={clr}
                    type="button"
                    onClick={() => toggleItem(clr, selectedColors, setSelectedColors)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                    }`}
                  >
                    {clr}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 max-w-xs pt-1">
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="Add custom color..."
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-semibold"
              >
                + Add
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>LIST PRODUCT ON DESI WARDROBE</span>
          </button>
        </form>
      )}

      {/* ----------------- VIEW 4: MANAGE PRODUCTS SECTION ----------------- */}
      {view === 'MANAGE_PRODUCTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                Manage Products ({products.length})
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Update prices, stock counts, colors, or mark items in/out of stock.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setView('UPLOAD_PRODUCT')}
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>ADD PRODUCT</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Search products by title..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'ALL' as ProductFilter, label: `All (${products.length})` },
                {
                  id: 'AVAILABLE' as ProductFilter,
                  label: `In Stock (${products.filter((p) => p.quantity > 0).length})`,
                },
                {
                  id: 'OUT_OF_STOCK' as ProductFilter,
                  label: `Out of Stock (${products.filter((p) => p.quantity <= 0).length})`,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setProductFilter(f.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    productFilter === f.id
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-12 text-center space-y-2">
              <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
              <p className="font-display text-xl font-bold text-[var(--text-primary)]">
                No products found.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Tap <strong>ADD PRODUCT</strong> to upload clothing to your shop.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map((p) => {
                const isAvailable = p.quantity > 0;
                return (
                  <div
                    key={p.productId}
                    className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-3.5 shadow-2xs"
                  >
                    <div className="flex gap-3.5">
                      <div className="w-20 h-24 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shrink-0">
                        <ResilientImage
                          src={p.thumbnails?.[0] || p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {p.gender || 'UNISEX'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isAvailable
                                ? 'bg-emerald-500/15 text-[var(--status-success)]'
                                : 'bg-red-500/15 text-[var(--status-danger)]'
                            }`}
                          >
                            {isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-[var(--text-primary)] line-clamp-1">{p.name}</h3>

                        <div className="flex items-baseline gap-2 font-mono-tabular">
                          <span className="font-bold text-base text-[var(--accent-primary)]">₹{p.price}</span>
                          {p.mrp && p.mrp > p.price && (
                            <span className="text-xs text-[var(--text-muted)] line-through">₹{p.mrp}</span>
                          )}
                          {p.discountPercent ? (
                            <span className="text-[11px] font-bold text-emerald-600">
                              {p.discountPercent}% OFF
                            </span>
                          ) : null}
                        </div>

                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          Sizes: {p.sizes.join(', ')}
                        </div>
                      </div>
                    </div>

                    {/* Stock Step Controls */}
                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">Stock:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuantityStep(p.productId, -1)}
                            className="min-h-[36px] min-w-[36px] rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono-tabular font-bold text-sm px-2 text-[var(--text-primary)]">
                            {p.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityStep(p.productId, 1)}
                            className="min-h-[36px] min-w-[36px] rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Stock Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleProductAvailability(p.productId, isAvailable)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                          isAvailable
                            ? 'border-red-500/30 text-red-600 hover:bg-red-500/10'
                            : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                        }`}
                      >
                        {isAvailable ? 'Mark Out of Stock' : 'Mark In Stock'}
                      </button>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 hover:border-[var(--accent-primary)]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Product</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete product "${p.name}"?`)) {
                            productService.deleteProduct(p.productId);
                            onRefreshData();
                            notify('Product deleted.');
                          }
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-500/10 text-xs font-semibold text-[var(--status-danger)] hover:bg-red-500/20 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------- VIEW 5: SHOP PROFILE SECTION ----------------- */}
      {view === 'SHOP_PROFILE' && (
        <ShopProfileSetupPage
          shop={shop}
          onSaved={() => {
            onRefreshData();
            notify('Shop profile updated successfully.');
            setView('HOME');
          }}
          onCancel={() => setView('HOME')}
        />
      )}

      {/* Complete Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <div className="text-xs text-[var(--text-muted)]">Order Details</div>
                <h3 className="font-mono-tabular text-lg font-bold text-[var(--accent-primary)]">
                  {selectedOrder.bookingId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[var(--text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Status:</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Mode:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedOrder.deliveryMode === 'DELIVERY' ? '🚚 Home Delivery' : '🛍️ Store Takeaway'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Customer:</span>
                <span className="font-semibold text-[var(--text-primary)]">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Mobile:</span>
                <a
                  href={`tel:${selectedOrder.customerMobile}`}
                  className="font-mono-tabular text-[var(--accent-primary)] font-bold hover:underline"
                >
                  +91 {selectedOrder.customerMobile}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Product:</span>
                <span className="font-semibold text-[var(--text-primary)]">{selectedOrder.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Size & Color:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedOrder.size} · {selectedOrder.color}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Quantity:</span>
                <span className="font-mono-tabular font-bold">{selectedOrder.quantity}</span>
              </div>
            </div>

            {/* Financial Details Box */}
            <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-1.5 text-xs font-mono-tabular">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Total Product Price:</span>
                <span className="font-bold text-[var(--text-primary)]">₹{selectedOrder.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Advance Paid to Admin:</span>
                <span className="text-emerald-600 font-semibold">
                  ₹{selectedOrder.advanceAmount ?? (selectedOrder.paymentAmount || 75 * selectedOrder.quantity)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[var(--border-subtle)] text-sm">
                <span className="font-bold text-[var(--text-primary)]">Remaining to Collect:</span>
                <span className="font-bold text-emerald-600">
                  ₹{selectedOrder.remainingAmount ?? Math.max(0, selectedOrder.price - (selectedOrder.advanceAmount ?? (selectedOrder.paymentAmount || 75 * selectedOrder.quantity)))}
                </span>
              </div>
              {shopUpi && (
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    UPI ID: <strong className="text-[var(--text-primary)]">{shopUpi}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUpiQrOrder(selectedOrder);
                      setShowUpiQrModal(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-bold flex items-center gap-1 hover:opacity-90 transition-opacity shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>SHOW PAYMENT QR</span>
                  </button>
                </div>
              )}
            </div>

            {/* Handover Code Verification & Identity Confirmation */}
            {(selectedOrder.status === 'CONFIRMED' || selectedOrder.status === 'BOOKED') && (
              <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                {selectedOrder.deliveryMode === 'DELIVERY' ? (
                  <>
                    {!verifiedPartnerIdentity ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[var(--text-primary)]">
                          Delivery Partner 6-Digit Pickup Code
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            value={enteredHandoverCode}
                            onChange={(e) => setEnteredHandoverCode(e.target.value.trim().toUpperCase())}
                            placeholder="6-digit code"
                            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm tracking-wider"
                          />
                          <button
                            type="button"
                            onClick={() => handleVerifyHandoverOtp(selectedOrder)}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider"
                          >
                            Verify Code
                          </button>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Enter the 6-digit numeric pickup code shown on the Delivery Partner’s app.
                        </p>
                      </div>
                    ) : (
                      /* STEP 2: Shopkeeper Visual Identity Confirmation */
                      <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>STEP 2: CONFIRM PARTNER IDENTITY</span>
                        </div>

                        <div className="flex items-center gap-3 bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-subtle)]">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shrink-0 border border-[var(--border-subtle)]">
                            <ResilientImage
                              src={verifiedPartnerIdentity.profilePhoto || ''}
                              alt={verifiedPartnerIdentity.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="space-y-0.5 text-xs">
                            <div className="font-bold text-sm text-[var(--text-primary)]">
                              {verifiedPartnerIdentity.name}
                            </div>
                            <div className="font-mono-tabular font-bold text-blue-600">
                              ID: {verifiedPartnerIdentity.partnerId}
                            </div>
                            <div className="font-mono-tabular text-[var(--text-secondary)]">
                              Phone: +91 {verifiedPartnerIdentity.contactNumber}
                            </div>
                            {verifiedPartnerIdentity.vehicleNumber && (
                              <div className="text-[11px] text-[var(--text-muted)]">
                                Vehicle: {verifiedPartnerIdentity.vehicleType || 'Vehicle'} (
                                {verifiedPartnerIdentity.vehicleNumber})
                              </div>
                            )}
                          </div>
                        </div>

                        <label className="flex items-start gap-2 cursor-pointer text-xs text-[var(--text-primary)] pt-1">
                          <input
                            type="checkbox"
                            checked={partnerHandoverConfirmed}
                            onChange={(e) => setPartnerHandoverConfirmed(e.target.checked)}
                            className="mt-0.5 rounded text-[var(--accent-primary)] focus:ring-0"
                          />
                          <span>
                            I confirm that I have physically verified this Delivery Partner and their
                            identity matches.
                          </span>
                        </label>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setVerifiedPartnerIdentity(null);
                              setEnteredHandoverCode('');
                            }}
                            className="min-h-[44px] px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!partnerHandoverConfirmed}
                            onClick={() => handleConfirmPartnerHandover(selectedOrder)}
                            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirm & Handover Package</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Store Takeaway Customer Pickup */
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">
                      Customer Pickup Code / Mobile (Last 4 Digits)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={enteredHandoverCode}
                        onChange={(e) => setEnteredHandoverCode(e.target.value.trim().toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyHandoverOtp(selectedOrder)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider"
                      >
                        Verify & Handover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={
                  (selectedOrder.bookingStatus || selectedOrder.status) !== 'CONFIRMED' &&
                  (selectedOrder.bookingStatus || selectedOrder.status) !== 'BOOKED'
                }
                onClick={() => handleMarkSold(selectedOrder.bookingId)}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>MARK SOLD</span>
              </button>

              <button
                type="button"
                disabled={
                  (selectedOrder.bookingStatus || selectedOrder.status) !== 'CONFIRMED' &&
                  (selectedOrder.bookingStatus || selectedOrder.status) !== 'BOOKED'
                }
                onClick={() => handleMarkNotSold(selectedOrder.bookingId)}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>NOT SOLD</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleSaveEditProduct}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                Edit Product
              </h3>
              <button type="button" onClick={() => setEditingProduct(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Offer Price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={editMrp}
                    onChange={(e) => setEditMrp(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Category / Gender</label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as ProductGender)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm"
                >
                  <option value="MEN">Men's Wear</option>
                  <option value="WOMEN">Women's Wear</option>
                  <option value="KIDS">Kids' Wear</option>
                  <option value="UNISEX">Unisex / All</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Sizes</label>
                <div className="flex flex-wrap gap-1.5">
                  {STANDARD_SIZES.map((sz) => {
                    const active = editSizes.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => toggleItem(sz, editSizes, setEditSizes)}
                        className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-semibold ${
                          active
                            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Colors</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set([...STANDARD_COLORS, ...editColors])).map((clr) => {
                    const active = editColors.includes(clr);
                    return (
                      <button
                        key={clr}
                        type="button"
                        onClick={() => toggleItem(clr, editColors, setEditColors)}
                        className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-semibold ${
                          active
                            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {clr}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[44px] px-5 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notifications Drawer Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                  Notifications
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[var(--text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No notifications right now.
              </div>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => (
                  <div
                    key={n.notificationId}
                    className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                      n.read
                        ? 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        : 'bg-[var(--accent-soft)] border-[var(--accent-primary)]/30 text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="font-bold">{n.title}</div>
                    <div className="text-[11px] leading-relaxed">{n.message}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono-tabular pt-1">
                      {new Date(n.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    notificationService.markAllShopkeeperNotificationsAsRead(shopkeeper.shopkeeperId);
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    notify('All notifications marked as read.');
                  }}
                  className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Mark All as Read
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPI QR Code Modal */}
      {showUpiQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                  {upiQrOrder ? 'Order Payment QR' : 'Shop UPI QR Code'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUpiQrModal(false);
                  setUpiQrOrder(null);
                }}
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[var(--text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-base text-[var(--text-primary)]">{shop.shopName}</div>
              <div className="text-xs text-[var(--text-muted)] font-mono-tabular flex items-center justify-center gap-1.5">
                <span>{shopUpi}</span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(shopUpi);
                    notify('UPI ID copied to clipboard.');
                  }}
                  className="p-1 hover:text-[var(--accent-primary)] transition-colors"
                  title="Copy UPI ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* QR Code Canvas */}
            <div className="p-4 bg-white rounded-2xl inline-block mx-auto border-2 border-[var(--accent-primary)]/40 shadow-xs">
              <QRCodeCanvas
                value={
                  upiQrOrder
                    ? `upi://pay?pa=${encodeURIComponent(shopUpi)}&pn=${encodeURIComponent(
                        shop.shopName
                      )}&am=${
                        upiQrOrder.remainingAmount ??
                        Math.max(
                          0,
                          upiQrOrder.price -
                            (upiQrOrder.advanceAmount ??
                              (upiQrOrder.paymentAmount || 75 * upiQrOrder.quantity))
                        )
                      }&cu=INR`
                    : `upi://pay?pa=${encodeURIComponent(shopUpi)}&pn=${encodeURIComponent(
                        shop.shopName
                      )}&cu=INR`
                }
                size={200}
                level="M"
              />
            </div>

            {upiQrOrder && (
              <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-mono-tabular space-y-1">
                <div className="text-[var(--text-muted)]">Remaining Amount Due:</div>
                <div className="font-bold text-xl text-emerald-600">
                  ₹
                  {upiQrOrder.remainingAmount ??
                    Math.max(
                      0,
                      upiQrOrder.price -
                        (upiQrOrder.advanceAmount ??
                          (upiQrOrder.paymentAmount || 75 * upiQrOrder.quantity))
                    )}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  Order ID: {upiQrOrder.bookingId}
                </div>
              </div>
            )}

            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Customer or Delivery Partner can scan using any UPI App (Google Pay, PhonePe, Paytm,
              BHIM). Payment goes directly into your bank account.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowUpiQrModal(false);
                setUpiQrOrder(null);
              }}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
