import React, { useState, useEffect } from 'react';
import {
  Truck,
  Power,
  RefreshCw,
  LogOut,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Clock,
  IndianRupee,
  Package,
  Store,
  User,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Car,
  Lock,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { ResilientImage } from '../../components/ResilientImage';
import {
  deliveryService,
  calculateDeliveryCharge,
  isDeliveryOperatingHoursIST,
  getDeliveryHoursNotice,
} from '../../services/deliveryService';
import { shopService } from '../../services/shopService';
import { storage } from '../../utils/storage';
import {
  Booking,
  DeliveryPartner,
  Shop,
} from '../../types/models';

interface DeliveryPartnerDashboardPageProps {
  partner: DeliveryPartner;
  onLogout: () => void;
  onRefreshPartner?: () => void;
}

type DashboardTab = 'ACTIVE' | 'HISTORY' | 'EARNINGS' | 'PROFILE' | 'SUPPORT';

export const DeliveryPartnerDashboardPage: React.FC<DeliveryPartnerDashboardPageProps> = ({
  partner: initialPartner,
  onLogout,
  onRefreshPartner,
}) => {
  const [partner, setPartner] = useState<DeliveryPartner>(initialPartner);
  const [activeTab, setActiveTab] = useState<DashboardTab>('ACTIVE');
  const [activeOrder, setActiveOrder] = useState<Booking | null>(null);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Booking[]>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<Booking[]>([]);

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Delivery Completion Modal State
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionCodeInput, setCompletionCodeInput] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Delivery Failure / Issue Modal State
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureReason, setFailureReason] = useState('Customer unreachable after multiple attempts');
  const [failureNotes, setFailureNotes] = useState('');
  const [isSubmittingFailure, setIsSubmittingFailure] = useState(false);

  // Document Viewer Modal State
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);
  const [viewingDocTitle, setViewingDocTitle] = useState<string>('');

  const isHoursOpen = isDeliveryOperatingHoursIST();

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = () => {
    setIsRefreshing(true);
    try {
      // Refresh partner details from storage
      const refreshedPartner = deliveryService.getPartnerById(partner.partnerId) || partner;
      setPartner(refreshedPartner);

      // Check active order
      const allBookings = storage.getBookings();
      if (refreshedPartner.currentActiveOrderId) {
        const current = allBookings.find(
          (b) =>
            b.bookingId === refreshedPartner.currentActiveOrderId ||
            b.bookingReference === refreshedPartner.currentActiveOrderId
        );
        setActiveOrder(current || null);
        if (current) {
          const shop = shopService.getShopById(current.shopId);
          setActiveShop(shop || null);
        } else {
          setActiveShop(null);
        }
      } else {
        // Fallback check if any order has partner assigned and not SOLD
        const ongoing = allBookings.find(
          (b) =>
            b.assignedPartnerId === refreshedPartner.partnerId &&
            b.bookingStatus !== 'SOLD' &&
            b.status !== 'SOLD' &&
            b.status !== 'NOT_SOLD' &&
            b.status !== 'CANCELLED'
        );
        setActiveOrder(ongoing || null);
        if (ongoing) {
          const shop = shopService.getShopById(ongoing.shopId);
          setActiveShop(shop || null);
        } else {
          setActiveShop(null);
        }
      }

      // Available orders for assignment
      const available = deliveryService.getAvailableDeliveryOrders();
      setAvailableOrders(available);

      // Partner delivery history
      const history = deliveryService.getPartnerDeliveryHistory(refreshedPartner.partnerId);
      setDeliveryHistory(history);
    } catch (err) {
      console.error('Error loading delivery dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [partner.partnerId]);

  // Online / Offline Toggle
  const handleToggleOnline = () => {
    setErrorMsg(null);
    try {
      const updated = deliveryService.togglePartnerOnlineStatus(partner.partnerId);
      setPartner(updated);
      notify(`Status changed to ${updated.status}.`);
      onRefreshPartner?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  // Accept / Claim Order
  const handleAcceptOrder = (bookingId: string) => {
    setErrorMsg(null);
    try {
      const result = deliveryService.claimOrAssignDeliveryOrder({
        bookingId,
        partnerId: partner.partnerId,
      });
      setPartner(result.partner);
      setActiveOrder(result.booking);
      loadData();
      notify(`Order ${result.booking.bookingId} accepted! Proceed to the shop for pickup.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to accept order.');
    }
  };

  // Copy Pickup Code
  const handleCopyPickupCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    notify('6-digit pickup code copied to clipboard.');
  };

  // Complete Delivery Submit
  const handleCompleteDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setIsSubmittingCompletion(true);
    setErrorMsg(null);

    try {
      deliveryService.completeCustomerDelivery({
        bookingId: activeOrder.bookingId,
        partnerId: partner.partnerId,
        completionCode: completionCodeInput.trim() || undefined,
      });
      setShowCompletionModal(false);
      setCompletionCodeInput('');
      notify('Delivery completed successfully! Great job.');
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to complete delivery.');
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  // Report Issue Submit
  const handleReportFailureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setIsSubmittingFailure(true);
    setErrorMsg(null);

    try {
      deliveryService.reportDeliveryFailure({
        bookingId: activeOrder.bookingId,
        partnerId: partner.partnerId,
        reason: failureReason,
        notes: failureNotes.trim() || undefined,
      });
      setShowFailureModal(false);
      setFailureNotes('');
      notify('Issue reported and order status updated.');
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to report issue.');
    } finally {
      setIsSubmittingFailure(false);
    }
  };

  const isOnline = partner.status === 'ONLINE';
  const isDelivering = partner.status === 'CURRENTLY_DELIVERING';
  const isApproved = partner.approvalStatus === 'APPROVED';

  // Calculate real earnings
  const completedDeliveriesList = deliveryHistory.filter(
    (b) => b.bookingStatus === 'SOLD' || b.status === 'SOLD'
  );
  const totalEarningsCalculated = completedDeliveriesList.reduce((sum, b) => {
    const fee = b.deliveryCharge || calculateDeliveryCharge(5);
    return sum + fee;
  }, 0);

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-20 min-h-screen flex flex-col justify-between">
      <div className="space-y-5">
        {/* Top Header Card */}
        <header className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center">
                {partner.profilePhoto ? (
                  <img
                    src={partner.profilePhoto}
                    alt={partner.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Truck className="w-6 h-6 text-blue-600" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)]">
                    {partner.name}
                  </h1>
                  <span className="font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600">
                    {partner.partnerId}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5 font-medium">
                  <Car className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>
                    {partner.vehicleType} · {partner.vehicleNumber || 'Unregistered'}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout & Refresh Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loadData}
                disabled={isRefreshing}
                className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--border-subtle)] flex items-center justify-center transition-colors text-[var(--text-secondary)]"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] hover:bg-red-500/10 hover:text-red-600 flex items-center justify-center transition-colors text-[var(--text-secondary)]"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Online / Offline Status Toggle Bar */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isDelivering
                    ? 'bg-blue-500 animate-pulse'
                    : isOnline
                      ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                      : 'bg-stone-400'
                }`}
              />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {isDelivering
                  ? 'ON ACTIVE ROUTE'
                  : isOnline
                    ? 'ONLINE — READY FOR ORDERS'
                    : 'OFFLINE — OFF DUTY'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleOnline}
              disabled={isDelivering || !isApproved}
              className={`min-h-[38px] px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                isOnline || isDelivering
                  ? 'bg-stone-200 dark:bg-stone-800 text-[var(--text-primary)] hover:bg-stone-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              } disabled:opacity-50`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isOnline ? 'Go Offline' : 'Go Online'}</span>
            </button>
          </div>
        </header>

        {/* Operating Hours Banner */}
        {!isHoursOpen && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Operating Hours Alert</p>
              <p className="mt-0.5 leading-relaxed">{getDeliveryHoursNotice()}</p>
            </div>
          </div>
        )}

        {/* Toast / Error alerts */}
        {toastMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">{toastMsg}</p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border-subtle)]">
          {[
            { id: 'ACTIVE' as DashboardTab, label: 'Active & Requests', icon: Truck },
            { id: 'HISTORY' as DashboardTab, label: `History (${deliveryHistory.length})`, icon: Package },
            { id: 'EARNINGS' as DashboardTab, label: 'Earnings', icon: IndianRupee },
            { id: 'PROFILE' as DashboardTab, label: 'Profile & Docs', icon: User },
            { id: 'SUPPORT' as DashboardTab, label: 'Help & Rules', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* -------------------- TAB: ACTIVE & REQUESTS -------------------- */}
        {activeTab === 'ACTIVE' && (
          <div className="space-y-6">
            {/* SUB-SECTION 1: CURRENT ACTIVE ORDER */}
            {activeOrder ? (
              <div className="rounded-3xl bg-[var(--bg-card)] border-2 border-blue-500/40 p-5 sm:p-6 shadow-sm space-y-5">
                {/* Order Header */}
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      CURRENT ACTIVE DELIVERY
                    </span>
                    <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      Order #{activeOrder.bookingId}
                    </h2>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                      activeOrder.bookingStatus === 'OUT_FOR_DELIVERY' || activeOrder.handoverVerifiedAt
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {activeOrder.bookingStatus === 'OUT_FOR_DELIVERY' || activeOrder.handoverVerifiedAt
                      ? 'Out For Delivery'
                      : 'Pickup Pending'}
                  </span>
                </div>

                {/* STEP 1: PICKUP CODE CARD (Show to Shopkeeper) */}
                {(!activeOrder.handoverVerifiedAt && activeOrder.bookingStatus !== 'OUT_FOR_DELIVERY') && (
                  <div className="p-4 sm:p-5 rounded-3xl bg-blue-500/10 border-2 border-blue-500/30 text-center space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      SHOW THIS 6-DIGIT CODE TO SHOPKEEPER
                    </span>

                    <div className="flex items-center justify-center gap-3">
                      <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold tracking-widest text-blue-700 dark:text-blue-200 bg-[var(--bg-card)] px-5 py-2 rounded-2xl border border-blue-500/30 shadow-inner">
                        {activeOrder.pickupCode || '123456'}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPickupCode(activeOrder.pickupCode || '123456')}
                        className="w-11 h-11 rounded-2xl bg-[var(--bg-card)] border border-blue-500/30 flex items-center justify-center text-blue-600 hover:bg-blue-500/20 transition-colors shadow-xs"
                        title="Copy Code"
                      >
                        {copiedCode ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                      Shopkeeper will verify this code on their dashboard and visually inspect your face/ID before handing over the parcel.
                    </p>
                  </div>
                )}

                {/* PICKUP SHOP DETAILS */}
                <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        PICKUP FROM SHOP
                      </span>
                    </div>
                    {activeShop && (
                      <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                        {activeShop.locationName}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                      {activeOrder.shopName}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {activeShop?.locationName || activeOrder.shopLocationName || 'Shop address unavailable'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {activeShop?.mobile && (
                      <a
                        href={`tel:${activeShop.mobile}`}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call Shop (+91 {activeShop.mobile})</span>
                      </a>
                    )}
                    {activeShop?.locationName && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          activeShop.locationName
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] font-bold text-xs flex items-center gap-1.5 text-[var(--text-primary)] transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        <span>Directions</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* CUSTOMER DESTINATION DETAILS */}
                <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        DELIVER TO CUSTOMER
                      </span>
                    </div>
                    <span className="font-mono-tabular text-xs font-bold text-emerald-600">
                      Fee: ₹{activeOrder.deliveryCharge || calculateDeliveryCharge(5)}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                      {activeOrder.customerName}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {activeOrder.deliveryAddress
                        ? `${activeOrder.deliveryAddress.street}, ${activeOrder.deliveryAddress.city}, PIN: ${activeOrder.deliveryAddress.pincode || ''}`
                        : 'Customer address on record'}
                    </p>
                    {activeOrder.deliveryAddress?.landmark && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium">
                        Landmark: {activeOrder.deliveryAddress.landmark}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={`tel:${activeOrder.customerMobile}`}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Customer (+91 {activeOrder.customerMobile})</span>
                    </a>

                    {activeOrder.deliveryAddress && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${activeOrder.deliveryAddress.street} ${activeOrder.deliveryAddress.city} ${activeOrder.deliveryAddress.state}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] font-bold text-xs flex items-center gap-1.5 text-[var(--text-primary)] transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        <span>Navigate</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* ITEM SUMMARY & REMAINING PAYMENT */}
                <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                    <span>Package: {activeOrder.productName}</span>
                    <span className="font-mono-tabular">Qty: {activeOrder.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-secondary)]">
                    <span>Size: {activeOrder.size} · Color: {activeOrder.color}</span>
                    <span className="font-mono-tabular">
                      Advance Paid: ₹{activeOrder.advanceAmount || 75}
                    </span>
                  </div>
                  {activeOrder.remainingAmount ? (
                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-amber-700 dark:text-amber-300 font-bold">
                      <span>Collect at Doorstep:</span>
                      <span className="font-mono-tabular text-sm">₹{activeOrder.remainingAmount}</span>
                    </div>
                  ) : null}
                </div>

                {/* ACTIONS */}
                <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCompletionModal(true)}
                    className="w-full sm:flex-1 min-h-[48px] px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Deliver & Complete Order</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFailureModal(true)}
                    className="w-full sm:w-auto min-h-[48px] px-4 py-2.5 rounded-2xl bg-[var(--bg-secondary)] hover:bg-red-500/10 hover:text-red-600 text-[var(--text-secondary)] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Report Issue</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* SUB-SECTION 2: AVAILABLE DELIVERY REQUESTS NEARBY */}
            {!activeOrder && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      Available Delivery Orders ({availableOrders.length})
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Orders ready for pickup within your 15 KM delivery radius.
                    </p>
                  </div>
                </div>

                {!isOnline ? (
                  <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 text-center space-y-3">
                    <Power className="w-10 h-10 text-stone-400 mx-auto" />
                    <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                      You are Currently Offline
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
                      Switch to Online mode above to start viewing and accepting available delivery requests.
                    </p>
                    <button
                      type="button"
                      onClick={handleToggleOnline}
                      disabled={!isApproved}
                      className="min-h-[44px] px-6 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      Turn Online
                    </button>
                  </div>
                ) : availableOrders.length === 0 ? (
                  <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-10 text-center space-y-3">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center relative">
                        <Truck className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                        Searching for Nearby Orders
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
                        You are online! When customers place delivery orders with local shops, they will appear right here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableOrders.map((order) => {
                      const fee = order.deliveryCharge || calculateDeliveryCharge(5);

                      return (
                        <div
                          key={order.bookingId}
                          className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs hover:border-blue-500/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono-tabular text-xs font-bold text-blue-600">
                              Order #{order.bookingId}
                            </span>
                            <span className="font-mono-tabular text-sm font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                              Earn ₹{fee}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex items-start gap-2">
                              <Store className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[var(--text-muted)]">Pickup Shop:</span>
                                <p className="font-bold text-[var(--text-primary)]">{order.shopName}</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[var(--text-muted)]">Deliver To:</span>
                                <p className="font-bold text-[var(--text-primary)]">
                                  {order.customerName} · {order.deliveryAddress?.city || 'Local Area'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                            <span className="text-[11px] text-[var(--text-muted)]">
                              1 Active Delivery Policy Enforced
                            </span>

                            <button
                              type="button"
                              onClick={() => handleAcceptOrder(order.bookingId)}
                              className="min-h-[42px] px-5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
                            >
                              <span>Accept Delivery</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* -------------------- TAB: HISTORY -------------------- */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Delivery History ({deliveryHistory.length})
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Complete record of fulfilled and reported deliveries.
              </p>
            </div>

            {deliveryHistory.length === 0 ? (
              <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-10 text-center space-y-2">
                <Package className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                <p className="font-display text-base font-bold text-[var(--text-primary)]">
                  No Past Deliveries Yet
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Deliveries you complete will be logged here with timestamps and earned fees.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveryHistory.map((item) => {
                  const isSold = item.bookingStatus === 'SOLD' || item.status === 'SOLD';
                  const isFailed = item.status === 'NOT_SOLD';
                  const fee = item.deliveryCharge || calculateDeliveryCharge(5);

                  return (
                    <div
                      key={item.bookingId}
                      className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="font-mono-tabular text-xs font-bold text-blue-600">
                            #{item.bookingId}
                          </span>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {new Date(item.deliveryCompletedAt || item.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            isSold
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : isFailed
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                : 'bg-blue-500/15 text-blue-600'
                          }`}
                        >
                          {isSold ? 'DELIVERED' : isFailed ? 'REPORTED ISSUE' : item.bookingStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[var(--text-muted)]">Shop:</span>
                          <p className="font-bold text-[var(--text-primary)] truncate">{item.shopName}</p>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Customer:</span>
                          <p className="font-bold text-[var(--text-primary)] truncate">{item.customerName}</p>
                        </div>
                      </div>

                      {item.deliveryFailureReason && (
                        <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 text-[11px]">
                          <strong>Issue:</strong> {item.deliveryFailureReason}
                        </div>
                      )}

                      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Product: {item.productName} (x{item.quantity})</span>
                        <span className="font-mono-tabular font-bold text-emerald-600">
                          {isSold ? `+ ₹${fee} Earned` : '₹0'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -------------------- TAB: EARNINGS -------------------- */}
        {activeTab === 'EARNINGS' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Earnings & Payouts
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Real calculated delivery charges earned from verified completions.
              </p>
            </div>

            {/* Earnings Metrics Cards */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-1 shadow-2xs">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  Total Deliveries
                </span>
                <div className="font-mono-tabular text-3xl font-extrabold text-[var(--text-primary)]">
                  {completedDeliveriesList.length}
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">Successfully Delivered</span>
              </div>

              <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-1 shadow-2xs">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  Total Earned
                </span>
                <div className="font-mono-tabular text-3xl font-extrabold text-emerald-600">
                  ₹{totalEarningsCalculated}
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">Direct UPI Payout</span>
              </div>
            </div>

            {/* Payout Destination Info */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Payout Destination UPI
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                  VERIFIED
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm font-bold text-[var(--text-primary)]">
                {partner.upiId || 'No UPI ID registered'}
              </div>

              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Delivery charges for each successful order are credited directly to your registered UPI ID. Settlements are processed daily at 11:00 PM IST.
              </p>
            </div>
          </div>
        )}

        {/* -------------------- TAB: PROFILE & DOCS -------------------- */}
        {activeTab === 'PROFILE' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Partner Profile & Documents
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Identity records, vehicle details, and annual photo lock policy.
              </p>
            </div>

            {/* Profile Photo Section with Annual Lock Restriction */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                    Profile Photo (Locked for 1 Year)
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  ANNUAL LOCK ACTIVE
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center">
                  {partner.profilePhoto ? (
                    <img
                      src={partner.profilePhoto}
                      alt={partner.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="font-bold text-[var(--text-primary)]">
                    Captured Live via Device Camera
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Under Desi Wardrobe security rules, profile photos can only be updated 365 days after the previous upload to prevent account sharing and impersonation.
                  </p>
                  <p className="text-[10px] font-mono-tabular text-[var(--text-muted)]">
                    Uploaded: {partner.profilePhotoUploadedAt ? new Date(partner.profilePhotoUploadedAt).toLocaleDateString() : 'At Registration'}
                  </p>
                </div>
              </div>
            </div>

            {/* Verification Documents View */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                    Submitted Identity Documents
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {partner.verificationStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Aadhaar Front */}
                <button
                  type="button"
                  onClick={() => {
                    if (partner.aadhaarFrontDoc) {
                      setViewingDocUrl(partner.aadhaarFrontDoc);
                      setViewingDocTitle('Aadhaar Card (Front)');
                    }
                  }}
                  className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-blue-500 text-left space-y-1.5 transition-colors"
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold">Document 1</span>
                  <div className="font-bold text-[var(--text-primary)] truncate">Aadhaar Front</div>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View Document
                  </span>
                </button>

                {/* Aadhaar Back */}
                <button
                  type="button"
                  onClick={() => {
                    if (partner.aadhaarBackDoc) {
                      setViewingDocUrl(partner.aadhaarBackDoc);
                      setViewingDocTitle('Aadhaar Card (Back)');
                    }
                  }}
                  className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-blue-500 text-left space-y-1.5 transition-colors"
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold">Document 2</span>
                  <div className="font-bold text-[var(--text-primary)] truncate">Aadhaar Back</div>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View Document
                  </span>
                </button>

                {/* DL Front */}
                <button
                  type="button"
                  onClick={() => {
                    if (partner.drivingLicenceFrontDoc) {
                      setViewingDocUrl(partner.drivingLicenceFrontDoc);
                      setViewingDocTitle('Driving Licence (Front)');
                    }
                  }}
                  className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-blue-500 text-left space-y-1.5 transition-colors"
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold">Document 3</span>
                  <div className="font-bold text-[var(--text-primary)] truncate">Licence Front</div>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View Document
                  </span>
                </button>

                {/* DL Back */}
                <button
                  type="button"
                  onClick={() => {
                    if (partner.drivingLicenceBackDoc) {
                      setViewingDocUrl(partner.drivingLicenceBackDoc);
                      setViewingDocTitle('Driving Licence (Back)');
                    }
                  }}
                  className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-blue-500 text-left space-y-1.5 transition-colors"
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold">Document 4</span>
                  <div className="font-bold text-[var(--text-primary)] truncate">Licence Back</div>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View Document
                  </span>
                </button>
              </div>
            </div>

            {/* Permanent Profile Details */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3 text-xs shadow-2xs">
              <h3 className="font-display text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2">
                Account Details
              </h3>

              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)]">Permanent Partner ID:</span>
                <span className="font-mono-tabular font-bold text-blue-600">{partner.partnerId}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)]">Contact Mobile:</span>
                <span className="font-mono-tabular font-bold">+91 {partner.contactNumber}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)]">Vehicle:</span>
                <span className="font-bold">{partner.vehicleType} · {partner.vehicleNumber}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)]">Service Area:</span>
                <span className="font-bold">{partner.serviceArea || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)]">Residential Address:</span>
                <span className="font-bold text-right max-w-xs">{partner.residentialAddress || 'On file'}</span>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- TAB: SUPPORT & RULES -------------------- */}
        {activeTab === 'SUPPORT' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Help & Partner Guidelines
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Essential operating rules, pickup verification, and support contacts.
              </p>
            </div>

            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3.5 shadow-2xs text-xs">
              <div className="space-y-1">
                <h3 className="font-bold text-[var(--text-primary)]">1. Shop Pickup Verification</h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  When you arrive at the shop, show your 6-digit pickup code to the shopkeeper. The shopkeeper will verify the code and visually confirm your face against your profile photo. Handover is authorized only after visual confirmation.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-[var(--text-primary)]">2. One Active Delivery Rule</h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  To ensure fast and reliable deliveries for our customers, a partner can hold only one active order at a time. Complete your current delivery before accepting another request.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-[var(--text-primary)]">3. Operating Hours & Delivery Radius</h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Normal delivery operations run between 10:00 AM and 10:00 PM IST with a maximum delivery distance of 15 KM from the pickup boutique.
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <h3 className="font-bold text-[var(--text-primary)]">Emergency Partner Support</h3>
                <p className="text-[var(--text-secondary)]">
                  Need help with an ongoing delivery or customer issue? Contact Desi Wardrobe Admin Support:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="tel:1800123456"
                    className="min-h-[38px] px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Support (1800-123-456)</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: DELIVER & COMPLETE ORDER */}
      {showCompletionModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                  Confirm Delivery
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCompletionModal(false)}
                className="w-8 h-8 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteDeliverySubmit} className="space-y-4 text-xs">
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Enter the last 4 digits of Customer’s mobile number (+91 ...{activeOrder.customerMobile.slice(-4)}) or Booking ID suffix to verify handover.
              </p>

              <div>
                <label className="block font-bold text-[var(--text-primary)] mb-1">
                  Customer Completion Code (Last 4 Digits)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder={`e.g. ${activeOrder.customerMobile.slice(-4)}`}
                  value={completionCodeInput}
                  onChange={(e) => setCompletionCodeInput(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular tracking-widest text-center text-sm font-bold uppercase"
                />
              </div>

              {activeOrder.remainingAmount ? (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                  <span className="font-bold">Payment reminder:</span> Did you collect ₹{activeOrder.remainingAmount} remaining balance from the customer?
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowCompletionModal(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-[var(--bg-secondary)] font-bold text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCompletion}
                  className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition-colors"
                >
                  {isSubmittingCompletion ? 'Verifying...' : 'Confirm Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REPORT DELIVERY ISSUE */}
      {showFailureModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                  Report Delivery Issue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFailureModal(false)}
                className="w-8 h-8 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportFailureSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-primary)] mb-1">
                  Reason for Non-Delivery *
                </label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
                >
                  <option value="Customer unreachable after multiple attempts">Customer unreachable after multiple attempts</option>
                  <option value="Customer refused to accept order">Customer refused to accept order</option>
                  <option value="Incorrect or unfindable delivery address">Incorrect or unfindable delivery address</option>
                  <option value="Customer requested cancellation at doorstep">Customer requested cancellation at doorstep</option>
                  <option value="Package damaged during transit">Package damaged during transit</option>
                  <option value="Other delivery obstacle">Other delivery obstacle</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--text-primary)] mb-1">
                  Additional Details / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide context for admin review"
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowFailureModal(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-[var(--bg-secondary)] font-bold text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFailure}
                  className="min-h-[42px] px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold transition-colors"
                >
                  {isSubmittingFailure ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT PREVIEW */}
      {viewingDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                {viewingDocTitle}
              </h3>
              <button
                type="button"
                onClick={() => setViewingDocUrl(null)}
                className="w-8 h-8 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-black/40">
              <img
                src={viewingDocUrl}
                alt={viewingDocTitle}
                className="max-w-full max-h-[60vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
