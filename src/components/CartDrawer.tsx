import { useEffect, useRef, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Truck,
  Info,
  MapPin,
  Smartphone,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Clock,
  ExternalLink,
  Percent,
  Layers,
  Wrench,
  Calendar,
  CreditCard,
  Handshake,
  CheckCircle2,
} from 'lucide-react';
import type {
  AuthUser,
  BargainOffer,
  CartItem,
  DeliveryRegion,
  GarageFittingSlotAvailability,
  SparePart,
  VirtualReceipt,
} from '../types';
import {
  addDaysToDateStr,
  BANK_TRANSFER_ACCOUNT_NUMBER,
  calculateCheckoutPricing,
  formatCurrency,
  formatFittingDateLabel,
  formatMpesaPhone,
  GARAGE_BOOKING_MAX_DAYS_AHEAD,
  GARAGE_FITTING_SERVICE_NOTICE,
  GEARBOX_OIL_CAN_LITRES,
  GEARBOX_OIL_LITRES_NEEDED,
  getCartGearboxOilCrossSells,
  getDefaultFittingDate,
  getGarageSlotLabel,
  getMatchingGearboxOils,
  getNairobiDateParts,
  GUARANTEE_NOTICE,
  isAccountProfessionalPartner,
  isGearboxPart,
  isSundayDateStr,
  ITEM_VOLUME_DISCOUNT_TIERS,
  MPESA_ACCOUNT_NUMBER,
  MPESA_PAYBILL_NUMBER,
  NAIROBI_DELIVERY_RATE_PER_10KM,
  NAIROBI_DELIVERY_ZONES,
  NAIROBI_RIDER_TRACKING_NOTICE,
  PARTNER_BULK_BONUS_PCT,
  PARTNER_BULK_MIN_QTY,
  PARTNER_BULK_MIN_SUBTOTAL,
  PHYSICAL_STORE_ADDRESS,
  PHYSICAL_STORE_HOURS,
  PHYSICAL_STORE_MAPS_URL,
  PICKUP_RESERVATION_HOURS,
  REFERRAL_MECHANIC_CREDIT_PCT,
  RETURN_EXCHANGE_POLICY_NOTICE,
  TRUST_PICKUP_ASSURANCE_NOTICE,
  calculateNairobiDeliveryQuote,
} from '../constants/catalog';
import { PartImage } from './PartImage';

const PAYMENT_MPESA_STK = 'M-Pesa STK Push (Prompt on Phone)';
const PAYMENT_CARD = 'Debit / Credit Card (Visa, Mastercard)';
const PAYMENT_MPESA = `M-Pesa Paybill (${MPESA_PAYBILL_NUMBER} / Acc: ${MPESA_ACCOUNT_NUMBER})`;
const PAYMENT_BANK = `Bank Transfer (Acc: ${BANK_TRANSFER_ACCOUNT_NUMBER})`;

interface ActiveStkSession {
  mode: 'daraja' | 'prompt';
  checkoutRequestId: string;
  mpesaPhone: string;
  amount: number;
  paybill: string;
  accountNumber: string;
  customerMessage: string;
}

interface ActiveCardSession {
  transactionId: string;
  cardBrand: string;
  cardLast4: string;
  expiryLabel: string;
  cardholderName: string;
  amount: number;
  resultDesc: string;
}

interface ActiveMpesaCodeSession {
  mode: 'stk' | 'manual';
  checkoutRequestId: string;
  amount: number;
  paybill: string;
  accountNumber: string;
  issuedMpesaCode?: string;
  customerMessage: string;
}

function detectCardBrandClient(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7([01]\d|20)))/.test(digits)) {
    return 'Mastercard';
  }
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  return 'Card';
}

function isValidCardLuhnClient(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function formatCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatCardExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  allParts: SparePart[];
  currentUser: AuthUser | null;
  authToken: string | null;
  sessionId: string;
  bargains?: BargainOffer[];
  activeBargain?: BargainOffer | null;
  onSelectActiveBargain?: (bargain: BargainOffer | null) => void;
  onOpenBargainCart?: () => void;
  onOpenMyBargains?: () => void;
  onBargainRedeemed?: (bargainId: string, receipt: VirtualReceipt) => void;
  onClose: () => void;
  onAddToCart: (part: SparePart, quantity: number) => void;
  onUpdateQuantity: (partId: string, quantity: number) => void;
  onRemoveItem: (partId: string) => void;
  onClearCart: () => void;
  onOrderCompleted: (receipt: VirtualReceipt) => void;
}

export function CartDrawer({
  isOpen,
  items,
  allParts,
  currentUser,
  authToken,
  sessionId,
  bargains = [],
  activeBargain = null,
  onSelectActiveBargain,
  onOpenBargainCart,
  onOpenMyBargains,
  onBargainRedeemed,
  onClose,
  onAddToCart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderCompleted,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaPhoneEdited, setMpesaPhoneEdited] = useState(false);
  const [deliveryRegion, setDeliveryRegion] = useState<DeliveryRegion>('nairobi');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [courierName, setCourierName] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [fittingDate, setFittingDate] = useState<string>(() => getDefaultFittingDate());
  const [fittingTimeSlot, setFittingTimeSlot] = useState<string>('');
  const [garageSlots, setGarageSlots] = useState<GarageFittingSlotAvailability[]>([]);
  const [garageDateIsSunday, setGarageDateIsSunday] = useState(false);
  const [loadingGarageSlots, setLoadingGarageSlots] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_MPESA_STK);
  const [referralInput, setReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<{
    valid: boolean;
    code?: string;
    partnerName?: string;
    message?: string;
  } | null>(null);
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [applyReferralCredit, setApplyReferralCredit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stkSession, setStkSession] = useState<ActiveStkSession | null>(null);
  const [mpesaPin, setMpesaPin] = useState('');
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [cardholderEdited, setCardholderEdited] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardSession, setCardSession] = useState<ActiveCardSession | null>(null);
  const [confirmingCard, setConfirmingCard] = useState(false);
  const [mpesaCodeSession, setMpesaCodeSession] = useState<ActiveMpesaCodeSession | null>(null);
  const [mpesaTransactionCode, setMpesaTransactionCode] = useState('');
  const [verifyingMpesaCode, setVerifyingMpesaCode] = useState(false);
  const [remoteNairobiQuote, setRemoteNairobiQuote] = useState<{
    destination: string;
    distanceKm: number;
    fee: number;
    slabs: number;
    matchedZone: string;
  } | null>(null);
  const [estimatingDelivery, setEstimatingDelivery] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentUser) {
      setCustomerName(currentUser.name);
      setCustomerPhone(currentUser.phone);
      setMpesaPhone(currentUser.phone);
      setMpesaPhoneEdited(false);
      if (!cardholderEdited) {
        setCardholderName(currentUser.name);
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setMpesaPhone('');
      setMpesaPhoneEdited(false);
      if (!cardholderEdited) {
        setCardholderName('');
      }
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!mpesaPhoneEdited) {
      setMpesaPhone(customerPhone);
    }
  }, [customerPhone, mpesaPhoneEdited]);

  useEffect(() => {
    if (!cardholderEdited) {
      setCardholderName(customerName);
    }
  }, [customerName, cardholderEdited]);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
    }
    return () => stopPolling();
  }, [isOpen]);

  const completeOrderWithReceipt = (receipt: VirtualReceipt) => {
    stopPolling();
    setStkSession(null);
    setMpesaPin('');
    setMpesaCodeSession(null);
    setMpesaTransactionCode('');
    setCardSession(null);
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardholderName('');
    setCardholderEdited(false);
    if (receipt.bargainId && onBargainRedeemed) {
      onBargainRedeemed(receipt.bargainId, receipt);
    }
    onSelectActiveBargain?.(null);
    onClearCart();
    onClose();
    onOrderCompleted(receipt);
    setCustomerName('');
    setCustomerPhone('');
    setMpesaPhone('');
    setMpesaPhoneEdited(false);
    setDeliveryAddress('');
    setRemoteNairobiQuote(null);
    setCourierName('');
    setVehicleDetails('');
    setFittingDate(getDefaultFittingDate());
    setFittingTimeSlot('');
    setReferralInput('');
    setReferralStatus(null);
    setApplyReferralCredit(false);
  };

  useEffect(() => {
    if (!isOpen || deliveryRegion !== 'nairobi') {
      return;
    }
    const trimmedDest = deliveryAddress.trim();
    if (trimmedDest.length < 3) {
      setRemoteNairobiQuote(null);
      setEstimatingDelivery(false);
      return;
    }
    let cancelled = false;
    setEstimatingDelivery(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/delivery/estimate?destination=${encodeURIComponent(trimmedDest)}`)
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as {
            distanceKm?: number;
            fee?: number;
            slabs?: number;
            matchedZone?: string;
          };
        })
        .then((data) => {
          if (cancelled || !data || typeof data.distanceKm !== 'number' || typeof data.fee !== 'number') {
            return;
          }
          setRemoteNairobiQuote({
            destination: trimmedDest,
            distanceKm: data.distanceKm,
            fee: data.fee,
            slabs: data.slabs || Math.max(1, Math.ceil(data.distanceKm / 10)),
            matchedZone: data.matchedZone || trimmedDest,
          });
        })
        .catch(() => {
          // Keep synchronous local estimate
        })
        .finally(() => {
          if (!cancelled) {
            setEstimatingDelivery(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, deliveryRegion, deliveryAddress]);

  useEffect(() => {
    if (!isOpen || deliveryRegion !== 'garage_fitting' || !fittingDate) {
      return;
    }
    let cancelled = false;
    setLoadingGarageSlots(true);
    fetch(`/api/garage-slots?date=${encodeURIComponent(fittingDate)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          isSunday?: boolean;
          slots?: GarageFittingSlotAvailability[];
        };
      })
      .then((data) => {
        if (cancelled || !data) return;
        const slots = Array.isArray(data.slots) ? data.slots : [];
        setGarageSlots(slots);
        setGarageDateIsSunday(Boolean(data.isSunday));
        setFittingTimeSlot((prev) => {
          if (prev && slots.some((s) => s.id === prev && s.available)) {
            return prev;
          }
          const firstOpen = slots.find((s) => s.available);
          return firstOpen ? firstOpen.id : '';
        });
      })
      .catch(() => {
        if (!cancelled) {
          setGarageSlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingGarageSlots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, deliveryRegion, fittingDate]);

  const pollDarajaStatus = async (checkoutRequestId: string, sync = true) => {
    setCheckingStatus(true);
    try {
      const res = await fetch(
        `/api/mpesa/stk-status/${encodeURIComponent(checkoutRequestId)}${sync ? '?sync=1' : ''}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        status?: 'pending' | 'completed' | 'failed' | 'cancelled';
        resultDesc?: string;
        receipt?: VirtualReceipt;
      };
      if (data.status === 'completed' && data.receipt) {
        completeOrderWithReceipt(data.receipt);
      } else if (data.status === 'cancelled' || data.status === 'failed') {
        stopPolling();
        setStkSession(null);
        setError(data.resultDesc || 'M-Pesa payment was not completed. Please try again.');
      }
    } catch {
      // Ignore transient network errors while polling
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !stkSession || stkSession.mode !== 'daraja') {
      stopPolling();
      return;
    }
    pollTimerRef.current = window.setInterval(() => {
      void pollDarajaStatus(stkSession.checkoutRequestId, true);
    }, 2500);
    return () => stopPolling();
  }, [isOpen, stkSession?.checkoutRequestId, stkSession?.mode]);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.part.price * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const isProFlagged = isAccountProfessionalPartner(currentUser);
  const acceptedBargains = bargains.filter((b) => b.status === 'accepted');
  const localNairobiQuote = calculateNairobiDeliveryQuote(deliveryAddress);
  const trimmedDeliveryDest = deliveryAddress.trim();
  const activeNairobiQuote =
    remoteNairobiQuote && remoteNairobiQuote.destination === trimmedDeliveryDest
      ? remoteNairobiQuote
      : localNairobiQuote;
  const activeDeliveryFee = deliveryRegion === 'nairobi' ? activeNairobiQuote.fee : 0;
  const pricing = calculateCheckoutPricing({
    subtotal,
    totalUnits,
    items,
    isProfessionalMechanicOrGarage: isProFlagged,
    partner: currentUser?.partnerProfile ?? null,
    referralValid:
      referralStatus?.valid && referralStatus.code && referralStatus.partnerName
        ? { code: referralStatus.code, partnerName: referralStatus.partnerName }
        : null,
    applyReferralCredit,
    activeBargain,
    deliveryFee: activeDeliveryFee,
  });

  const availablePartnerCredit = Math.max(
    0,
    Math.round(currentUser?.partnerProfile?.referralCreditBalance || 0),
  );

  const handleValidateReferral = async () => {
    const trimmed = referralInput.trim().toUpperCase();
    if (!trimmed) {
      setReferralStatus(null);
      return;
    }
    setValidatingReferral(true);
    try {
      const res = await fetch(
        `/api/partners/validate-referral?code=${encodeURIComponent(trimmed)}`,
      );
      const data = (await res.json()) as {
        valid?: boolean;
        code?: string;
        creditPercent?: number;
        discountPercent?: number;
        partnerName?: string;
        error?: string;
      };
      if (!res.ok || !data.valid) {
        setReferralStatus({
          valid: false,
          message: data.error || 'Referral code not found.',
        });
        return;
      }
      const creditPct = data.creditPercent ?? REFERRAL_MECHANIC_CREDIT_PCT;
      setReferralStatus({
        valid: true,
        code: data.code,
        partnerName: data.partnerName,
        message: `Referral linked (${data.partnerName}) — mechanic earns ${creditPct}% credit after fitting & testing (standard customer pricing applies)`,
      });
    } catch {
      setReferralStatus({ valid: false, message: 'Could not verify referral code.' });
    } finally {
      setValidatingReferral(false);
    }
  };

  const crossSellGroups = getCartGearboxOilCrossSells(items, allParts).filter(
    (group) => group.cansStillNeeded > 0,
  );

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Please enter your name and phone number to generate your receipt.');
      return;
    }

    if ((deliveryRegion === 'nairobi' || deliveryRegion === 'outside_nairobi') && !deliveryAddress.trim()) {
      setError(
        deliveryRegion === 'nairobi'
          ? 'Please enter your Nairobi delivery destination so we can calculate your exact delivery fee.'
          : 'Please enter your delivery destination town or address.',
      );
      return;
    }

    if (deliveryRegion === 'outside_nairobi' && !courierName.trim()) {
      setError('Please enter the name of your preferred courier service for delivery outside Nairobi.');
      return;
    }

    if (deliveryRegion === 'garage_fitting') {
      if (!fittingDate) {
        setError('Please pick a date for your in-garage fitting appointment.');
        return;
      }
      if (isSundayDateStr(fittingDate)) {
        setError('Our fitting garage is closed on Sundays (Mon–Sat: 7.30am - 6.30pm). Please choose another day.');
        return;
      }
      if (!fittingTimeSlot) {
        setError('Please select an available hourly time slot for your in-garage fitting.');
        return;
      }
    }

    if (activeBargain && !pricing.bargainMatched) {
      setError(
        pricing.bargainMismatchReason ||
          'Your cart quantities differ from your selected bargain deal. Click "My Bargains" to reload exact deal items or clear the bargain before checking out.',
      );
      return;
    }

    const appliedBargainId =
      activeBargain && pricing.bargainMatched ? activeBargain.id : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    if (paymentMethod === PAYMENT_MPESA_STK) {
      const targetPhone = (mpesaPhone || customerPhone).trim();
      const formatted = formatMpesaPhone(targetPhone);
      if (!formatted) {
        setError(
          'Please enter a valid Safaricom/Kenyan M-Pesa phone number (e.g. 0712345678 or 254712345678).',
        );
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/mpesa/stk-push', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            bargainId: appliedBargainId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            mpesaPhone: formatted,
            deliveryRegion,
            deliveryAddress: deliveryAddress.trim(),
            courierName: deliveryRegion === 'outside_nairobi' ? courierName.trim() : undefined,
            vehicleDetails:
              deliveryRegion === 'garage_fitting' && vehicleDetails.trim()
                ? vehicleDetails.trim()
                : undefined,
            fittingDate: deliveryRegion === 'garage_fitting' ? fittingDate : undefined,
            fittingTimeSlot: deliveryRegion === 'garage_fitting' ? fittingTimeSlot : undefined,
            paymentMethod,
            referralCode: referralStatus?.valid ? referralStatus.code : undefined,
            applyReferralCredit:
              currentUser?.partnerProfile?.status === 'active' ? applyReferralCredit : undefined,
            items: items.map((item) => ({
              partId: item.part.id,
              quantity: item.quantity,
            })),
          }),
        });
        const data = (await res.json()) as Partial<ActiveStkSession> & { error?: string };
        if (!res.ok || !data.checkoutRequestId) {
          setError(data.error || 'Could not send M-Pesa prompt. Please try again.');
          return;
        }
        setMpesaPin('');
        setStkSession({
          mode: data.mode === 'daraja' ? 'daraja' : 'prompt',
          checkoutRequestId: data.checkoutRequestId,
          mpesaPhone: data.mpesaPhone || formatted,
          amount: data.amount || pricing.total,
          paybill: data.paybill || MPESA_PAYBILL_NUMBER,
          accountNumber: data.accountNumber || MPESA_ACCOUNT_NUMBER,
          customerMessage:
            data.customerMessage || 'M-Pesa prompt sent. Enter your PIN to confirm payment.',
        });
      } catch {
        setError('Network error while initiating the M-Pesa payment prompt.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (paymentMethod === PAYMENT_CARD) {
      const cleanedName = cardholderName.trim();
      const cardDigits = cardNumber.replace(/\D/g, '');
      const cvvDigits = cardCvv.replace(/\D/g, '');
      const expMatch = cardExpiry.trim().match(/^(\d{2})\s*\/\s*(\d{2,4})$/);

      if (cleanedName.length < 2) {
        setError('Please enter the cardholder name as shown on your card.');
        return;
      }
      if (!isValidCardLuhnClient(cardDigits)) {
        setError('Please enter a valid 13–19 digit debit or credit card number.');
        return;
      }
      if (!expMatch) {
        setError('Please enter card expiry in MM/YY format (e.g. 08/28).');
        return;
      }
      const expMonth = Number(expMatch[1]);
      const expYear =
        expMatch[2].length === 2 ? 2000 + Number(expMatch[2]) : Number(expMatch[2]);
      if (expMonth < 1 || expMonth > 12) {
        setError('Card expiry month must be between 01 and 12.');
        return;
      }
      const { dateStr } = getNairobiDateParts();
      const [curYearStr, curMonthStr] = dateStr.split('-');
      const curYear = Number(curYearStr);
      const curMonth = Number(curMonthStr);
      if (expYear < curYear || (expYear === curYear && expMonth < curMonth)) {
        setError('This card has expired. Please use an active debit or credit card.');
        return;
      }
      if (!/^\d{3,4}$/.test(cvvDigits)) {
        setError('Please enter a valid 3 or 4 digit card security code (CVV).');
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/payments/card/initiate', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            bargainId: appliedBargainId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            deliveryRegion,
            deliveryAddress: deliveryAddress.trim(),
            courierName: deliveryRegion === 'outside_nairobi' ? courierName.trim() : undefined,
            vehicleDetails:
              deliveryRegion === 'garage_fitting' && vehicleDetails.trim()
                ? vehicleDetails.trim()
                : undefined,
            fittingDate: deliveryRegion === 'garage_fitting' ? fittingDate : undefined,
            fittingTimeSlot: deliveryRegion === 'garage_fitting' ? fittingTimeSlot : undefined,
            paymentMethod,
            referralCode: referralStatus?.valid ? referralStatus.code : undefined,
            applyReferralCredit:
              currentUser?.partnerProfile?.status === 'active' ? applyReferralCredit : undefined,
            items: items.map((item) => ({
              partId: item.part.id,
              quantity: item.quantity,
            })),
            cardholderName: cleanedName,
            cardNumber: cardDigits,
            expiry: cardExpiry.trim(),
            cvv: cvvDigits,
          }),
        });
        const data = (await res.json()) as Partial<ActiveCardSession> & { error?: string };
        if (!res.ok || !data.transactionId) {
          setError(data.error || 'Could not validate card details. Please check and try again.');
          return;
        }
        setCardCvv('');
        setCardSession({
          transactionId: data.transactionId,
          cardBrand: data.cardBrand || detectCardBrandClient(cardDigits),
          cardLast4: data.cardLast4 || cardDigits.slice(-4),
          expiryLabel: data.expiryLabel || cardExpiry.trim(),
          cardholderName: data.cardholderName || cleanedName,
          amount: data.amount || pricing.total,
          resultDesc:
            data.resultDesc ||
            `Ready to deduct ${formatCurrency(pricing.total)} once you confirm payment.`,
        });
      } catch {
        setError('Network error while preparing your card payment.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (paymentMethod === PAYMENT_MPESA) {
      setSubmitting(true);
      try {
        const res = await fetch('/api/mpesa/manual-initiate', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            bargainId: appliedBargainId,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            deliveryRegion,
            deliveryAddress: deliveryAddress.trim(),
            courierName: deliveryRegion === 'outside_nairobi' ? courierName.trim() : undefined,
            vehicleDetails:
              deliveryRegion === 'garage_fitting' && vehicleDetails.trim()
                ? vehicleDetails.trim()
                : undefined,
            fittingDate: deliveryRegion === 'garage_fitting' ? fittingDate : undefined,
            fittingTimeSlot: deliveryRegion === 'garage_fitting' ? fittingTimeSlot : undefined,
            paymentMethod,
            referralCode: referralStatus?.valid ? referralStatus.code : undefined,
            applyReferralCredit:
              currentUser?.partnerProfile?.status === 'active' ? applyReferralCredit : undefined,
            items: items.map((item) => ({
              partId: item.part.id,
              quantity: item.quantity,
            })),
          }),
        });
        const data = (await res.json()) as {
          checkoutRequestId?: string;
          amount?: number;
          paybill?: string;
          accountNumber?: string;
          customerMessage?: string;
          error?: string;
        };
        if (!res.ok || !data.checkoutRequestId) {
          setError(data.error || 'Could not initiate M-Pesa Paybill checkout. Please try again.');
          return;
        }
        setMpesaTransactionCode('');
        setMpesaCodeSession({
          mode: 'manual',
          checkoutRequestId: data.checkoutRequestId,
          amount: data.amount || pricing.total,
          paybill: data.paybill || MPESA_PAYBILL_NUMBER,
          accountNumber: data.accountNumber || MPESA_ACCOUNT_NUMBER,
          customerMessage:
            data.customerMessage ||
            'Send payment to our M-Pesa Paybill and enter your M-Pesa transaction code below to validate and link it to your VirtualReceipt.',
        });
      } catch {
        setError('Network error while initiating M-Pesa checkout.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          bargainId: appliedBargainId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryRegion,
          deliveryAddress: deliveryAddress.trim(),
          courierName: deliveryRegion === 'outside_nairobi' ? courierName.trim() : undefined,
          vehicleDetails:
            deliveryRegion === 'garage_fitting' && vehicleDetails.trim()
              ? vehicleDetails.trim()
              : undefined,
          fittingDate: deliveryRegion === 'garage_fitting' ? fittingDate : undefined,
          fittingTimeSlot: deliveryRegion === 'garage_fitting' ? fittingTimeSlot : undefined,
          paymentMethod,
          referralCode: referralStatus?.valid ? referralStatus.code : undefined,
          applyReferralCredit:
            currentUser?.partnerProfile?.status === 'active' ? applyReferralCredit : undefined,
          items: items.map((item) => ({
            partId: item.part.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = (await response.json()) as { receipt?: VirtualReceipt; error?: string };
      if (!response.ok || !data.receipt) {
        setError(data.error || 'Could not complete checkout. Please try again.');
        return;
      }

      completeOrderWithReceipt(data.receipt);
    } catch {
      setError('Network error while generating your virtual receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmStkPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stkSession) return;
    setError(null);

    const cleanedPin = mpesaPin.replace(/\D/g, '');
    if (cleanedPin.length !== 4) {
      setError('Please enter your 4-digit M-Pesa PIN to confirm payment.');
      return;
    }

    setConfirmingPin(true);
    try {
      const res = await fetch('/api/mpesa/stk-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutRequestId: stkSession.checkoutRequestId,
          pin: cleanedPin,
          action: 'confirm',
        }),
      });
      const data = (await res.json()) as {
        status?: string;
        issuedMpesaCode?: string;
        amount?: number;
        resultDesc?: string;
        receipt?: VirtualReceipt;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Could not confirm M-Pesa PIN. Please try again.');
        return;
      }
      if (data.status === 'awaiting_code_validation') {
        const currentStk = stkSession;
        setStkSession(null);
        setMpesaPin('');
        setMpesaTransactionCode('');
        setMpesaCodeSession({
          mode: 'stk',
          checkoutRequestId: currentStk.checkoutRequestId,
          amount: data.amount || currentStk.amount,
          paybill: currentStk.paybill,
          accountNumber: currentStk.accountNumber,
          issuedMpesaCode: data.issuedMpesaCode,
          customerMessage:
            data.resultDesc ||
            'Payment authorized! Enter your M-Pesa transaction code below to validate and link it to your VirtualReceipt.',
        });
        return;
      }
      if (data.receipt) {
        completeOrderWithReceipt(data.receipt);
      } else {
        setError('Could not confirm M-Pesa PIN. Please try again.');
      }
    } catch {
      setError('Network error while confirming your M-Pesa PIN.');
    } finally {
      setConfirmingPin(false);
    }
  };

  const handleVerifyMpesaTransactionCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpesaCodeSession) return;
    setError(null);

    const normalizedCode = mpesaTransactionCode.trim().toUpperCase();
    if (
      !/^[A-Z0-9]{8,12}$/.test(normalizedCode) ||
      !/[A-Z]/.test(normalizedCode) ||
      !/\d/.test(normalizedCode)
    ) {
      setError(
        'Please enter a valid M-Pesa transaction code (8–12 letters & numbers, e.g. SLK8X9M2Q4).',
      );
      return;
    }

    setVerifyingMpesaCode(true);
    try {
      const res = await fetch('/api/mpesa/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutRequestId: mpesaCodeSession.checkoutRequestId,
          mpesaTransactionCode: normalizedCode,
          action: 'verify',
        }),
      });
      const data = (await res.json()) as {
        status?: string;
        receipt?: VirtualReceipt;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        setError(data.error || 'Could not validate your M-Pesa transaction code.');
        return;
      }
      completeOrderWithReceipt(data.receipt);
    } catch {
      setError('Network error while validating your M-Pesa transaction code.');
    } finally {
      setVerifyingMpesaCode(false);
    }
  };

  const handleCancelMpesaCodeVerification = async () => {
    if (!mpesaCodeSession) return;
    const id = mpesaCodeSession.checkoutRequestId;
    setMpesaCodeSession(null);
    setMpesaTransactionCode('');
    setError(null);
    try {
      await fetch('/api/mpesa/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutRequestId: id, action: 'cancel' }),
      });
    } catch {
      // ignore
    }
  };

  const handleCancelStkPrompt = async () => {
    if (!stkSession) return;
    stopPolling();
    const id = stkSession.checkoutRequestId;
    setStkSession(null);
    setMpesaPin('');
    setError(null);
    try {
      await fetch('/api/mpesa/stk-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutRequestId: id, action: 'cancel' }),
      });
    } catch {
      // ignore
    }
  };

  const handleConfirmCardPayment = async () => {
    if (!cardSession || confirmingCard) return;
    setError(null);
    setConfirmingCard(true);
    try {
      const res = await fetch('/api/payments/card/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: cardSession.transactionId,
          action: 'confirm',
        }),
      });
      const data = (await res.json()) as {
        status?: string;
        receipt?: VirtualReceipt;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        setError(data.error || 'Could not authorize card deduction. Please try again.');
        return;
      }
      completeOrderWithReceipt(data.receipt);
    } catch {
      setError('Network error while confirming card payment.');
    } finally {
      setConfirmingCard(false);
    }
  };

  const handleCancelCardPayment = async () => {
    if (!cardSession) return;
    const txId = cardSession.transactionId;
    setCardSession(null);
    setCardCvv('');
    setError(null);
    try {
      await fetch('/api/payments/card/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, action: 'cancel' }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50 backdrop-blur-xs no-print">
      <div
        className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Your Cart</h2>
            <p className="text-xs text-slate-500 mt-0.5">{GUARANTEE_NOTICE}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Content */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Your cart is empty</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Search our body parts, electricals, and mechanical inventory to add spare parts here.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Browse Spare Parts
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Items List */}
            <ul className="divide-y divide-slate-200">
              {items.map(({ part, quantity }) => {
                const volLine = pricing.volumeLinesByPartId[part.id];
                const hasVolumeDiscount = Boolean(volLine && volLine.discountAmount > 0);
                const nextTier = volLine?.nextTier ?? null;
                const canUpgradeTier = Boolean(volLine?.canUpgradeToNext && nextTier);

                return (
                  <li key={part.id} className="py-4 first:pt-0 flex gap-4">
                    <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <PartImage
                        src={part.imageUrl}
                        alt={part.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 truncate">
                        {part.category} · {part.subcategory}
                      </p>
                      <h3 className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                        {part.name}
                      </h3>
                      {isGearboxPart(part) && (() => {
                        const match = getMatchingGearboxOils(part, allParts);
                        return (
                          <p className="text-[11px] font-medium text-orange-700 mt-0.5 truncate">
                            Matched Oil: {match.primaryOil ? match.primaryOil.name : match.oilSpecLabel}
                          </p>
                        );
                      })()}

                      {hasVolumeDiscount && volLine && (
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
                          <Layers className="w-3 h-3 shrink-0" />
                          <span>
                            {volLine.discountPct}% Same-Part Volume Off (-{formatCurrency(volLine.discountAmount)})
                          </span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center border border-slate-200 rounded-md bg-slate-50">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(part.id, quantity - 1)}
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                            aria-label={`Decrease quantity of ${part.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-mono tabular-nums font-medium text-slate-900">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(part.id, quantity + 1)}
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                            aria-label={`Increase quantity of ${part.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            {hasVolumeDiscount && volLine ? (
                              <div className="flex items-baseline gap-1.5 justify-end">
                                <span className="text-xs font-mono tabular-nums text-slate-400 line-through">
                                  {formatCurrency(volLine.lineSubtotal)}
                                </span>
                                <span className="text-sm font-mono tabular-nums font-semibold text-emerald-700">
                                  {formatCurrency(volLine.netLineTotal)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm font-mono tabular-nums font-semibold text-slate-900">
                                {formatCurrency(part.price * quantity)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(part.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            aria-label={`Remove ${part.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {canUpgradeTier && nextTier && volLine && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(part.id, nextTier.minQty)}
                            className="w-full text-left inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-orange-50/90 hover:bg-orange-100 border border-orange-200 text-[11px] font-medium text-orange-950 transition-colors"
                          >
                            <span>
                              Add <strong>+{volLine.unitsToNextTier}</strong> more ({nextTier.minQty}+ units) for{' '}
                              <strong>{nextTier.discountPct}%</strong> volume off
                            </span>
                            <span className="font-mono font-bold text-orange-700 whitespace-nowrap shrink-0">
                              Save {formatCurrency(volLine.nextTierSavings)}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Specific Gearbox Oil Cross-Sell Recommendations (per distinct gearbox type in cart) */}
            {crossSellGroups.length > 0 && (
              <div className="space-y-3">
                {crossSellGroups.map((group) => (
                  <div
                    key={group.key}
                    className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3"
                  >
                    <div>
                      <p className="font-display text-xs sm:text-sm font-bold text-slate-900">
                        Matched {group.oilSpecLabel} ({group.gearboxCount}{' '}
                        {group.gearboxCount === 1 ? 'Gearbox' : 'Gearboxes'})
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                        For: {group.gearboxNames.join(', ')}
                      </p>
                      <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                        Uses ~<strong>{GEARBOX_OIL_LITRES_NEEDED}L</strong> per gearbox ({GEARBOX_OIL_CAN_LITRES}L/can). Add{' '}
                        <strong>
                          {group.cansStillNeeded} {group.cansStillNeeded === 1 ? 'can' : 'cans'}
                        </strong>{' '}
                        of the exact matching oil below:
                      </p>
                    </div>

                    <div className="space-y-2">
                      {group.oils.slice(0, 2).map((oil) => {
                        const addQty = Math.min(
                          group.cansStillNeeded,
                          Math.max(1, oil.stock || group.cansStillNeeded),
                        );
                        const isExact = group.exactOilIds.includes(oil.id);
                        return (
                          <div
                            key={oil.id}
                            className={`rounded-lg p-2.5 flex items-center gap-3 border ${
                              isExact
                                ? 'bg-white border-orange-300'
                                : 'bg-white/80 border-orange-200'
                            }`}
                          >
                            <div className="w-12 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <PartImage
                                src={oil.imageUrl}
                                alt={oil.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">
                                {isExact ? 'Exact Match' : 'Compatible Alternative'}
                              </p>
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {oil.name}
                              </p>
                              <p className="text-[11px] font-mono tabular-nums text-slate-600">
                                {formatCurrency(oil.price * addQty)} for {addQty}{' '}
                                {addQty === 1 ? 'can' : 'cans'} ({addQty * GEARBOX_OIL_CAN_LITRES}L)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onAddToCart(oil, addQty)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                              <span>
                                {addQty === 2
                                  ? 'Add Pair (2)'
                                  : `Add ${addQty} Can${addQty > 1 ? 's' : ''}`}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Subtotal & Volume / Partner / Bulk / Referral Discount Summary */}
            <div className="border-t border-slate-200 pt-4 space-y-2">
              {currentUser?.partnerProfile?.status === 'active' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                    <Percent className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span>Partner Trade Discount Active</span>
                  </span>
                  <span className="text-slate-600">
                    {isProFlagged
                      ? `Trade rate + Bulk +${PARTNER_BULK_BONUS_PCT}% at ${PARTNER_BULK_MIN_QTY}+ items & ≥ ${formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)} (automated loyalty tiers excluded)`
                      : `Bulk +${PARTNER_BULK_BONUS_PCT}% unlocks at ${PARTNER_BULK_MIN_QTY}+ items & ≥ ${formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)} (retail tier discounts excluded)`}
                  </span>
                </div>
              ) : isProFlagged ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-[11px] text-orange-900 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Percent className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span>Professional Mechanic/Garage Account</span>
                  </span>
                  <span>
                    Automated tier-based loyalty discounts are excluded per business rules.
                  </span>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                    <Layers className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span>Same-Part Volume Tiers</span>
                    <span className="font-normal text-slate-500">(excludes Gearbox Oil)</span>
                  </span>
                  <span className="font-mono text-slate-700">
                    {ITEM_VOLUME_DISCOUNT_TIERS.map(
                      (t) => `${t.minQty}+ → ${t.discountPct}%`,
                    ).join(' · ')}
                  </span>
                </div>
              )}

              {/* Bargain / Negotiation Banner */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Handshake className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>Want a better deal on this cart?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenMyBargains && bargains.length > 0 && (
                      <button
                        type="button"
                        onClick={onOpenMyBargains}
                        className="text-[11px] font-semibold text-slate-700 hover:text-orange-700 underline underline-offset-2 whitespace-nowrap shrink-0"
                      >
                        My Bargains ({bargains.length})
                      </button>
                    )}
                    {onOpenBargainCart && (
                      <button
                        type="button"
                        onClick={onOpenBargainCart}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-orange-700 bg-white border border-orange-300 hover:bg-orange-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        <Handshake className="w-3 h-3" />
                        <span>Bargain on Cart</span>
                      </button>
                    )}
                  </div>
                </div>

                {activeBargain ? (
                  <div
                    className={`rounded-md border px-2.5 py-2 text-[11px] space-y-1 ${
                      pricing.bargainMatched
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {pricing.bargainMatched
                            ? `Bargain ${activeBargain.bargainCode} Applied`
                            : `Bargain ${activeBargain.bargainCode} Mismatch`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectActiveBargain?.(null)}
                        className="text-[11px] font-semibold underline hover:opacity-80"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="leading-snug">
                      {pricing.bargainMatched
                        ? `Agreed deal total: ${formatCurrency(activeBargain.agreedTotal ?? activeBargain.offeredTotal)} (saving ${formatCurrency(pricing.bargainDiscountAmount)} off bargained items).`
                        : pricing.bargainMismatchReason}
                    </p>
                  </div>
                ) : (
                  acceptedBargains.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-[11px]">
                      <span className="text-emerald-800 font-medium">
                        You have {acceptedBargains.length} accepted bargain{' '}
                        {acceptedBargains.length === 1 ? 'deal' : 'deals'} ready.
                      </span>
                      {onOpenMyBargains && (
                        <button
                          type="button"
                          onClick={onOpenMyBargains}
                          className="font-bold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
                        >
                          Select Deal
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Items ({totalUnits})</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              {pricing.bargainDiscountAmount > 0 && pricing.bargainDiscountLabel && (
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Handshake className="w-3.5 h-3.5 shrink-0" />
                    <span>{pricing.bargainDiscountLabel}</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    -{formatCurrency(pricing.bargainDiscountAmount)}
                  </span>
                </div>
              )}

              {pricing.volumeDiscountAmount > 0 && pricing.volumeDiscountLabel && (
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>{pricing.volumeDiscountLabel}</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    -{formatCurrency(pricing.volumeDiscountAmount)}
                  </span>
                </div>
              )}

              {pricing.partnerOrReferralDiscountAmount > 0 &&
                pricing.partnerOrReferralDiscountLabel && (
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 shrink-0" />
                      <span>{pricing.partnerOrReferralDiscountLabel}</span>
                    </span>
                    <span className="font-mono tabular-nums">
                      -{formatCurrency(pricing.partnerOrReferralDiscountAmount)}
                    </span>
                  </div>
                )}

              {currentUser?.partnerProfile?.status === 'pending' && totalUnits > 0 && (
                <p className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5">
                  Your mechanic/garage partner application is pending admin verification. Trade discounts apply once approved via SMS.
                </p>
              )}

              {currentUser?.partnerProfile?.status === 'active' && !pricing.qualifiesBulk && totalUnits > 0 && (() => {
                const missingUnits = Math.max(0, PARTNER_BULK_MIN_QTY - totalUnits);
                const missingSubtotal = Math.max(0, PARTNER_BULK_MIN_SUBTOTAL - subtotal);
                return (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    {missingUnits > 0 && missingSubtotal > 0 ? (
                      <>
                        Add <strong className="font-mono tabular-nums">{missingUnits}</strong> more{' '}
                        {missingUnits === 1 ? 'item' : 'items'} ({PARTNER_BULK_MIN_QTY}+ total) and{' '}
                        <strong className="font-mono tabular-nums">{formatCurrency(missingSubtotal)}</strong>{' '}
                        more (≥ {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}) to unlock an extra +{PARTNER_BULK_BONUS_PCT}% bulk bonus.
                      </>
                    ) : missingUnits > 0 ? (
                      <>
                        Add <strong className="font-mono tabular-nums">{missingUnits}</strong> more{' '}
                        {missingUnits === 1 ? 'item' : 'items'} ({PARTNER_BULK_MIN_QTY}+ total) to unlock an extra +{PARTNER_BULK_BONUS_PCT}% bulk bonus.
                      </>
                    ) : (
                      <>
                        Add <strong className="font-mono tabular-nums">{formatCurrency(missingSubtotal)}</strong>{' '}
                        more to reach ≥ <strong className="font-mono tabular-nums">{formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}</strong>{' '}
                        and unlock an extra +{PARTNER_BULK_BONUS_PCT}% bulk bonus.
                      </>
                    )}
                  </p>
                );
              })()}

              {currentUser?.partnerProfile?.status === 'active' && availablePartnerCredit > 0 && totalUnits > 0 && (
                <label className="flex items-center justify-between gap-2.5 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-2 text-[11px] text-emerald-950 cursor-pointer">
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={applyReferralCredit}
                      onChange={(e) => setApplyReferralCredit(e.target.checked)}
                      className="rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="font-semibold">
                      Redeem Referral Credit ({formatCurrency(availablePartnerCredit)} available)
                    </span>
                  </span>
                  {applyReferralCredit && pricing.referralCreditApplied > 0 && (
                    <span className="font-mono font-bold text-emerald-700 shrink-0">
                      -{formatCurrency(pricing.referralCreditApplied)}
                    </span>
                  )}
                </label>
              )}

              {currentUser?.partnerProfile?.status !== 'active' && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={referralInput}
                      onChange={(e) => {
                        setReferralInput(e.target.value.toUpperCase());
                        if (referralStatus) setReferralStatus(null);
                      }}
                      placeholder={`Mechanic referral code (${REFERRAL_MECHANIC_CREDIT_PCT}% mechanic credit)`}
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                    <button
                      type="button"
                      disabled={validatingReferral || !referralInput.trim()}
                      onClick={() => void handleValidateReferral()}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 rounded-md transition-colors"
                    >
                      {validatingReferral ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {referralStatus?.message && (
                    <p
                      className={`text-[11px] font-medium ${
                        referralStatus.valid ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {referralStatus.message}
                    </p>
                  )}
                  {referralStatus?.valid && pricing.referralCreditAmount > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
                      <span>
                        Mechanic Credit ({referralStatus.code} · {pricing.referralCreditPercent}% after fitting &amp; testing)
                      </span>
                      <span className="font-mono font-semibold text-emerald-700">
                        {formatCurrency(pricing.referralCreditAmount)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {deliveryRegion === 'nairobi' && (
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-orange-600" />
                    <span>
                      Rider Delivery Fee ({activeNairobiQuote.distanceKm.toFixed(1)} km · KSh{' '}
                      {NAIROBI_DELIVERY_RATE_PER_10KM}/10km, included)
                    </span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatCurrency(pricing.deliveryFee)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-1">
                <span>Total</span>
                <span className="font-mono tabular-nums text-orange-700">
                  {formatCurrency(pricing.total)}
                </span>
              </div>
            </div>

            {/* Checkout Form */}
            <form id="checkout-form" onSubmit={handleCheckout} className="border-t border-slate-200 pt-5 space-y-3.5">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Checkout & Receipt Details
              </h3>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Samuel Kamau"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. +254712345678"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Delivery Service Option
                </label>
                <select
                  value={deliveryRegion}
                  onChange={(e) => setDeliveryRegion(e.target.value as DeliveryRegion)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                >
                  <option value="nairobi">Paid Delivery — Nairobi & Surrounding Areas</option>
                  <option value="outside_nairobi">Paid Delivery — Outside Nairobi (Courier)</option>
                  <option value="pickup">Counter Pickup — My Spare Zone</option>
                  <option value="garage_fitting">
                    In-Garage Fitting — Bring Vehicle & Fit While You Wait
                  </option>
                </select>
                {deliveryRegion === 'nairobi' && (
                  <div className="mt-1.5 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 space-y-1.5">
                    <p className="flex items-start gap-1.5 leading-relaxed">
                      <Truck className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>No payment on delivery.</strong> The Nairobi rider fee (
                        <strong>KSh {NAIROBI_DELIVERY_RATE_PER_10KM} per 10 km</strong> from{' '}
                        <strong>Seventies Plaza, Kirinyaga Rd</strong>) is automatically calculated and{' '}
                        <strong>included directly in your checkout total</strong>.
                      </span>
                    </p>
                    <p className="text-emerald-900 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 leading-relaxed font-medium">
                      {NAIROBI_RIDER_TRACKING_NOTICE}
                    </p>
                    <p className="text-slate-600 leading-relaxed pl-5">
                      {TRUST_PICKUP_ASSURANCE_NOTICE}{' '}
                      <button
                        type="button"
                        onClick={() => setDeliveryRegion('pickup')}
                        className="font-semibold text-orange-700 hover:text-orange-800 underline underline-offset-2"
                      >
                        Switch to Counter Pickup
                      </button>
                    </p>
                  </div>
                )}
                {deliveryRegion === 'outside_nairobi' && (
                  <p className="mt-1.5 text-[11px] text-slate-600 flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2">
                    <Truck className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                    <span>
                      Paid courier delivery applies. Please specify the name of the courier service to be used below.
                    </span>
                  </p>
                )}
                {deliveryRegion === 'pickup' && (
                  <div className="mt-1.5 text-xs text-slate-700 bg-orange-50/80 border border-orange-200 rounded-md px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="leading-relaxed">
                          Pick up your item at{' '}
                          <strong className="text-slate-900">{PHYSICAL_STORE_ADDRESS}</strong>.
                        </p>
                        <p className="text-[11px] font-medium text-orange-950 bg-white/80 border border-orange-200 rounded px-2 py-1">
                          A unique <strong>Counter Pickup Code</strong> will be generated on checkout. Your spare parts are{' '}
                          <strong>reserved for {PICKUP_RESERVATION_HOURS} hours</strong> — any unclaimed part after {PICKUP_RESERVATION_HOURS} hours automatically returns to stock.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pl-6 pt-1 border-t border-orange-200/70">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-orange-600" />
                        <span>{PHYSICAL_STORE_HOURS}</span>
                      </span>
                      <a
                        href={PHYSICAL_STORE_MAPS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
                      >
                        <span>Google Maps Directions</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
                {deliveryRegion === 'garage_fitting' && (
                  <div className="mt-1.5 text-xs text-slate-700 bg-orange-50/90 border border-orange-200 rounded-md px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Wrench className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">
                          In-Garage Fitting (Fit While You Wait)
                        </p>
                        <p className="leading-relaxed">{GARAGE_FITTING_SERVICE_NOTICE}</p>
                        <p className="text-[11px] font-medium text-slate-800">
                          Garage Location: <strong className="text-slate-900">{PHYSICAL_STORE_ADDRESS}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pl-6 pt-1 border-t border-orange-200/70">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-orange-600" />
                        <span>{PHYSICAL_STORE_HOURS}</span>
                      </span>
                      <a
                        href={PHYSICAL_STORE_MAPS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
                      >
                        <span>Google Maps Directions</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {deliveryRegion !== 'pickup' && deliveryRegion !== 'garage_fitting' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    {deliveryRegion === 'nairobi'
                      ? 'Nairobi Delivery Destination (Estate / Area)'
                      : 'Destination Town / Delivery Address'}
                  </label>
                  <input
                    type="text"
                    required
                    list={deliveryRegion === 'nairobi' ? 'nairobi-delivery-zones' : undefined}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={
                      deliveryRegion === 'nairobi'
                        ? 'e.g. Westlands, Kilimani, Karen, Ruiru, Kitengela'
                        : 'e.g. Nakuru Town, Eldoret, Mombasa'
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                  {deliveryRegion === 'nairobi' && (
                    <>
                      <datalist id="nairobi-delivery-zones">
                        {NAIROBI_DELIVERY_ZONES.map((zone) => (
                          <option key={zone.name} value={zone.name}>
                            ~{zone.distanceKm} km · {formatCurrency(Math.max(1, Math.ceil(zone.distanceKm / 10)) * NAIROBI_DELIVERY_RATE_PER_10KM)}
                          </option>
                        ))}
                      </datalist>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-[11px] text-slate-700 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                            <span>
                              {estimatingDelivery
                                ? 'Calculating Nairobi distance...'
                                : activeNairobiQuote.matchedZone
                                  ? `Matched: ${activeNairobiQuote.matchedZone}`
                                  : 'Nairobi Distance Estimate'}
                            </span>
                          </span>
                          <span className="font-mono font-bold text-orange-700 tabular-nums">
                            {formatCurrency(activeNairobiQuote.fee)}
                          </span>
                        </div>
                        <p className="text-slate-600 font-mono tabular-nums">
                          ~{activeNairobiQuote.distanceKm.toFixed(1)} km from Kirinyaga Rd CBD · {activeNairobiQuote.slabs} × 10 km band @ KSh {NAIROBI_DELIVERY_RATE_PER_10KM} = {formatCurrency(activeNairobiQuote.fee)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {deliveryRegion === 'garage_fitting' && (() => {
                const { dateStr: todayNairobi } = getNairobiDateParts();
                const maxBookingDate = addDaysToDateStr(
                  todayNairobi,
                  GARAGE_BOOKING_MAX_DAYS_AHEAD,
                );
                let nextBusinessDay = addDaysToDateStr(todayNairobi, 1);
                if (isSundayDateStr(nextBusinessDay)) {
                  nextBusinessDay = addDaysToDateStr(nextBusinessDay, 1);
                }

                return (
                  <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="fitting-date-input"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900"
                      >
                        <Calendar className="w-3.5 h-3.5 text-orange-600" />
                        <span>Book Fitting Appointment Slot</span>
                      </label>
                      {fittingDate && fittingTimeSlot && !garageDateIsSunday && (
                        <span className="text-[11px] font-semibold text-emerald-700">
                          {formatFittingDateLabel(fittingDate)} · {getGarageSlotLabel(fittingTimeSlot)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="fitting-date-input"
                        type="date"
                        required
                        min={todayNairobi}
                        max={maxBookingDate}
                        value={fittingDate}
                        onChange={(e) => {
                          setFittingDate(e.target.value);
                          setError(null);
                        }}
                        className="flex-1 min-w-[145px] px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                      {!isSundayDateStr(todayNairobi) && (
                        <button
                          type="button"
                          onClick={() => setFittingDate(todayNairobi)}
                          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
                            fittingDate === todayNairobi
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Today
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFittingDate(nextBusinessDay)}
                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
                          fittingDate === nextBusinessDay
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Next Open Day
                      </button>
                    </div>

                    {garageDateIsSunday ? (
                      <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
                        Our fitting garage is closed on Sundays (open Mon–Sat: 7.30am – 6.30pm). Please choose Monday to Saturday.
                      </p>
                    ) : loadingGarageSlots ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-slate-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                        <span>Checking open garage bays...</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-slate-600">
                          Select an open 1-hour bay ({formatFittingDateLabel(fittingDate)}):
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {garageSlots.map((slot) => {
                            const isSelected = fittingTimeSlot === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => {
                                  setFittingTimeSlot(slot.id);
                                  setError(null);
                                }}
                                className={`text-left px-2.5 py-2 rounded-md border text-[11px] transition-colors ${
                                  !slot.available
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : isSelected
                                      ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                                      : 'bg-white border-slate-200 text-slate-800 hover:border-orange-400 hover:bg-orange-50/50'
                                }`}
                              >
                                <div className="font-semibold leading-tight">{slot.label}</div>
                                <div
                                  className={`text-[10px] mt-0.5 ${
                                    !slot.available
                                      ? 'text-slate-400'
                                      : isSelected
                                        ? 'text-orange-100'
                                        : slot.remainingBays === 1
                                          ? 'text-amber-700 font-semibold'
                                          : 'text-emerald-700'
                                  }`}
                                >
                                  {slot.isPast
                                    ? 'Time passed'
                                    : slot.remainingBays === 0
                                      ? 'Fully booked'
                                      : `${slot.remainingBays} ${slot.remainingBays === 1 ? 'bay' : 'bays'} open`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {garageSlots.length > 0 && garageSlots.every((s) => !s.available) && (
                          <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                            No remaining bays on {formatFittingDateLabel(fittingDate)}. Please pick Next Open Day or another date.
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Vehicle Make/Model &amp; Maintenance Note (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={160}
                        value={vehicleDetails}
                        onChange={(e) => setVehicleDetails(e.target.value)}
                        placeholder="e.g. Toyota Fielder KDA 123A · Brake pad fitting"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                    </div>
                  </div>
                );
              })()}

              {deliveryRegion === 'outside_nairobi' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred Courier Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="e.g. G4S, Wells Fargo, Easy Coach, Fargo Courier"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  disabled={Boolean(stkSession || cardSession || mpesaCodeSession)}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                >
                  <option value={PAYMENT_MPESA_STK}>
                    M-Pesa STK Push (Enter PIN on Phone)
                  </option>
                  <option value={PAYMENT_CARD}>
                    Debit / Credit Card (Visa, Mastercard)
                  </option>
                  <option value={PAYMENT_MPESA}>M-Pesa Paybill (247247) — Manual</option>
                  <option value={PAYMENT_BANK}>Bank Transfer</option>
                </select>

                {paymentMethod === PAYMENT_MPESA_STK && !stkSession && (
                  <div className="mt-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-emerald-950">
                          Instant M-Pesa Payment Prompt
                        </p>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                          Receive an M-Pesa prompt directly to enter your PIN for Paybill{' '}
                          <span className="font-mono font-bold">{MPESA_PAYBILL_NUMBER}</span> (Acc:{' '}
                          <span className="font-mono font-bold">{MPESA_ACCOUNT_NUMBER}</span>).
                        </p>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="mpesa-stk-phone"
                        className="block text-[11px] font-semibold text-emerald-900 mb-1"
                      >
                        M-Pesa Phone Number for Prompt
                      </label>
                      <input
                        id="mpesa-stk-phone"
                        type="tel"
                        required
                        value={mpesaPhone}
                        onChange={(e) => {
                          setMpesaPhone(e.target.value);
                          setMpesaPhoneEdited(true);
                        }}
                        placeholder="e.g. 0712345678 or 254712345678"
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === PAYMENT_CARD && !cardSession && (
                  <div className="mt-2.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <CreditCard className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-900">
                            Debit / Credit Card Details
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                            Funds are only deducted from your account after you confirm the payment amount.
                          </p>
                        </div>
                      </div>
                      {cardNumber.replace(/\D/g, '').length >= 1 && (
                        <span className="text-[11px] font-semibold text-slate-700 shrink-0">
                          {detectCardBrandClient(cardNumber.replace(/\D/g, ''))}
                        </span>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="cardholder-name-input"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Cardholder Name
                      </label>
                      <input
                        id="cardholder-name-input"
                        type="text"
                        required
                        autoComplete="cc-name"
                        value={cardholderName}
                        onChange={(e) => {
                          setCardholderName(e.target.value);
                          setCardholderEdited(true);
                        }}
                        placeholder="Name as shown on card"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="card-number-input"
                        className="block text-[11px] font-semibold text-slate-700 mb-1"
                      >
                        Card Number
                      </label>
                      <input
                        id="card-number-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        required
                        maxLength={23}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                        placeholder="4242 4242 4242 4242"
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="card-expiry-input"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          Expiry (MM/YY)
                        </label>
                        <input
                          id="card-expiry-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          required
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatCardExpiryInput(e.target.value))}
                          placeholder="08/28"
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="card-cvv-input"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          CVV / CVC
                        </label>
                        <input
                          id="card-cvv-input"
                          type="password"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          required
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) =>
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="123"
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === PAYMENT_MPESA && (
                  <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                    <p className="font-semibold">M-Pesa Paybill Instructions</p>
                    <p>
                      Paybill Number:{' '}
                      <span className="font-mono font-bold">{MPESA_PAYBILL_NUMBER}</span>
                    </p>
                    <p>
                      Account Number:{' '}
                      <span className="font-mono font-bold">{MPESA_ACCOUNT_NUMBER}</span>
                    </p>
                  </div>
                )}

                {paymentMethod === PAYMENT_BANK && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-900 space-y-1">
                    <p className="font-semibold">Bank Transfer Instructions</p>
                    <p>
                      Account Number:{' '}
                      <span className="font-mono font-bold">{BANK_TRANSFER_ACCOUNT_NUMBER}</span>
                    </p>
                  </div>
                )}

                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-slate-700 flex items-start gap-2 leading-relaxed">
                  <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">Return, Refund &amp; Free Exchange Policy</p>
                    <p className="mt-0.5">{RETURN_EXCHANGE_POLICY_NOTICE}</p>
                  </div>
                </div>
              </div>
            </form>

            {/* Active M-Pesa STK Prompt Panel */}
            {stkSession && (
              <div
                className="rounded-xl border-2 border-emerald-600 bg-slate-900 text-white p-4 space-y-3.5 shadow-lg"
                role="region"
                aria-label="M-Pesa STK Prompt"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                        M-Pesa STK Push
                      </p>
                      <h4 className="font-display text-sm font-bold text-white">
                        Authorize Payment · {formatCurrency(stkSession.amount)}
                      </h4>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-300">
                    +{stkSession.mpesaPhone}
                  </span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 text-xs space-y-1 text-slate-200">
                  <p>
                    Pay to: <strong className="text-white">MY SPARE ZONE</strong>
                  </p>
                  <p>
                    Paybill:{' '}
                    <span className="font-mono font-bold text-white">{stkSession.paybill}</span> ·
                    Acc:{' '}
                    <span className="font-mono font-bold text-white">
                      {stkSession.accountNumber}
                    </span>
                  </p>
                  <p className="text-emerald-300 pt-0.5">{stkSession.customerMessage}</p>
                </div>

                {stkSession.mode === 'prompt' ? (
                  <form onSubmit={handleConfirmStkPin} className="space-y-3">
                    <div>
                      <label
                        htmlFor="mpesa-pin-input"
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 mb-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Enter 4-Digit M-Pesa PIN</span>
                      </label>
                      <input
                        id="mpesa-pin-input"
                        type="password"
                        inputMode="numeric"
                        pattern="\d{4}"
                        maxLength={4}
                        autoFocus
                        required
                        value={mpesaPin}
                        onChange={(e) => setMpesaPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full px-3 py-2.5 text-center text-lg tracking-[0.6em] font-mono bg-white text-slate-900 border border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="submit"
                        disabled={confirmingPin || mpesaPin.length !== 4}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        {confirmingPin ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Confirming Payment...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Confirm PIN & Pay</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelStkPrompt()}
                        className="px-3.5 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-300">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Waiting for M-Pesa PIN confirmation on +{stkSession.mpesaPhone}...</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={checkingStatus}
                        onClick={() => void pollDarajaStatus(stkSession.checkoutRequestId, true)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                        <span>{checkingStatus ? 'Checking...' : 'Check Status'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopPolling();
                          const currentStk = stkSession;
                          setStkSession(null);
                          setMpesaTransactionCode('');
                          setMpesaCodeSession({
                            mode: 'stk',
                            checkoutRequestId: currentStk.checkoutRequestId,
                            amount: currentStk.amount,
                            paybill: currentStk.paybill,
                            accountNumber: currentStk.accountNumber,
                            customerMessage:
                              'Received your Safaricom confirmation SMS? Enter your M-Pesa transaction code below to validate and link it to your VirtualReceipt.',
                          });
                        }}
                        className="px-3 py-2 text-xs font-semibold text-emerald-100 bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-500/60 rounded-lg transition-colors"
                      >
                        Enter M-Pesa Code
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelStkPrompt()}
                        className="px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* M-Pesa Transaction Code Validation Panel */}
            {mpesaCodeSession && (
              <div
                className="rounded-xl border-2 border-emerald-600 bg-slate-900 text-white p-4 space-y-3.5 shadow-lg"
                role="region"
                aria-label="Validate M-Pesa Transaction Code"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                        Step 2 · Validate Payment
                      </p>
                      <h4 className="font-display text-sm font-bold text-white">
                        Enter M-Pesa Transaction Code · {formatCurrency(mpesaCodeSession.amount)}
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 text-xs space-y-1.5 text-slate-200">
                  <p>
                    Paybill:{' '}
                    <span className="font-mono font-bold text-white">{mpesaCodeSession.paybill}</span> ·
                    Acc:{' '}
                    <span className="font-mono font-bold text-white">
                      {mpesaCodeSession.accountNumber}
                    </span>
                  </p>
                  <p className="text-emerald-300 leading-relaxed">
                    {mpesaCodeSession.customerMessage}
                  </p>
                  {mpesaCodeSession.issuedMpesaCode && (
                    <p className="font-mono text-[11px] font-bold text-amber-300 bg-amber-950/50 border border-amber-700/60 rounded px-2.5 py-1.5">
                      M-Pesa Confirmation Code: {mpesaCodeSession.issuedMpesaCode}
                    </p>
                  )}
                </div>

                <form onSubmit={handleVerifyMpesaTransactionCode} className="space-y-3">
                  <div>
                    <label
                      htmlFor="mpesa-transaction-code-input"
                      className="block text-xs font-semibold text-slate-100 mb-1.5"
                    >
                      M-Pesa Transaction Code (8–12 alphanumeric characters)
                    </label>
                    <input
                      id="mpesa-transaction-code-input"
                      type="text"
                      autoFocus
                      required
                      maxLength={12}
                      value={mpesaTransactionCode}
                      onChange={(e) =>
                        setMpesaTransactionCode(
                          e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                        )
                      }
                      placeholder="e.g. SLK8X9M2Q4"
                      className="w-full px-3 py-2.5 text-center text-base tracking-[0.2em] font-mono uppercase bg-white text-slate-900 border border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="submit"
                      disabled={verifyingMpesaCode || mpesaTransactionCode.trim().length < 8}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {verifyingMpesaCode ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Validating &amp; Linking...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Verify Code &amp; Get Receipt</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={verifyingMpesaCode}
                      onClick={() => void handleCancelMpesaCodeVerification()}
                      className="px-3.5 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
            {/* Active Card Payment Confirmation Panel */}
            {cardSession && (
              <div
                className="rounded-xl border-2 border-orange-500 bg-slate-900 text-white p-4 space-y-3.5 shadow-lg"
                role="region"
                aria-label="Card Payment Confirmation"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">
                        Card Payment Authorization
                      </p>
                      <h4 className="font-display text-sm font-bold text-white tabular-nums">
                        Confirm &amp; Deduct · {formatCurrency(cardSession.amount)}
                      </h4>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-300">
                    {cardSession.cardBrand} •••• {cardSession.cardLast4}
                  </span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 text-xs space-y-1 text-slate-200">
                  <p>
                    Merchant: <strong className="text-white">MY SPARE ZONE</strong>
                  </p>
                  <p>
                    Cardholder:{' '}
                    <span className="font-semibold text-white">{cardSession.cardholderName}</span> ·
                    Exp: <span className="font-mono text-white">{cardSession.expiryLabel}</span>
                  </p>
                  <p>
                    Account Charge:{' '}
                    <span className="font-mono tabular-nums font-bold text-orange-300">
                      {formatCurrency(cardSession.amount)}
                    </span>
                  </p>
                  <p className="text-slate-300 pt-0.5">{cardSession.resultDesc}</p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={confirmingCard}
                    onClick={() => void handleConfirmCardPayment()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {confirmingCard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Deducting &amp; Confirming...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Confirm &amp; Pay {formatCurrency(cardSession.amount)}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={confirmingCard}
                    onClick={() => void handleCancelCardPayment()}
                    className="px-3.5 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer CTA */}
        {items.length > 0 && !stkSession && !cardSession && !mpesaCodeSession && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 rounded-lg transition-colors ${
                paymentMethod === PAYMENT_MPESA_STK
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {paymentMethod === PAYMENT_MPESA_STK ? (
                <>
                  <Smartphone className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Sending M-Pesa Prompt...'
                      : `Send M-Pesa Prompt · ${formatCurrency(pricing.total)}`}
                  </span>
                </>
              ) : paymentMethod === PAYMENT_CARD ? (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Validating Card Details...'
                      : `Review & Confirm Card · ${formatCurrency(pricing.total)}`}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {submitting
                      ? 'Generating Receipt...'
                      : `Complete Order · ${formatCurrency(pricing.total)}`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
