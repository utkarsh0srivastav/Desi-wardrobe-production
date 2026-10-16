import React, { useState, useRef } from 'react';
import {
  Phone,
  Lock,
  Store,
  MapPin,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Navigation,
  Tag,
  Clock,
  RefreshCw,
  HelpCircle,
  Eye,
  EyeOff,
  User,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import {
  INDIAN_STATES,
  PricePolicy,
  SECURITY_QUESTION_OPTIONS,
  Shop,
  ShopCategory,
  Shopkeeper,
} from '../../types/models';
import { authService } from '../../services/authService';
import { shopService } from '../../services/shopService';
import { shopkeeperService } from '../../services/shopkeeperService';
import { imageService } from '../../services/imageService';
import { locationService, LocationServiceError } from '../../services/locationService';
import { LocationMapPickerModal } from '../../components/LocationMapPickerModal';
import { ResilientImage } from '../../components/ResilientImage';

interface ShopkeeperAuthPageProps {
  onSuccess: (shopkeeper: Shopkeeper, shop: Shop) => void;
  onBackToEntry: () => void;
}

type MainMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PIN' | 'PENDING_STATUS';

export const ShopkeeperAuthPage: React.FC<ShopkeeperAuthPageProps> = ({
  onSuccess,
  onBackToEntry,
}) => {
  const [mode, setMode] = useState<MainMode>('LOGIN');

  // Login states
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [showLoginPin, setShowLoginPin] = useState(false);

  // Registration states
  const [regFullName, setRegFullName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regShopName, setRegShopName] = useState('');
  const [regPhoto, setRegPhoto] = useState('');
  const [regCategory, setRegCategory] = useState<ShopCategory>('BOTH');
  const [regPricePolicy, setRegPricePolicy] = useState<PricePolicy>('FIXED_PRICE');
  const [regLatitude, setRegLatitude] = useState<number | null>(null);
  const [regLongitude, setRegLongitude] = useState<number | null>(null);
  const [regLocationName, setRegLocationName] = useState('');
  const [regState, setRegState] = useState('');
  const [regUpiId, setRegUpiId] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);
  const [regSecurityQuestion, setRegSecurityQuestion] = useState<string>(
    SECURITY_QUESTION_OPTIONS[0]
  );
  const [customQuestion, setCustomQuestion] = useState('');
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Map and Location modal states
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);

  // Forgot PIN states
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  // Pending Status display state
  const [pendingShopkeeper, setPendingShopkeeper] = useState<Shopkeeper | null>(null);
  const [pendingShop, setPendingShop] = useState<Shop | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    setErrorMsg(null);
    setIsCompressingPhoto(true);
    try {
      const compressed = await imageService.compressImageFile(file, 'shops');
      setRegPhoto(compressed.optimizedDataUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to compress photo.');
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setLocationErrorMsg(null);
    setErrorMsg(null);
    try {
      const coords = await locationService.getCurrentLocation();
      setRegLatitude(coords.latitude);
      setRegLongitude(coords.longitude);
      const resolved = await locationService.reverseGeocodeLocation(coords.latitude, coords.longitude);
      setRegLocationName(resolved);
      const detected = locationService.extractStateFromLocationText(resolved);
      if (detected) {
        setRegState(detected);
      }
    } catch (err) {
      if (err instanceof LocationServiceError) {
        setLocationErrorMsg(err.shopkeeperMessage);
      } else {
        setLocationErrorMsg('Could not detect GPS location. Please select your location on the map.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const cleanMobile = loginMobile.replace(/\D/g, '');
      const existing = shopkeeperService.getShopkeeperByMobile(cleanMobile);

      if (!existing) {
        throw new Error(
          'No registered Shopkeeper account found with this mobile number. Please register your shop first.'
        );
      }

      if (existing.approvalStatus === 'REJECTED') {
        throw new Error('Your shop registration request was rejected by Desi Wardrobe Admin.');
      }

      if (existing.approvalStatus === 'PENDING') {
        const associatedShop =
          shopService.getShopById(existing.shopId) ||
          shopService.getShopByShopkeeperId(existing.shopkeeperId) ||
          null;
        setPendingShopkeeper(existing);
        setPendingShop(associatedShop);
        setMode('PENDING_STATUS');
        return;
      }

      // Approved account login
      const sk = await authService.loginWithPin(loginMobile, loginPin);
      const shop =
        shopService.getShopById(sk.shopId) ||
        shopService.getShopByShopkeeperId(sk.shopkeeperId);

      if (!shop) {
        throw new Error('Shop profile not found for this account. Please contact Admin.');
      }

      onSuccess(sk, shop);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regPhoto) {
      setErrorMsg('Please take or upload a storefront photo of your shop.');
      return;
    }
    if (regLatitude === null || regLongitude === null || !regLocationName.trim()) {
      setErrorMsg('Please set your shop location using GPS or the map picker.');
      return;
    }
    if (!regUpiId.trim() || !/^[\w.-]+@[\w.-]+$/.test(regUpiId.trim())) {
      setErrorMsg('Please enter a valid Shopkeeper UPI ID (e.g., yourname@bank or 9876543210@paytm).');
      return;
    }
    if (regPin.trim().length !== 4) {
      setErrorMsg('PIN must be exactly 4 digits.');
      return;
    }
    if (regPin.trim() !== regConfirmPin.trim()) {
      setErrorMsg('PIN and Confirm PIN do not match.');
      return;
    }

    const effectiveQuestion = isCustomQuestion
      ? customQuestion.trim()
      : regSecurityQuestion.trim();
    if (!effectiveQuestion) {
      setErrorMsg('Please specify a security question for PIN recovery.');
      return;
    }
    if (!regSecurityAnswer.trim()) {
      setErrorMsg('Please enter an answer for your security question.');
      return;
    }

    setIsLoading(true);
    try {
      const { shopkeeper, shop } = await shopkeeperService.registerShopkeeperDirect({
        fullName: regFullName,
        mobile: regMobile,
        shopName: regShopName,
        photo: regPhoto,
        category: regCategory,
        pricePolicy: regPricePolicy as 'FIXED_PRICE' | 'BARGAINING_AVAILABLE',
        latitude: regLatitude,
        longitude: regLongitude,
        locationName: regLocationName,
        state: regState || locationService.extractStateFromLocationText(regLocationName),
        upiId: regUpiId,
        pin: regPin,
        confirmPin: regConfirmPin,
        securityQuestion: effectiveQuestion,
        securityAnswer: regSecurityAnswer,
      });

      setPendingShopkeeper(shopkeeper);
      setPendingShop(shop);
      setMode('PENDING_STATUS');
      setSuccessMsg(
        `Shopkeeper registration submitted successfully! Your account ID is ${shopkeeper.shopkeeperId}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanMobile = forgotMobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    const sk = shopkeeperService.getShopkeeperByMobile(cleanMobile);
    if (!sk) {
      setErrorMsg('No registered Shopkeeper account found with this mobile number.');
      return;
    }
    if (!sk.securityQuestion || !sk.securityAnswerHash) {
      setErrorMsg(
        'No security question was configured for this account. Please contact Desi Wardrobe Admin for assistance.'
      );
      return;
    }
    setForgotQuestion(sk.securityQuestion);
    setForgotStep(2);
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await shopkeeperService.resetShopkeeperPinWithSecurityAnswer({
        mobile: forgotMobile,
        securityAnswer: forgotAnswer,
        newPin: forgotNewPin,
        confirmPin: forgotConfirmPin,
      });
      setSuccessMsg('Your 4-digit PIN has been reset successfully! You can now log in.');
      setLoginMobile(forgotMobile);
      setLoginPin('');
      setForgotStep(1);
      setForgotAnswer('');
      setForgotNewPin('');
      setForgotConfirmPin('');
      setMode('LOGIN');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'PIN reset failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshPendingStatus = () => {
    if (!pendingShopkeeper) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const refreshed = shopkeeperService.getShopkeeperById(pendingShopkeeper.shopkeeperId);
      if (refreshed) {
        setPendingShopkeeper(refreshed);
        const refShop =
          shopService.getShopById(refreshed.shopId) ||
          shopService.getShopByShopkeeperId(refreshed.shopkeeperId);
        setPendingShop(refShop || null);

        if (refreshed.approvalStatus === 'APPROVED' && refShop) {
          onSuccess(refreshed, refShop);
          return;
        }
        if (refreshed.approvalStatus === 'REJECTED') {
          setErrorMsg('Your registration was rejected by Desi Wardrobe Admin.');
        } else {
          setSuccessMsg('Status refreshed. Your account is still pending Admin approval.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-20 space-y-5">
      {/* Top back navigation */}
      <button
        type="button"
        onClick={onBackToEntry}
        className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header Badge & Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="inline-block px-3 py-1 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-bold tracking-wide uppercase">
              DESI WARDROBE · SHOPKEEPER MODULE
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            {mode === 'LOGIN' && 'Shopkeeper Login'}
            {mode === 'REGISTER' && 'Register Your Shop'}
            {mode === 'FORGOT_PIN' && 'Reset Your 4-Digit PIN'}
            {mode === 'PENDING_STATUS' && 'Registration Under Review'}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            {mode === 'LOGIN' && 'Enter your registered mobile number and 4-digit PIN to access your dashboard.'}
            {mode === 'REGISTER' &&
              'Register your local clothing store. New registrations remain Pending until Admin approval.'}
            {mode === 'FORGOT_PIN' &&
              'Recover access to your shopkeeper account using your registered security question.'}
            {mode === 'PENDING_STATUS' &&
              'Your registration has been submitted and is awaiting approval by Desi Wardrobe Admin.'}
          </p>
        </div>

        {/* Mode Selector Tabs (only when in LOGIN or REGISTER) */}
        {(mode === 'LOGIN' || mode === 'REGISTER') && (
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setMode('LOGIN');
              }}
              className={`min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                mode === 'LOGIN'
                  ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>LOG IN WITH PIN</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setMode('REGISTER');
              }}
              className={`min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                mode === 'REGISTER'
                  ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>REGISTER SHOP</span>
            </button>
          </div>
        )}

        {/* Global Notifications / Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs font-medium text-[var(--status-danger)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-2.5 text-xs font-medium text-[var(--status-success)]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* -------------------- VIEW 1: LOGIN -------------------- */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Registered Mobile Number <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  4-Digit Security PIN <span className="text-[var(--accent-primary)]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setForgotMobile(loginMobile);
                    setForgotStep(1);
                    setMode('FORGOT_PIN');
                  }}
                  className="text-xs text-[var(--accent-primary)] font-semibold hover:underline"
                >
                  Forgot PIN?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter 4-digit PIN"
                  className="w-full min-h-[48px] pl-10 pr-11 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPin((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showLoginPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || loginMobile.length !== 10 || loginPin.length !== 4}
              className="w-full min-h-[50px] px-5 py-3 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>VERIFYING...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>LOG IN TO DASHBOARD</span>
                </>
              )}
            </button>

            <div className="pt-3 text-center border-t border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)]">Don’t have an approved shop yet? </span>
              <button
                type="button"
                onClick={() => setMode('REGISTER')}
                className="text-xs font-bold text-[var(--accent-primary)] hover:underline"
              >
                Register Shop Now
              </button>
            </div>
          </form>
        )}

        {/* -------------------- VIEW 2: FULL REGISTRATION -------------------- */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            {/* 1. Shopkeeper Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Shopkeeper Full Name <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra Sharma"
                  className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>

            {/* 2. Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Mobile Number <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit Indian mobile number"
                  className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>

            {/* 3. Shop Name */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Shop Name <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={regShopName}
                  onChange={(e) => setRegShopName(e.target.value)}
                  placeholder="e.g. Sharma Saree Kendra & Men's Wear"
                  className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>

            {/* 4. Storefront Photo */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Shop Storefront Photo <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handlePhotoUpload(e.target.files?.[0] || null)}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files?.[0] || null)}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-32 h-24 rounded-2xl overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center">
                  {regPhoto ? (
                    <ResilientImage src={regPhoto} alt="Shop Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isCompressingPhoto}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-semibold flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isCompressingPhoto}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Choose from Gallery</span>
                  </button>
                </div>
              </div>
              {isCompressingPhoto && (
                <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Optimizing photo to ~300-400 KB...</span>
                </div>
              )}
            </div>

            {/* 5. Shop Category */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Shop Category <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "Men's Wear", val: 'MEN' as ShopCategory },
                  { id: "Women's Wear", val: 'WOMEN' as ShopCategory },
                  { id: "Kids' Wear", val: 'Kids' as ShopCategory },
                  { id: 'Men & Women', val: 'BOTH' as ShopCategory },
                  { id: 'All Fashion', val: 'All' as ShopCategory },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRegCategory(item.val)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      regCategory === item.val
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white shadow-xs'
                        : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {item.id}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Price Policy */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Price Policy <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRegPricePolicy('FIXED_PRICE')}
                  className={`min-h-[48px] px-3.5 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                    regPricePolicy === 'FIXED_PRICE'
                      ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>Fixed Price</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRegPricePolicy('BARGAINING_AVAILABLE')}
                  className={`min-h-[48px] px-3.5 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                    regPricePolicy === 'BARGAINING_AVAILABLE'
                      ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>Bargaining Available</span>
                </button>
              </div>
            </div>

            {/* 7. Shop Location & Coordinates */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Shop Address & GPS Location <span className="text-[var(--accent-primary)]">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:border-[var(--accent-primary)] transition-colors"
                >
                  <Navigation className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>{isLocating ? 'Detecting GPS...' : 'Use My Current Location'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocationErrorMsg(null);
                    setIsMapOpen(true);
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[var(--accent-primary)] hover:text-white transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Select on Map</span>
                </button>
              </div>

              {locationErrorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-[var(--status-danger)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{locationErrorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Shop Address / Location Name
                </label>
                <input
                  type="text"
                  required
                  value={regLocationName}
                  onChange={(e) => {
                    setRegLocationName(e.target.value);
                    const detected = locationService.extractStateFromLocationText(e.target.value);
                    if (detected && !regState) {
                      setRegState(detected);
                    }
                  }}
                  placeholder="e.g. Main Market, Barhalganj, Gorakhpur"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    State (India)
                  </label>
                  <select
                    value={regState}
                    onChange={(e) => setRegState(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Coordinates
                  </label>
                  <div className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs font-mono-tabular flex items-center text-[var(--text-secondary)]">
                    {regLatitude !== null && regLongitude !== null ? (
                      <span className="text-[var(--text-primary)] font-semibold">
                        {regLatitude.toFixed(4)}, {regLongitude.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">Not set (Click GPS or Map)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 8. Shopkeeper UPI ID */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Shopkeeper UPI ID <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={regUpiId}
                  onChange={(e) => setRegUpiId(e.target.value.trim())}
                  placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                  className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)]"
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Customers and delivery partners will use this UPI ID to pay you the remaining balance upon product handover.
              </p>
            </div>

            {/* 9. 4-Digit Security PIN */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Create 4-Digit PIN <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    4-Digit PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="e.g. 1234"
                      className="w-full min-h-[46px] pl-10 pr-10 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm tracking-widest text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPin((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                    >
                      {showRegPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Confirm 4-Digit PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={regConfirmPin}
                      onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Repeat PIN"
                      className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm tracking-widest text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 10. Security Question & Answer for PIN Recovery */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[var(--accent-primary)]" />
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Security Question for PIN Recovery <span className="text-[var(--accent-primary)]">*</span>
                </label>
              </div>

              <div>
                <select
                  value={isCustomQuestion ? '__CUSTOM__' : regSecurityQuestion}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomQuestion(true);
                    } else {
                      setIsCustomQuestion(false);
                      setRegSecurityQuestion(e.target.value);
                    }
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                >
                  {SECURITY_QUESTION_OPTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Write My Own Security Question</option>
                </select>
              </div>

              {isCustomQuestion && (
                <div>
                  <input
                    type="text"
                    required
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="Enter your custom security question"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Security Answer
                </label>
                <input
                  type="text"
                  required
                  value={regSecurityAnswer}
                  onChange={(e) => setRegSecurityAnswer(e.target.value)}
                  placeholder="Your answer (will be hashed securely)"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            {/* Submission Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[50px] px-5 py-3 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>SUBMITTING REGISTRATION...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>REGISTER SHOP FOR ADMIN APPROVAL</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* -------------------- VIEW 3: FORGOT PIN / RESET PIN -------------------- */}
        {mode === 'FORGOT_PIN' && (
          <div className="space-y-4">
            {forgotStep === 1 ? (
              <form onSubmit={handleForgotLookup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                    Enter Your Registered Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      value={forgotMobile}
                      onChange={(e) => setForgotMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile number"
                      className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode('LOGIN')}
                    className="min-h-[48px] px-5 py-2.5 rounded-2xl border border-[var(--border-subtle)] text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[48px] px-5 py-2.5 rounded-2xl bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider"
                  >
                    CONTINUE
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotReset} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-1 text-xs">
                  <div className="text-[var(--text-muted)]">Security Question:</div>
                  <div className="font-bold text-[var(--text-primary)]">{forgotQuestion}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                    Your Security Answer
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotAnswer}
                    onChange={(e) => setForgotAnswer(e.target.value)}
                    placeholder="Enter answer provided at registration"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      New 4-Digit PIN
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={forgotNewPin}
                      onChange={(e) => setForgotNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="e.g. 5678"
                      className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm tracking-widest text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Confirm New PIN
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={forgotConfirmPin}
                      onChange={(e) => setForgotConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Repeat new PIN"
                      className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm tracking-widest text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="min-h-[48px] px-4 py-2.5 rounded-2xl border border-[var(--border-subtle)] text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 min-h-[48px] px-5 py-2.5 rounded-2xl bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider"
                  >
                    {isLoading ? 'RESETTING PIN...' : 'SAVE NEW PIN & LOGIN'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* -------------------- VIEW 4: PENDING APPROVAL STATUS -------------------- */}
        {mode === 'PENDING_STATUS' && pendingShopkeeper && (
          <div className="space-y-5">
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--status-warning)]">
                <Clock className="w-5 h-5 shrink-0" />
                <span>Account Awaiting Admin Approval</span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Thank you for registering on <strong>DESI WARDROBE</strong>. Your shop registration has been securely saved and is currently under review by the Desi Wardrobe Admin.
              </p>
              <div className="p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-1.5 font-mono-tabular">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Permanent Account ID:</span>
                  <span className="font-bold text-[var(--accent-primary)]">{pendingShopkeeper.shopkeeperId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Shopkeeper Name:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{pendingShopkeeper.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Mobile Number:</span>
                  <span className="text-[var(--text-primary)]">+91 {pendingShopkeeper.mobile}</span>
                </div>
                {pendingShop && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Shop Name:</span>
                    <span className="text-[var(--text-primary)]">{pendingShop.shopName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Status:</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-[var(--status-warning)] font-bold">
                    PENDING ADMIN APPROVAL
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Only approved, active Shopkeepers can sell products or process orders. Once the Admin approves your shop, tap <strong>CHECK APPROVAL STATUS</strong> below or log in with your 4-digit PIN.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleRefreshPendingStatus}
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>CHECK APPROVAL STATUS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setMode('LOGIN');
                }}
                className="min-h-[48px] px-5 py-2.5 rounded-2xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5"
              >
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Picker Modal */}
      {isMapOpen && (
        <LocationMapPickerModal
          initialLat={regLatitude ?? 26.8467}
          initialLng={regLongitude ?? 80.9462}
          initialLocationName={regLocationName}
          autoLocateOnOpen={false}
          onConfirmLocation={(loc) => {
            setRegLatitude(loc.latitude);
            setRegLongitude(loc.longitude);
            setRegLocationName(loc.locationName);
            const detected = locationService.extractStateFromLocationText(loc.locationName);
            if (detected) {
              setRegState(detected);
            }
            setLocationErrorMsg(null);
            setIsMapOpen(false);
          }}
          onClose={() => setIsMapOpen(false)}
        />
      )}
    </div>
  );
};
