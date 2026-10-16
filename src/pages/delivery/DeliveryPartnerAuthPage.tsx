import React, { useState } from 'react';
import {
  Truck,
  LogIn,
  UserPlus,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Camera,
  FileText,
  UploadCloud,
  ChevronRight,
  Eye,
  EyeOff,
  Phone,
  User,
  MapPin,
  Navigation,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { CameraCaptureModal } from '../../components/CameraCaptureModal';
import {
  deliveryService,
} from '../../services/deliveryService';
import {
  DeliveryPartner,
  VehicleType,
} from '../../types/models';

interface DeliveryPartnerAuthPageProps {
  onSuccess: (partner: DeliveryPartner) => void;
  onBackToHome: () => void;
  initialMode?: 'LOGIN' | 'REGISTER' | 'FORGOT_PIN';
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PIN' | 'PENDING_STATUS';

const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is your mother’s maiden name?',
  'What was the model of your first vehicle?',
  'What is the name of your childhood hometown?',
  'What is your favorite festival or holiday?',
];

export const DeliveryPartnerAuthPage: React.FC<DeliveryPartnerAuthPageProps> = ({
  onSuccess,
  onBackToHome,
  initialMode = 'LOGIN',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Common UI State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Login Form State
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPin, setLoginPin] = useState('');

  // Pending State Holder
  const [pendingPartner, setPendingPartner] = useState<DeliveryPartner | null>(null);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regServiceArea, setRegServiceArea] = useState('');
  const [regVehicleType, setRegVehicleType] = useState<VehicleType>('BIKE');
  const [regVehicleNumber, setRegVehicleNumber] = useState('');
  const [regUpiId, setRegUpiId] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [regSecurityQuestion, setRegSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('');

  // Files & Camera State
  const [regProfilePhoto, setRegProfilePhoto] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [regAadhaarFront, setRegAadhaarFront] = useState<string | null>(null);
  const [regAadhaarBack, setRegAadhaarBack] = useState<string | null>(null);
  const [regDlFront, setRegDlFront] = useState<string | null>(null);
  const [regDlBack, setRegDlBack] = useState<string | null>(null);
  const [regTermsAgreed, setRegTermsAgreed] = useState(false);

  // Forgot PIN Form State
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState<string | null>(null);
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  // File to Base64 helper
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Document size exceeds 5 MB. Please select a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setter(dataUrl);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const partner = await deliveryService.loginDeliveryPartnerWithPin(loginMobile, loginPin);

      // Check approval status
      if (partner.approvalStatus === 'PENDING') {
        setPendingPartner(partner);
        setMode('PENDING_STATUS');
        return;
      }

      if (partner.approvalStatus === 'APPROVED') {
        onSuccess(partner);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!regName.trim() || regName.trim().length < 2) {
      setErrorMsg('Please enter your full legal name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(regMobile.replace(/\D/g, ''))) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!regAddress.trim() || regAddress.trim().length < 5) {
      setErrorMsg('Please enter your full residential address.');
      return;
    }
    if (!regServiceArea.trim()) {
      setErrorMsg('Please specify your operational service area / city.');
      return;
    }
    if (!regVehicleNumber.trim()) {
      setErrorMsg('Please enter your vehicle registration number.');
      return;
    }
    if (!regUpiId.trim() || !regUpiId.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID for delivery fee payouts.');
      return;
    }
    if (!/^\d{4}$/.test(regPin.trim())) {
      setErrorMsg('PIN must be exactly 4 digits.');
      return;
    }
    if (regPin !== regConfirmPin) {
      setErrorMsg('PIN and Confirm PIN do not match.');
      return;
    }
    if (!regSecurityAnswer.trim()) {
      setErrorMsg('Please enter an answer for your security question.');
      return;
    }
    if (!regProfilePhoto) {
      setErrorMsg('Please capture your profile photo using the camera.');
      return;
    }
    if (!regAadhaarFront || !regAadhaarBack) {
      setErrorMsg('Please upload both front and back of your Aadhaar card.');
      return;
    }
    if (!regDlFront || !regDlBack) {
      setErrorMsg('Please upload both front and back of your Driving Licence.');
      return;
    }
    if (!regTermsAgreed) {
      setErrorMsg('Please accept the Desi Wardrobe delivery partner guidelines.');
      return;
    }

    setIsLoading(true);
    try {
      const created = await deliveryService.registerDeliveryPartnerDirect({
        name: regName.trim(),
        contactNumber: regMobile.replace(/\D/g, ''),
        email: regEmail.trim() || undefined,
        residentialAddress: regAddress.trim(),
        serviceArea: regServiceArea.trim(),
        vehicleType: regVehicleType,
        vehicleNumber: regVehicleNumber.trim().toUpperCase(),
        upiId: regUpiId.trim(),
        pin: regPin.trim(),
        confirmPin: regConfirmPin.trim(),
        securityQuestion: regSecurityQuestion,
        securityAnswer: regSecurityAnswer.trim(),
        profilePhotoFileOrDataUrl: regProfilePhoto,
        aadhaarFrontFileOrDataUrl: regAadhaarFront,
        aadhaarBackFileOrDataUrl: regAadhaarBack,
        drivingLicenceFrontFileOrDataUrl: regDlFront,
        drivingLicenceBackFileOrDataUrl: regDlBack,
      });

      setPendingPartner(created);
      setMode('PENDING_STATUS');
      setSuccessMsg(`Registration successful! Your Permanent ID is ${created.partnerId}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot PIN - Step 1: Fetch Question
  const handleFetchSecurityQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const clean = forgotMobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    const partner = deliveryService.getPartnerByMobile(clean);
    if (!partner) {
      setErrorMsg('No registered Delivery Partner account found with this mobile number.');
      return;
    }

    if (!partner.securityQuestion || !partner.securityAnswerHash) {
      setErrorMsg('No security question is configured for this account. Please contact Desi Wardrobe Admin.');
      return;
    }

    setForgotQuestion(partner.securityQuestion);
    setForgotStep(2);
  };

  // Handle Forgot PIN - Step 2: Reset PIN
  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await deliveryService.resetDeliveryPartnerPinWithSecurityAnswer({
        mobile: forgotMobile,
        securityAnswer: forgotAnswer,
        newPin: forgotNewPin,
        confirmPin: forgotConfirmPin,
      });

      setSuccessMsg('PIN successfully reset! You can now log in with your new PIN.');
      setMode('LOGIN');
      setLoginMobile(forgotMobile);
      setForgotStep(1);
      setForgotAnswer('');
      setForgotNewPin('');
      setForgotConfirmPin('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reset PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-16 min-h-[calc(100vh-8rem)] flex flex-col justify-between">
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors py-1.5 px-2 rounded-xl hover:bg-[var(--bg-secondary)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <span className="text-[11px] font-mono-tabular font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
            DELIVERY PARTNER
          </span>
        </div>

        {/* Brand Card Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BrandLogo size="md" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              DESI WARDROBE
            </h1>
            <p className="text-xs font-bold text-blue-600 flex items-center justify-center gap-1.5 mt-0.5">
              <Truck className="w-3.5 h-3.5" />
              <span>Delivery Partner Portal</span>
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {mode !== 'PENDING_STATUS' && (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'LOGIN' || mode === 'FORGOT_PIN'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Partner Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'REGISTER'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register New</span>
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{successMsg}</p>
          </div>
        )}

        {/* -------------------- MODE: LOGIN -------------------- */}
        {mode === 'LOGIN' && (
          <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 shadow-xs space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
                Welcome Back, Partner
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Enter your registered mobile number and 4-digit PIN to access orders.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Mobile Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-primary)]">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-tabular text-xs font-semibold text-[var(--text-muted)]">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={loginMobile}
                    onChange={(e) => setLoginMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full min-h-[46px] pl-12 pr-3.5 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* PIN Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    4-Digit Security PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('FORGOT_PIN');
                      setForgotMobile(loginMobile);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Forgot PIN?
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={4}
                    placeholder="••••"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full min-h-[46px] pl-4 pr-11 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular tracking-widest text-base text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading || loginMobile.length < 10 || loginPin.length < 4}
                className="w-full min-h-[48px] px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Verifying...' : 'Log In to Partner Portal'}</span>
              </button>
            </form>
          </div>
        )}

        {/* -------------------- MODE: FORGOT PIN -------------------- */}
        {mode === 'FORGOT_PIN' && (
          <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 shadow-xs space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
                Reset Security PIN
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {forgotStep === 1
                  ? 'Enter your registered mobile number to retrieve your security question.'
                  : 'Answer your registered security question and enter a new 4-digit PIN.'}
              </p>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleFetchSecurityQuestion} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-tabular text-xs font-semibold text-[var(--text-muted)]">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={forgotMobile}
                      onChange={(e) => setForgotMobile(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[46px] pl-12 pr-3.5 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('LOGIN')}
                    className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-primary)]"
                  >
                    Back to Login
                  </button>
                  <button
                    type="submit"
                    disabled={forgotMobile.length < 10}
                    className="flex-1 min-h-[44px] px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
                  >
                    Continue
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPinSubmit} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] space-y-1 text-xs">
                  <span className="text-[var(--text-muted)] font-semibold">Security Question:</span>
                  <p className="font-bold text-[var(--text-primary)]">{forgotQuestion}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Your Security Answer
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter answer"
                    value={forgotAnswer}
                    onChange={(e) => setForgotAnswer(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      New 4-Digit PIN
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={forgotNewPin}
                      onChange={(e) => setForgotNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular tracking-widest text-center text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      Confirm PIN
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={forgotConfirmPin}
                      onChange={(e) => setForgotConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular tracking-widest text-center text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[var(--bg-secondary)] text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || forgotNewPin.length < 4}
                    className="flex-1 min-h-[44px] px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {isLoading ? 'Resetting...' : 'Save New PIN'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* -------------------- MODE: PENDING STATUS -------------------- */}
        {mode === 'PENDING_STATUS' && pendingPartner && (
          <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 shadow-xs space-y-5 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="font-mono-tabular text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                APPLICATION PENDING ADMIN APPROVAL
              </span>
              <h2 className="font-display text-2xl font-bold text-[var(--text-primary)] pt-1">
                {pendingPartner.name}
              </h2>
              <p className="font-mono-tabular text-sm font-bold text-blue-600">
                Permanent Partner ID: {pendingPartner.partnerId}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Mobile:</span>
                <span className="font-mono-tabular font-bold">+91 {pendingPartner.contactNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Vehicle:</span>
                <span className="font-bold">{pendingPartner.vehicleType} ({pendingPartner.vehicleNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Service Area:</span>
                <span className="font-bold">{pendingPartner.serviceArea}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Documents:</span>
                <span className="text-amber-600 font-bold">Uploaded — Under Review</span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Your identity documents (Aadhaar, Driving Licence) and profile photo have been submitted to Desi Wardrobe Admin for verification. Once approved, you will be able to go online and accept delivery orders.
            </p>

            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setPendingPartner(null);
              }}
              className="w-full min-h-[46px] px-6 py-2.5 rounded-2xl bg-[var(--bg-secondary)] hover:bg-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}

        {/* -------------------- MODE: REGISTER -------------------- */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-6">
            {/* Step 1: Personal Details */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                  1. Personal & Contact Information
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1">
                    Full Legal Name (as per Aadhaar) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar Sharma"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[var(--text-primary)] mb-1">
                      10-Digit Mobile Number *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-tabular text-[var(--text-muted)]">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="9876543210"
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ''))}
                        className="w-full min-h-[44px] pl-11 pr-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[var(--text-primary)] mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="ramesh@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1">
                    Residential Address *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="House/Street, Ward, Area, City & PIN"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] resize-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1">
                    Operational Service Area / Town *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. South Delhi, Connaught Place & Saket"
                    value={regServiceArea}
                    onChange={(e) => setRegServiceArea(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Vehicle & Payout Details */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <Truck className="w-4 h-4 text-blue-600" />
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                  2. Vehicle & Earnings Payout
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[var(--text-primary)] mb-1">
                      Vehicle Type *
                    </label>
                    <select
                      value={regVehicleType}
                      onChange={(e) => setRegVehicleType(e.target.value as VehicleType)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-medium"
                    >
                      <option value="BIKE">Motorcycle / Bike</option>
                      <option value="SCOOTER">Scooter / Scooty</option>
                      <option value="BICYCLE">Bicycle</option>
                      <option value="CAR">Car / Mini Van</option>
                      <option value="OTHER">Other Delivery Vehicle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[var(--text-primary)] mb-1">
                      Vehicle Registration Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="DL-01-AB-1234"
                      value={regVehicleNumber}
                      onChange={(e) => setRegVehicleNumber(e.target.value.toUpperCase())}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1">
                    UPI ID for Delivery Payouts *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ramesh@okaxis or 9876543210@paytm"
                    value={regUpiId}
                    onChange={(e) => setRegUpiId(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    All delivery charges will be settled directly to this UPI address.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Security PIN & Recovery */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                  3. PIN & Recovery Setup
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[var(--text-primary)] mb-1">
                      4-Digit PIN *
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular tracking-widest text-center"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[var(--text-primary)] mb-1">
                      Confirm PIN *
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={regConfirmPin}
                      onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] font-mono-tabular tracking-widest text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1">
                    Security Question for Recovery *
                  </label>
                  <select
                    value={regSecurityQuestion}
                    onChange={(e) => setRegSecurityQuestion(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
                  >
                    {SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1">
                    Security Answer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter answer"
                    value={regSecurityAnswer}
                    onChange={(e) => setRegSecurityAnswer(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Profile Photo (Camera Only Requirement) */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                    4. Profile Photo (Camera Only) *
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                  CAMERA ONLY
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  For identity security, your initial profile photograph must be captured live using your device camera. Gallery upload is strictly disallowed. Once verified, this photo is locked for 1 year.
                </p>

                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[var(--bg-primary)] border-2 border-dashed border-[var(--border-subtle)] shrink-0 flex items-center justify-center">
                    {regProfilePhoto ? (
                      <img
                        src={regProfilePhoto}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-8 h-8 text-[var(--text-muted)]" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowCameraModal(true)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 text-xs transition-colors shadow-xs"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{regProfilePhoto ? 'Retake Photo' : 'Open Camera to Capture'}</span>
                    </button>
                    {regProfilePhoto && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Live photo captured</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5: Identity Documents Upload (Aadhaar & DL) */}
            <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                  5. Verification Documents (Aadhaar & DL) *
                </h3>
              </div>

              <div className="space-y-4 text-xs">
                {/* Aadhaar Card Front & Back */}
                <div className="space-y-2">
                  <label className="block font-bold text-[var(--text-primary)]">
                    Aadhaar Card (Front & Back) *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-dashed border-[var(--border-subtle)] hover:border-blue-500 cursor-pointer text-center space-y-1.5 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => handleFileChange(e, setRegAadhaarFront)}
                        className="hidden"
                      />
                      <UploadCloud className="w-5 h-5 mx-auto text-[var(--text-muted)]" />
                      <div className="font-bold text-[11px] text-[var(--text-primary)]">
                        {regAadhaarFront ? 'Front Uploaded ✓' : 'Aadhaar Front'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">Max 5MB</div>
                    </label>

                    <label className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-dashed border-[var(--border-subtle)] hover:border-blue-500 cursor-pointer text-center space-y-1.5 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => handleFileChange(e, setRegAadhaarBack)}
                        className="hidden"
                      />
                      <UploadCloud className="w-5 h-5 mx-auto text-[var(--text-muted)]" />
                      <div className="font-bold text-[11px] text-[var(--text-primary)]">
                        {regAadhaarBack ? 'Back Uploaded ✓' : 'Aadhaar Back'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">Max 5MB</div>
                    </label>
                  </div>
                </div>

                {/* Driving Licence Front & Back */}
                <div className="space-y-2">
                  <label className="block font-bold text-[var(--text-primary)]">
                    Driving Licence (Front & Back) *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-dashed border-[var(--border-subtle)] hover:border-blue-500 cursor-pointer text-center space-y-1.5 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => handleFileChange(e, setRegDlFront)}
                        className="hidden"
                      />
                      <UploadCloud className="w-5 h-5 mx-auto text-[var(--text-muted)]" />
                      <div className="font-bold text-[11px] text-[var(--text-primary)]">
                        {regDlFront ? 'DL Front Uploaded ✓' : 'Licence Front'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">Max 5MB</div>
                    </label>

                    <label className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-dashed border-[var(--border-subtle)] hover:border-blue-500 cursor-pointer text-center space-y-1.5 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => handleFileChange(e, setRegDlBack)}
                        className="hidden"
                      />
                      <UploadCloud className="w-5 h-5 mx-auto text-[var(--text-muted)]" />
                      <div className="font-bold text-[11px] text-[var(--text-primary)]">
                        {regDlBack ? 'DL Back Uploaded ✓' : 'Licence Back'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">Max 5MB</div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start gap-2.5 px-1">
              <input
                type="checkbox"
                id="deliveryTerms"
                checked={regTermsAgreed}
                onChange={(e) => setRegTermsAgreed(e.target.checked)}
                className="mt-0.5 rounded border-[var(--border-subtle)] text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="deliveryTerms" className="text-xs text-[var(--text-secondary)] leading-relaxed cursor-pointer">
                I hereby declare that all submitted information and documents are authentic. I agree to operate strictly within Desi Wardrobe delivery operating hours (10:00 AM – 10:00 PM IST) and adhere to the 15 KM delivery radius policy.
              </label>
            </div>

            {/* Submit Registration Button */}
            <button
              type="submit"
              disabled={isLoading || !regTermsAgreed}
              className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 active:scale-[0.99] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoading ? 'Submitting Application & Uploading...' : 'Submit Application for Review'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(dataUrl) => {
          setRegProfilePhoto(dataUrl);
          setErrorMsg(null);
        }}
      />
    </div>
  );
};
