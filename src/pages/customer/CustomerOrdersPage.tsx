import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Clock,
  Store,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Hourglass,
  ShoppingBag,
  Lock,
  UserCheck,
  Truck,
} from 'lucide-react';
import { Booking, Customer, ForcefulCancellationRequest } from '../../types/models';
import { bookingService } from '../../services/bookingService';
import { shopService } from '../../services/shopService';
import { locationService } from '../../services/locationService';
import { deliveryService } from '../../services/deliveryService';
import { ResilientImage } from '../../components/ResilientImage';

interface CustomerOrdersPageProps {
  loggedInCustomer: Customer | null;
  onRequestCustomerLogin: () => void;
  onRetryPayment?: (booking: Booking) => void;
  onBackToShops: () => void;
}

export const CustomerOrdersPage: React.FC<CustomerOrdersPageProps> = ({
  loggedInCustomer,
  onRequestCustomerLogin,
  onRetryPayment,
  onBackToShops,
}) => {
  const [orders, setOrders] = useState<Booking[]>([]);
  const [orderModeFilter, setOrderModeFilter] = useState<'ALL' | 'TAKEAWAY' | 'DELIVERY'>('ALL');
  const [cancellations, setCancellations] = useState<ForcefulCancellationRequest[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Emergency / Change of plans');
  const [cancelCustomNotes, setCancelCustomNotes] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authenticatedCustomerId = loggedInCustomer?.customerId || null;

  const refreshCancellations = () => {
    setCancellations(deliveryService.getForcefulCancellations());
  };

  useEffect(() => {
    refreshCancellations();
  }, []);

  useEffect(() => {
    // Strictly clear and block order loading when Customer is not logged in
    if (!authenticatedCustomerId) {
      setOrders([]);
      return;
    }

    // Initialize with cached orders strictly belonging to this authenticated customerId
    setOrders(
      bookingService
        .getBookingsByCustomer(authenticatedCustomerId)
        .filter((b) => b.customerId === authenticatedCustomerId)
    );

    // Real-time Firestore subscription scoped strictly to customerId
    const unsubscribe = bookingService.subscribeToCustomerBookings(
      authenticatedCustomerId,
      (customerBookings) => {
        setOrders(customerBookings.filter((b) => b.customerId === authenticatedCustomerId));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authenticatedCustomerId]);

  const handleOpenDirections = async (order: Booking) => {
    const shop = shopService.getCustomerPublicShopById(order.shopId);
    if (!shop) return;

    let originCoords = null;
    try {
      originCoords = await locationService.getCurrentLocation();
    } catch {
      originCoords = null;
    }

    const url = locationService.getGoogleMapsDirectionsUrl(
      shop.latitude,
      shop.longitude,
      originCoords
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderStatusBadge = (order: Booking) => {
    const currentStatus = order.bookingStatus || order.status;

    // 1. Completed / Sold at shop
    if (currentStatus === 'SOLD') {
      return (
        <span className="px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5" />
          PRODUCT PURCHASED • ORDER COMPLETED
        </span>
      );
    }

    // 2. Marked Not Sold by Shopkeeper
    if (currentStatus === 'NOT_SOLD') {
      return (
        <span className="px-3 py-1 rounded-xl bg-red-500/15 text-[var(--status-danger)] text-xs font-bold uppercase flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          ORDER NOT COMPLETED
        </span>
      );
    }

    // 3. Expired after 48-hour reservation window
    if (currentStatus === 'EXPIRED') {
      return (
        <span className="px-3 py-1 rounded-xl bg-stone-500/15 text-[var(--text-muted)] text-xs font-bold uppercase flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          BOOKING EXPIRED
        </span>
      );
    }

    // 4. Rejected payment / Cancelled booking
    if (
      order.paymentStatus === 'REJECTED' ||
      currentStatus === 'PAYMENT_REJECTED' ||
      currentStatus === 'CANCELLED'
    ) {
      return (
        <span className="px-3 py-1 rounded-xl bg-red-500/15 text-[var(--status-danger)] text-xs font-bold uppercase flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          PAYMENT REJECTED • BOOKING CANCELLED
        </span>
      );
    }

    // 5. Pending Admin Payment Verification
    if (
      order.paymentStatus === 'PENDING_VERIFICATION' ||
      currentStatus === 'PAYMENT_PENDING'
    ) {
      return (
        <span className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase flex items-center gap-1.5">
          <Hourglass className="w-3.5 h-3.5" />
          PAYMENT UNDER VERIFICATION
        </span>
      );
    }

    // 6. Approved & Active Confirmed Booking
    return (
      <span className="px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        PAYMENT APPROVED • BOOKING CONFIRMED
      </span>
    );
  };

  // STRICT AUTHENTICATION GATE: Never display or load any orders when Customer is not logged in
  if (!loggedInCustomer || !authenticatedCustomerId) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-5 pb-20 space-y-6">
        <button
          type="button"
          onClick={onBackToShops}
          className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>BACK TO SHOPS</span>
        </button>

        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-10 sm:p-12 text-center space-y-5 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
              Please login to view your orders.
            </h1>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Sign in with your registered mobile number and 4-digit PIN to securely access your personal bookings and order history.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onRequestCustomerLogin}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>LOGIN / REGISTER</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const scopedOrders = orders.filter((o) => o.customerId === authenticatedCustomerId);
  const takeawayCount = scopedOrders.filter((o) => (o.deliveryMode || 'TAKEAWAY') === 'TAKEAWAY').length;
  const deliveryCount = scopedOrders.filter((o) => o.deliveryMode === 'DELIVERY').length;

  const displayedOrders = scopedOrders.filter((o) => {
    if (orderModeFilter === 'TAKEAWAY') return (o.deliveryMode || 'TAKEAWAY') === 'TAKEAWAY';
    if (orderModeFilter === 'DELIVERY') return o.deliveryMode === 'DELIVERY';
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-20 space-y-6">
      <button
        type="button"
        onClick={onBackToShops}
        className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4 text-[var(--accent-primary)]" />
        <span>BACK TO SHOPS</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            My Bookings &amp; Orders
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Track your payment verification status, 48-hour shop pickup window, and completed purchases
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] self-start sm:self-auto">
          <UserCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="font-semibold text-[var(--text-primary)]">{loggedInCustomer.name}</span>
        </div>
      </div>

      {/* Takeaway vs Delivery Order History Separation Tabs (Section 14 & 15) */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setOrderModeFilter('ALL')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            orderModeFilter === 'ALL'
              ? 'bg-[var(--accent-primary)] text-white shadow-xs'
              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
          }`}
        >
          All Orders ({scopedOrders.length})
        </button>

        <button
          type="button"
          onClick={() => setOrderModeFilter('TAKEAWAY')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            orderModeFilter === 'TAKEAWAY'
              ? 'bg-[var(--accent-primary)] text-white shadow-xs'
              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Takeaway ({takeawayCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setOrderModeFilter('DELIVERY')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            orderModeFilter === 'DELIVERY'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Home Delivery ({deliveryCount})</span>
        </button>
      </div>

      {/* Scoped Orders List for Authenticated Customer */}
      {displayedOrders.length === 0 ? (
        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
            <ClipboardList className="w-7 h-7" />
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            No {orderModeFilter === 'TAKEAWAY' ? 'Takeaway ' : orderModeFilter === 'DELIVERY' ? 'Delivery ' : ''}Orders Found
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            {scopedOrders.length === 0
              ? 'You have not placed any product bookings yet.'
              : `You have no ${orderModeFilter.toLowerCase()} orders.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedOrders.map((order) => {
            const isDelivery = order.deliveryMode === 'DELIVERY';
            const currentStatus = order.bookingStatus || order.status;
            const isRejected =
              order.paymentStatus === 'REJECTED' ||
              currentStatus === 'PAYMENT_REJECTED' ||
              currentStatus === 'CANCELLED';
            const isSold = currentStatus === 'SOLD';
            const isNotSold = currentStatus === 'NOT_SOLD';
            const isExpired = currentStatus === 'EXPIRED';
            const isPendingVerification =
              !isRejected &&
              !isSold &&
              !isNotSold &&
              !isExpired &&
              (order.paymentStatus === 'PENDING_VERIFICATION' ||
                currentStatus === 'PAYMENT_PENDING');
            const isConfirmedActive =
              !isRejected &&
              !isSold &&
              !isNotSold &&
              !isExpired &&
              !isPendingVerification;

            const hasFinalBookingId = /^DW-\d{8}-[A-Z0-9]{6}$/.test(order.bookingId);

            return (
              <div
                key={order.bookingId}
                className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    {(isConfirmedActive || isSold) && hasFinalBookingId ? (
                      <span className="font-mono-tabular text-xs font-bold px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                        Booking ID: {order.bookingId}
                      </span>
                    ) : isRejected ? (
                      <span className="font-mono-tabular text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-[var(--status-danger)]">
                        BOOKING CANCELLED
                      </span>
                    ) : isNotSold ? (
                      <span className="font-mono-tabular text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-[var(--status-danger)]">
                        NOT COMPLETED
                      </span>
                    ) : isExpired ? (
                      <span className="font-mono-tabular text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-500/10 border border-stone-500/30 text-[var(--text-muted)]">
                        BOOKING EXPIRED
                      </span>
                    ) : (
                      <span className="font-mono-tabular text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                        BOOKING PENDING CONFIRMATION
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {renderStatusBadge(order)}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-20 h-24 rounded-2xl overflow-hidden shrink-0 bg-[var(--bg-secondary)]">
                    <ResilientImage
                      src={order.productImage}
                      alt={order.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5 text-xs">
                    <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      {order.productName}
                    </h3>
                    <div className="font-mono-tabular text-base font-bold text-[var(--accent-primary)]">
                      ₹{order.price.toLocaleString('en-IN')}{' '}
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        (Qty: {order.quantity} • Size: {order.size} • Color: {order.color})
                      </span>
                    </div>

                    {order.paymentAmount && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] font-mono-tabular text-[11px] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Advance Booking Paid: ₹{order.paymentAmount}</span>
                      </div>
                    )}

                    {/* Strictly NO Shopkeeper mobile number displayed here */}
                    <div className="pt-1 space-y-1 text-[var(--text-secondary)]">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span className="font-semibold text-[var(--text-primary)]">
                          {order.shopName}
                        </span>
                      </div>
                      {order.shopLocationName && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          <span>{order.shopLocationName}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDirections(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--accent-primary)] text-[11px] font-bold uppercase tracking-wider transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>GET DIRECTIONS</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Specific Footer */}
                {isSold && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Product Purchased at Shop — Order Completed
                        {hasFinalBookingId ? ` (Booking ID: ${order.bookingId})` : ''}
                      </span>
                    </div>
                  </div>
                )}

                {isNotSold && (
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-[var(--status-danger)] font-semibold">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>
                      This booking was marked as not completed at the shop. Reserved stock has been restored.
                    </span>
                  </div>
                )}

                {isExpired && (
                  <div className="p-3 rounded-2xl bg-stone-500/10 border border-stone-500/30 flex items-center gap-2 text-xs text-[var(--text-muted)] font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>The 48-hour reservation window has expired.</span>
                  </div>
                )}

                {isConfirmedActive && (
                  <div className="space-y-2">
                    {isDelivery ? (
                      <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
                          <Truck className="w-4 h-4 shrink-0" />
                          <span>
                            Home Delivery Order Confirmed
                            {hasFinalBookingId ? ` · Booking ID: ${order.bookingId}` : ''}
                          </span>
                        </div>
                        {order.confirmedAt && (
                          <div className="text-[11px] font-mono-tabular text-blue-700/80 dark:text-blue-300/80">
                            Confirmed:{' '}
                            {new Date(order.confirmedAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>
                            Pickup Deadline (48h):{' '}
                            {new Date(order.pickupDeadline).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {hasFinalBookingId ? ` · Booking ID: ${order.bookingId}` : ''}
                          </span>
                        </div>
                        {order.confirmedAt && (
                          <div className="text-[11px] font-mono-tabular text-emerald-700/80 dark:text-emerald-300/80">
                            Confirmed:{' '}
                            {new Date(order.confirmedAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delivery Partner status — strictly for Delivery orders, never takeaway */}
                    {isDelivery && order.assignedPartnerName && (
                      <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold">
                          <UserCheck className="w-4 h-4 shrink-0" />
                          <span>
                            Delivery Partner Assigned: <strong>{order.assignedPartnerName}</strong> ({order.assignedPartnerId || 'DP'})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">
                          Out For Delivery
                        </span>
                      </div>
                    )}

                    {isDelivery && !order.assignedPartnerName && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
                          <Hourglass className="w-4 h-4 shrink-0" />
                          <span>
                            Delivery Partner: Waiting for delivery assignment
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">
                          Pending Assignment
                        </span>
                      </div>
                    )}

                    {(() => {
                      const pendingCancel = cancellations.find(
                        (c) =>
                          (c.orderId === order.bookingId ||
                            c.bookingReference === order.bookingReference) &&
                          c.status === 'PENDING'
                      );
                      const rejectedCancel = cancellations.find(
                        (c) =>
                          (c.orderId === order.bookingId ||
                            c.bookingReference === order.bookingReference) &&
                          c.status === 'REJECTED'
                      );

                      if (pendingCancel) {
                        return (
                          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200 font-medium">
                            <Hourglass className="w-4 h-4 shrink-0" />
                            <span>
                              Cancellation Request: <strong>UNDER ADMIN REVIEW</strong> ({pendingCancel.reason})
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {rejectedCancel && (
                            <span className="text-[11px] text-[var(--status-danger)] font-semibold">
                              Cancellation request declined: {rejectedCancel.adminNotes || 'Contact store for details'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCancellingOrder(order)}
                            className="min-h-[32px] px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-[var(--status-danger)] text-[11px] font-bold tracking-wide transition-colors ml-auto"
                          >
                            REQUEST CANCELLATION
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {isPendingVerification && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
                    <Hourglass className="w-4 h-4 shrink-0" />
                    <span>
                      Your payment screenshot is under verification by Admin. Your confirmed Booking ID will appear once verified.
                    </span>
                  </div>
                )}

                {isRejected && (
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--status-danger)] font-semibold">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Payment verification was rejected by Admin. This booking has been cancelled.
                      </span>
                    </div>
                    {onRetryPayment && (
                      <button
                        type="button"
                        onClick={() => onRetryPayment(order)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-bold uppercase tracking-wider shrink-0 transition-colors"
                      >
                        Retry Payment
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Forceful Cancellation Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Request Order Cancellation
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCancellingOrder(null);
                  setCancelCustomNotes('');
                }}
                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)]"
              >
                <XCircle className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Order: <strong className="font-mono-tabular text-[var(--text-primary)]">{cancellingOrder.bookingId}</strong> ({cancellingOrder.productName})
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Reason for Cancellation:
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              >
                <option value="Emergency / Change of plans">Emergency / Change of plans</option>
                <option value="Delay in delivery">Delay in delivery</option>
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="Found alternative product">Found alternative product</option>
                <option value="Other">Other reason</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Additional Notes (optional):
              </label>
              <textarea
                rows={3}
                value={cancelCustomNotes}
                onChange={(e) => setCancelCustomNotes(e.target.value)}
                placeholder="Provide details to assist Admin approval..."
                className="w-full p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingOrder(null);
                  setCancelCustomNotes('');
                }}
                className="min-h-[38px] px-4 py-2 rounded-xl bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-primary)]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={async () => {
                  if (!cancellingOrder) return;
                  setCancelSubmitting(true);
                  try {
                    deliveryService.submitForcefulCancellation({
                      orderId: cancellingOrder.bookingId,
                      bookingReference:
                        cancellingOrder.bookingReference || cancellingOrder.bookingId,
                      shopId: cancellingOrder.shopId,
                      shopName: cancellingOrder.shopName,
                      partnerId: cancellingOrder.assignedPartnerId,
                      partnerName: cancellingOrder.assignedPartnerName,
                      reason: cancelReason,
                      customReason: cancelCustomNotes.trim() || undefined,
                    });
                    refreshCancellations();
                    setToastMsg('Cancellation request submitted to Admin.');
                    setTimeout(() => setToastMsg(null), 4000);
                    setCancellingOrder(null);
                    setCancelCustomNotes('');
                  } catch (err) {
                    setErrorMsg(
                      err instanceof Error
                        ? err.message
                        : 'Failed to submit cancellation request.'
                    );
                    setTimeout(() => setErrorMsg(null), 4000);
                  } finally {
                    setCancelSubmitting(false);
                  }
                }}
                className="min-h-[38px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                {cancelSubmitting ? 'Submitting...' : 'Submit Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-4 py-3 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
