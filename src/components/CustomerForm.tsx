import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, RenewalData, firestoreService } from '../services/firestoreService';
import { notificationService } from '../services/notificationService';
import { toast } from 'sonner';
import { format, addDays, differenceInDays, parseISO, isValid } from 'date-fns';
import { safeFormat, safeDifferenceInDays } from '../lib/utils';
import { Calendar, Loader2, Trash2, Clock, Check, Lock, Sparkles, IndianRupee, RotateCcw, CheckCircle2, Percent, History, AlertTriangle, X } from 'lucide-react';

interface CustomerFormProps {
  customer?: Customer; // if provided, we are in Edit mode, New Loan mode, or Renewal mode
  mode?: 'create' | 'edit' | 'new_loan' | 'renewal';
  initialName?: string;
  initialPhone?: string;
  onSave?: (
    customer: Partial<Customer> & { id: string },
    openingBalance?: { amount: number; note?: string; timestamp?: number }
  ) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string, name: string) => void;
  onSuccess?: (updatedCustomer: Customer) => void;
}

export function CustomerForm({ 
  customer, 
  mode, 
  initialName = '', 
  initialPhone = '', 
  onSave, 
  onCancel, 
  onDelete, 
  onSuccess 
}: CustomerFormProps) {
  const isRenewal = mode === 'renewal';
  const isNewLoan = mode === 'new_loan' || isRenewal;
  const isEdit = !isNewLoan && !isRenewal && !!customer;

  const currentCycle = customer?.currentCycle || 1;
  const nextCycle = currentCycle + 1;
  const prevLoan = customer?.loanAmount || customer?.loan || 10000;
  const prevPending = Math.max(0, customer?.pending !== undefined ? customer.pending : ((customer?.loanAmount || customer?.loan || 0) - (customer?.paid || 0)));
  const accruedAdvance = customer?.advanceBalance || 0;

  const [formData, setFormData] = useState(() => {
    if (isNewLoan && customer) {
      const dur = customer.durationDays || 100;
      const initialFreqDays = customer.frequencyDays || 1;
      const initialFreq = customer.frequency || (initialFreqDays === 7 ? 'weekly' : initialFreqDays === 30 ? 'monthly' : 'daily');
      const defaultLoanAmt = prevPending > 0 ? prevPending : prevLoan;
      return {
        name: customer.name || '',
        phone: customer.phone || '',
        loan: defaultLoanAmt,
        notes: isRenewal
          ? `Loan Renewal`
          : (accruedAdvance > 0 
              ? `New Loan (₹${accruedAdvance.toLocaleString('en-IN')} Advance Applied)` 
              : `New Loan`),
        startDate: format(new Date(), 'yyyy-MM-dd'),
        duration: dur,
        frequency: initialFreq,
        frequencyDays: initialFreqDays,
      };
    }

    if (isEdit && customer) {
      const dur = customer.endDate && customer.startDate ? safeDifferenceInDays(customer.endDate, customer.startDate) + 1 : 100;
      const initialFreqDays = customer.frequencyDays || (dur === 7 ? 7 : dur === 30 ? 30 : dur === 1 ? 1 : 1);
      const initialFreq = customer.frequency || (initialFreqDays === 7 ? 'weekly' : initialFreqDays === 30 ? 'monthly' : 'daily');
      return {
        name: customer.name || '',
        phone: customer.phone || '',
        loan: customer.loanAmount || customer.loan || 0,
        notes: customer.notes || '',
        startDate: safeFormat(customer.startDate, 'yyyy-MM-dd', format(new Date(), 'yyyy-MM-dd')),
        duration: dur,
        frequency: initialFreq,
        frequencyDays: initialFreqDays,
      };
    }

    const saved = localStorage.getItem('pigmy_draft_new_customer');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          name: initialName || parsed.name || '',
          phone: initialPhone || parsed.phone || '',
          frequency: parsed.frequency || 'daily',
          frequencyDays: parsed.frequencyDays || 1,
        };
      } catch (e) {
        // fallback
      }
    }
    return { 
      name: initialName || '', 
      phone: initialPhone || '', 
      loan: '', 
      notes: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      duration: 100,
      frequency: 'daily',
      frequencyDays: 1,
    };
  });

  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(() => {
    if (customer?.phoneNumbers && Array.isArray(customer.phoneNumbers) && customer.phoneNumbers.length > 0) {
      return customer.phoneNumbers;
    }
    if (customer?.phone) {
      return [customer.phone];
    }
    return initialPhone ? [initialPhone] : [''];
  });

  const principalAmountNum = Number(formData.loan) || 0;
  const paidAmount = customer?.paid || 0;
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  // Interest management: default to enabled for Renewal (and optionally in new loans), default 3% rate & calculated amount, both editable
  const [hasInterest, setHasInterest] = useState<boolean>(() => isRenewal);
  const [interestRate, setInterestRate] = useState<number>(3); // Default 3%
  const [interestAmount, setInterestAmount] = useState<number>(() => {
    const base = Number(formData.loan) || 0;
    return isRenewal ? Math.round(base * 0.03) : 0;
  });

  // Keep interest amount synced when principal changes (if user hasn't explicitly set a custom flat amount)
  const handlePrincipalChange = (newPrincipalStr: string) => {
    const newPrincipal = Number(newPrincipalStr) || 0;
    setFormData(prev => ({ ...prev, loan: newPrincipalStr }));
    if (hasInterest && interestRate >= 0) {
      setInterestAmount(Math.round(newPrincipal * (interestRate / 100)));
    }
  };

  // When interest rate % is edited: auto-update interest amount
  const handleInterestRateChange = (newRate: number) => {
    setInterestRate(newRate);
    const amt = Math.round(principalAmountNum * (newRate / 100));
    setInterestAmount(amt);
  };

  // When interest amount (₹) is edited: auto-update interest rate %
  const handleInterestAmountChange = (newAmt: number) => {
    setInterestAmount(newAmt);
    if (principalAmountNum > 0) {
      const calculatedRate = Number(((newAmt / principalAmountNum) * 100).toFixed(2));
      setInterestRate(calculatedRate);
    }
  };

  // Total Loan Amount = Principal + Interest Amount
  const totalLoanWithInterest = useMemo(() => {
    if (!hasInterest) return principalAmountNum;
    return principalAmountNum + (Number(interestAmount) || 0);
  }, [principalAmountNum, hasInterest, interestAmount]);

  // Advance credit application for new loan / renewal
  const [applyAdvance, setApplyAdvance] = useState<boolean>(() => isNewLoan && accruedAdvance > 0);
  const [customAdvanceToApply, setCustomAdvanceToApply] = useState<number>(() => accruedAdvance);

  const effectiveAdvanceToApply = (isNewLoan && applyAdvance)
    ? Math.min(accruedAdvance, Math.max(0, customAdvanceToApply))
    : 0;

  const netOpeningPending = Math.max(0, totalLoanWithInterest - effectiveAdvanceToApply);

  const [idSuffix, setIdSuffix] = useState(() => {
    if ((isEdit || isNewLoan) && customer) {
      if (typeof customer.id === 'string' && customer.id.includes('-')) {
        return customer.id.split('-')[1];
      }
      return String(customer.id.replace('CUST-', ''));
    }
    return '001';
  });

  const [isSyncingId, setIsSyncingId] = useState(false);
  const [isIdUnique, setIsIdUnique] = useState(true);
  const [isIdRecycled, setIsIdRecycled] = useState(false);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoanFocused, setIsLoanFocused] = useState(false);
  const [isDurationFocused, setIsDurationFocused] = useState(false);
  const [isCustomFrequency, setIsCustomFrequency] = useState(
    formData.frequencyDays !== 1 && formData.frequencyDays !== 7 && formData.frequencyDays !== 30
  );

  const loanBoxRef = useRef<HTMLDivElement | null>(null);
  const durationBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideInteraction = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (loanBoxRef.current && !loanBoxRef.current.contains(target)) {
        setIsLoanFocused(false);
      }
      if (durationBoxRef.current && !durationBoxRef.current.contains(target)) {
        setIsDurationFocused(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
    };
  }, []);

  const fullId = useMemo(() => {
    if ((isEdit || isNewLoan) && customer) return customer.id;
    return `CUST-${idSuffix.padStart(3, '0')}`;
  }, [idSuffix, isEdit, isNewLoan, customer]);

  const endDate = useMemo(() => {
    const start = parseISO(formData.startDate);
    if (!isValid(start)) return '';
    return format(addDays(start, (formData.duration || 1) - 1), 'yyyy-MM-dd');
  }, [formData.startDate, formData.duration]);

  useEffect(() => {
    if (isEdit || isNewLoan) return;
    const fetchId = async () => {
      setIsSyncingId(true);
      const nextIdFull = await firestoreService.getNextCustomerId();
      const suffix = nextIdFull.split('-')[1];
      setIdSuffix(suffix);
      setIsSyncingId(false);
    };
    fetchId();
  }, [isEdit, isNewLoan]);

  useEffect(() => {
    if (isEdit || isNewLoan) return;
    if (idSuffix.length >= 1) {
      const check = async () => {
        setIsCheckingId(true);
        const availability = await firestoreService.checkIdAvailability(fullId);
        setIsIdUnique(availability.available);
        setIsIdRecycled(availability.isRecycled);
        setIsCheckingId(false);
      };
      check();
    }
  }, [fullId, isEdit, isNewLoan, idSuffix]);

  useEffect(() => {
    if (!isEdit && !isNewLoan) {
      localStorage.setItem('pigmy_draft_new_customer', JSON.stringify(formData));
    }
  }, [formData, isEdit, isNewLoan]);

  const [duplicateLoanError, setDuplicateLoanError] = useState<{ exists: boolean; existingLoanId?: string; reason?: string } | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  useEffect(() => {
    if (isNewLoan || isEdit) return;
    const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10);
    const cleanName = formData.name.trim();

    if (cleanName.length >= 2 && cleanPhone.length === 10) {
      setIsCheckingDuplicate(true);
      firestoreService.checkDuplicateCustomer(
        cleanName,
        cleanPhone
      ).then(result => {
        if (!result.allowed) {
          setDuplicateLoanError({
            exists: true,
            existingLoanId: result.existingLoanId,
            reason: result.reason
          });
        } else {
          setDuplicateLoanError(null);
        }
      }).catch(() => {
        setDuplicateLoanError(null);
      }).finally(() => {
        setIsCheckingDuplicate(false);
      });
    } else {
      setDuplicateLoanError(null);
      setIsCheckingDuplicate(false);
    }
  }, [formData.name, formData.phone, isNewLoan, isEdit]);

  const quickAmounts = [10000, 15000, 20000, 25000, 50000];
  const quickInterestRates = [1, 2, 3, 5, 10];
  
  // Frequency presets with number of days (1, 7, 30 days)
  const frequencyOptions = [
    { key: 'daily', label: 'Daily', days: 1, tag: '1 Day' },
    { key: 'weekly', label: 'Weekly', days: 7, tag: '7 Days' },
    { key: 'monthly', label: 'Monthly', days: 30, tag: '30 Days' },
  ];

  // Preset durations with exact number of days
  const durationPresets = [
    { label: '50 Days', days: 50 },
    { label: '100 Days', days: 100 },
    { label: '120 Days', days: 120 },
    { label: '150 Days', days: 150 },
    { label: '200 Days', days: 200 },
  ];

  // Calculate estimated installment based on total loan (Principal + Interest)
  const estimatedInstallment = useMemo(() => {
    if (!totalLoanWithInterest || !formData.duration) return 0;
    const freqDays = Math.max(1, formData.frequencyDays || 1);
    const numInstallments = Math.max(1, Math.round(formData.duration / freqDays));
    return Math.round(totalLoanWithInterest / numInstallments);
  }, [totalLoanWithInterest, formData.duration, formData.frequencyDays]);

  // Existing Customer with Prior Repayments (e.g. ₹20,000 loan with ₹14,000 pending and ₹6,000 already collected)
  const [isExistingLoan, setIsExistingLoan] = useState<boolean>(false);
  const [pendingBalanceInput, setPendingBalanceInput] = useState<string>('');
  const [inputMode, setInputMode] = useState<'pending' | 'paid'>('pending');
  const [alreadyPaidInput, setAlreadyPaidInput] = useState<string>('');
  const [openingBalanceNote, setOpeningBalanceNote] = useState<string>('');

  const existingPendingNum = useMemo(() => {
    if (!isExistingLoan) return totalLoanWithInterest;
    if (inputMode === 'pending') {
      if (pendingBalanceInput === '') return totalLoanWithInterest;
      const parsed = Number(pendingBalanceInput);
      return Math.max(0, Math.min(totalLoanWithInterest, isNaN(parsed) ? totalLoanWithInterest : parsed));
    } else {
      const parsedPaid = Number(alreadyPaidInput);
      const paidNum = Math.max(0, Math.min(totalLoanWithInterest, isNaN(parsedPaid) ? 0 : parsedPaid));
      return Math.max(0, totalLoanWithInterest - paidNum);
    }
  }, [isExistingLoan, inputMode, pendingBalanceInput, alreadyPaidInput, totalLoanWithInterest]);

  const existingPaidNum = useMemo(() => {
    if (!isExistingLoan) return 0;
    return Math.max(0, totalLoanWithInterest - existingPendingNum);
  }, [isExistingLoan, totalLoanWithInterest, existingPendingNum]);

  const priorInstallmentsPaid = useMemo(() => {
    if (!estimatedInstallment || estimatedInstallment <= 0) return 0;
    return Math.round(existingPaidNum / estimatedInstallment);
  }, [existingPaidNum, estimatedInstallment]);

  const remainingInstallmentsCount = useMemo(() => {
    if (!estimatedInstallment || estimatedInstallment <= 0) return 0;
    return Math.round(existingPendingNum / estimatedInstallment);
  }, [existingPendingNum, estimatedInstallment]);

  const repaymentProgressPct = useMemo(() => {
    if (!totalLoanWithInterest || totalLoanWithInterest <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((existingPaidNum / totalLoanWithInterest) * 100)));
  }, [existingPaidNum, totalLoanWithInterest]);

  const handlePendingBalanceChange = (val: string) => {
    setPendingBalanceInput(val);
    const num = Number(val);
    if (!isNaN(num) && val !== '') {
      const paid = Math.max(0, totalLoanWithInterest - num);
      setAlreadyPaidInput(paid > 0 ? paid.toString() : '0');
    } else {
      setAlreadyPaidInput('');
    }
  };

  const handleAlreadyPaidChange = (val: string) => {
    setAlreadyPaidInput(val);
    const num = Number(val);
    if (!isNaN(num) && val !== '') {
      const pending = Math.max(0, totalLoanWithInterest - num);
      setPendingBalanceInput(pending.toString());
    } else {
      setPendingBalanceInput(totalLoanWithInterest.toString());
    }
  };

  const handlePresetPercentagePaid = (pct: number) => {
    const paid = Math.round(totalLoanWithInterest * (pct / 100));
    const pending = Math.max(0, totalLoanWithInterest - paid);
    setPendingBalanceInput(pending.toString());
    setAlreadyPaidInput(paid.toString());
  };

  const handlePresetDaysPaid = (days: number) => {
    if (!estimatedInstallment) return;
    const paid = Math.min(totalLoanWithInterest, days * estimatedInstallment);
    const pending = Math.max(0, totalLoanWithInterest - paid);
    setPendingBalanceInput(pending.toString());
    setAlreadyPaidInput(paid.toString());
  };

  const handlePhoneChange = (val: string) => {
    if (isNewLoan) return;
    const numeric = String(val || '').replace(/\D/g, '').slice(0, 10);
    setFormData({ ...formData, phone: numeric });
  };

  const handleIdChange = (val: string) => {
    if (isNewLoan || isEdit) return;
    const numeric = String(val || '').replace(/\D/g, '').slice(0, 3);
    setIdSuffix(numeric);
  };

  const handleEndDateChange = (val: string) => {
    const start = parseISO(formData.startDate);
    const end = parseISO(val);
    if (isValid(start) && isValid(end)) {
      const diff = differenceInDays(end, start) + 1;
      setFormData({ ...formData, duration: diff > 0 ? diff : 1 });
    }
  };

  const handleSelectFrequency = (freqKey: string, days: number) => {
    setIsCustomFrequency(false);
    setFormData(prev => ({
      ...prev,
      frequency: freqKey,
      frequencyDays: days,
    }));
  };

  const handleSelectDurationDays = (days: number) => {
    setFormData(prev => ({
      ...prev,
      duration: days,
      frequency: days === 1 ? 'daily' : days === 7 ? 'weekly' : days === 30 ? 'monthly' : prev.frequency,
      frequencyDays: days === 1 ? 1 : days === 7 ? 7 : days === 30 ? 30 : prev.frequencyDays,
    }));
    if (days === 1 || days === 7 || days === 30) {
      setIsCustomFrequency(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    // Validate New Loan or Renewal flow
    if (isNewLoan) {
      if (!customer) {
        toast.error('Customer reference missing for loan renewal');
        return;
      }
      if (totalLoanWithInterest < 0) {
        toast.error('Please enter a valid loan amount (>= ₹0)');
        return;
      }
      if (totalLoanWithInterest > 0 && (formData.duration || 0) < 1) {
        toast.error('Loan tenure must be at least 1 day');
        return;
      }

      setIsSubmitting(true);
      try {
        const startParsed = parseISO(formData.startDate);
        const startMs = isValid(startParsed) ? startParsed.getTime() : Date.now();
        const endParsed = parseISO(endDate);
        const endMs = isValid(endParsed) && totalLoanWithInterest > 0 ? endParsed.getTime() : startMs;

        const defaultNotes = isRenewal
          ? `Loan Renewal (Principal ₹${principalAmountNum.toLocaleString('en-IN')}${hasInterest && interestAmount > 0 ? ` + ₹${interestAmount.toLocaleString('en-IN')} Interest @ ${interestRate}%` : ''})`
          : (effectiveAdvanceToApply > 0 ? `New Loan (₹${effectiveAdvanceToApply.toLocaleString('en-IN')} Advance Applied)` : `New Loan`);

        const payload: RenewalData = {
          newLoanAmount: totalLoanWithInterest,
          durationDays: totalLoanWithInterest > 0 ? (formData.duration || 100) : 0,
          startDate: startMs,
          endDate: endMs,
          rolloverAction: prevPending > 0 ? 'absorbed' : 'cleared',
          frequency: totalLoanWithInterest > 0 ? formData.frequency as any : 'daily',
          frequencyDays: totalLoanWithInterest > 0 ? (formData.frequencyDays || 1) : 1,
          advanceApplied: effectiveAdvanceToApply,
          interestRate: hasInterest ? interestRate : undefined,
          interestAmount: hasInterest ? interestAmount : undefined,
          notes: (formData.notes || '').trim() || defaultNotes
        };

        const updatedCustomer = await firestoreService.renewCustomerLoan(customer, payload);

        // Notify Android system notification center
        notificationService.notifyNewLoanIssued(
          customer.name,
          nextCycle,
          totalLoanWithInterest,
          formData.duration || 100,
          estimatedInstallment,
          customer.id,
          customer.phone
        ).catch((err) => console.warn('Could not post renewal notification:', err));

        if (effectiveAdvanceToApply > 0) {
          toast.success(`🎉 ${isRenewal ? 'Loan renewed' : 'New Loan started'} for ${customer.name}! ₹${effectiveAdvanceToApply.toLocaleString('en-IN')} Advance applied.`);
        } else {
          toast.success(`🎉 ${isRenewal ? 'Loan renewed' : 'New Loan started'} for ${customer.name}!`);
        }

        if (onSuccess) onSuccess(updatedCustomer);
        if (onSave) {
          await onSave({
            id: customer.id,
            loanAmount: totalLoanWithInterest,
            loan: totalLoanWithInterest,
            pending: netOpeningPending
          });
        }
        onCancel();
      } catch (err: any) {
        console.error('Failed to issue/renew loan:', err);
        toast.error(err?.message || 'Failed to renew loan cycle.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const primaryPhone = phoneNumbers[0] ? phoneNumbers[0].replace(/\D/g, '').slice(-10) : '';
    const cleanedPhoneNumbers = phoneNumbers.map(p => p.replace(/\D/g, '').slice(-10)).filter(p => p.length > 0);

    if (!formData.name || (!isIdUnique && !isEdit) || Number(formData.loan) < 0) {
      if (Number(formData.loan) < 0) toast.error('Enter valid loan amount (>= ₹0)');
      if (!isIdUnique && !isEdit) toast.error('ID already used');
      return;
    }

    const normalizedName = formData.name.trim();
    const normalizedPhone = primaryPhone;
    
    if (normalizedPhone.length === 10 && (!isEdit || normalizedName !== customer?.name || normalizedPhone !== customer?.phone)) {
      const checkResult = await firestoreService.checkDuplicateCustomer(
        normalizedName, 
        normalizedPhone, 
        customer?.id
      );
      if (!checkResult.allowed) {
        toast.error(checkResult.reason || 'Dual loan not allowed for same name and phone number.');
        return;
      }
      const phoneCheck = await firestoreService.checkPhoneExists(normalizedPhone);
      if (phoneCheck.exists && phoneCheck.name?.toLowerCase() !== normalizedName.toLowerCase()) {
        toast.info(`Notice: Phone number also in use by "${phoneCheck.name}".`);
      }
    }

    const finalLoanAmt = totalLoanWithInterest;
    const startMs = finalLoanAmt > 0 ? (parseISO(formData.startDate).getTime() || Date.now()) : 0;
    const endMs = finalLoanAmt > 0 ? parseISO(endDate).getTime() : 0;
    const finalDuration = finalLoanAmt > 0 ? (formData.duration || 100) : 0;
    const finalFreq = finalLoanAmt > 0 ? formData.frequency : '';
    const finalFreqDays = finalLoanAmt > 0 ? (formData.frequencyDays || 1) : 0;

    const uniqueKey = `${normalizedName.toLowerCase()}_${normalizedPhone}_loan`;
    
    setIsSubmitting(true);
    try {
      if (isEdit && customer) {
        if (onSave) {
          await onSave({
            id: customer.id,
            name: normalizedName,
            phone: normalizedPhone,
            phoneNumbers: cleanedPhoneNumbers,
            loanAmount: finalLoanAmt,
            loan: finalLoanAmt,
            pending: Math.max(0, finalLoanAmt - (customer.paid || 0)),
            advanceBalance: customer.advanceBalance,
            startDate: startMs,
            endDate: endMs,
            frequency: finalFreq,
            frequencyDays: finalFreqDays,
            durationDays: finalDuration,
            notes: formData.notes
          });
        }
        toast.success(`Changes to ${normalizedName} saved`);
        setShowSuccessAnim(true);
        setTimeout(() => {
          onCancel();
        }, 900);
      } else {
        const priorPaidAmount = isExistingLoan ? existingPaidNum : 0;
        const initialPendingAmt = isExistingLoan ? existingPendingNum : finalLoanAmt;

        const openingBalanceData = (isExistingLoan && priorPaidAmount > 0) ? {
          amount: priorPaidAmount,
          note: openingBalanceNote.trim() || `Opening Balance: Prior loan collections (${priorInstallmentsPaid} days @ ₹${estimatedInstallment || 1}/day)`,
          timestamp: startMs
        } : undefined;

        if (onSave) {
          await onSave({
            id: fullId,
            name: normalizedName,
            phone: normalizedPhone,
            phoneNumbers: cleanedPhoneNumbers,
            loan: finalLoanAmt,
            loanAmount: finalLoanAmt,
            paid: priorPaidAmount,
            pending: initialPendingAmt,
            advanceBalance: 0,
            startDate: startMs,
            endDate: endMs,
            frequency: finalFreq,
            frequencyDays: finalFreqDays,
            durationDays: finalDuration,
            notes: formData.notes,
            uniqueKey,
            hasOpeningBalance: isExistingLoan && priorPaidAmount > 0,
            openingBalance: isExistingLoan && priorPaidAmount > 0 ? priorPaidAmount : undefined
          }, openingBalanceData);
        }
        toast.success(
          isExistingLoan && priorPaidAmount > 0
            ? `${normalizedName} (${fullId}) registered with ₹${priorPaidAmount.toLocaleString('en-IN')} opening collections`
            : `${normalizedName} (${fullId}) created`
        );
        localStorage.removeItem('pigmy_draft_new_customer');
        setShowSuccessAnim(true);
        setTimeout(() => {
          onCancel();
        }, 900);
      }
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${isEdit ? 'update' : 'create'} customer.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const frequencyDisplayLabel = useMemo(() => {
    if (formData.frequencyDays === 1) return 'Daily (1 Day)';
    if (formData.frequencyDays === 7) return 'Weekly (7 Days)';
    if (formData.frequencyDays === 30) return 'Monthly (30 Days)';
    return `Every ${formData.frequencyDays} Days`;
  }, [formData.frequencyDays]);

  return (
    <div className="flex flex-col gap-6 h-full pb-[100px]">
      {/* Live Preview Card */}
      <div className="bg-card/50 backdrop-blur-md p-5 rounded-[32px] border border-border/50 flex flex-col gap-4 shadow-sm mx-1">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent text-white flex items-center justify-center font-black text-xl shadow-lg shadow-accent/20 shrink-0">
            {formData.name ? formData.name.charAt(0).toUpperCase() : '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-text-primary tracking-tight truncate">
                {formData.name || 'Borrower Name'}
              </h3>
              {isNewLoan && (
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border shrink-0 ${
                  isRenewal 
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                }`}>
                  {isRenewal ? 'Loan Renewal' : 'New Loan'}
                </span>
              )}
            </div>
            <p className="text-[11px] font-bold text-text-secondary opacity-60 uppercase tracking-widest mt-0.5">
              {formData.phone ? `+91 ${formData.phone}` : 'Enter Phone'}
            </p>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-accent/10 text-accent border border-accent/20 shrink-0">
            {frequencyDisplayLabel}
          </span>
        </div>

        {/* Prior cycle info / Advance credit preview for new loan & renewal */}
        {isNewLoan && (
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            {prevPending > 0 ? (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <RotateCcw size={15} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Previous Unpaid Balance
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                  ₹{prevPending.toLocaleString('en-IN')}
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Previous Loan Fully Cleared
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                  ₹0 Due
                </span>
              </div>
            )}

            {accruedAdvance > 0 && (
              <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee size={15} className="text-sky-600 dark:text-sky-400" />
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                      Accumulated Advance Savings
                    </span>
                  </div>
                  <span className="font-mono font-black text-sm text-sky-600 dark:text-sky-400">
                    ₹{accruedAdvance.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-sky-500/20">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyAdvance}
                      onChange={(e) => setApplyAdvance(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-border cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-text-primary">
                      Apply as initial credit
                    </span>
                  </label>
                  {applyAdvance && (
                    <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                      -₹{effectiveAdvanceToApply.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing Loan with Prior Repayments Live Preview */}
        {!isNewLoan && isExistingLoan && existingPaidNum > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Existing Loan Progress ({repaymentProgressPct}% Cleared)
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                  ₹{existingPaidNum.toLocaleString('en-IN')} Paid
                </span>
              </div>
              <div className="w-full bg-emerald-950/20 rounded-full h-2 overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${repaymentProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">~{priorInstallmentsPaid} days collected</span>
                <span className="font-black text-amber-600 dark:text-amber-400">₹{existingPendingNum.toLocaleString('en-IN')} pending ({remainingInstallmentsCount} days)</span>
              </div>
            </div>
          </div>
        )}

        {/* Financial Highlights */}
        <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-4 mt-1">
          <div>
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">
              {isExistingLoan && existingPaidNum > 0
                ? 'Pending Due'
                : (hasInterest && interestAmount > 0 ? 'Total Due' : (isNewLoan && effectiveAdvanceToApply > 0 ? 'Opening Due' : 'Total Loan'))}
            </p>
            <p className="text-lg font-black text-text-primary tracking-tighter font-mono">
              ₹{(isExistingLoan && existingPaidNum > 0
                ? existingPendingNum
                : (isNewLoan && effectiveAdvanceToApply > 0 ? netOpeningPending : totalLoanWithInterest)
              ).toLocaleString()}
            </p>
            {hasInterest && interestAmount > 0 ? (
              <p className="text-[10px] font-bold text-accent font-mono">
                incl. ₹{interestAmount.toLocaleString()} ({interestRate}%)
              </p>
            ) : isExistingLoan && existingPaidNum > 0 ? (
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{existingPaidNum.toLocaleString()} already paid
              </p>
            ) : null}
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">Tenure</p>
            <p className="text-lg font-black text-text-primary tracking-tighter font-mono">
              {formData.duration} Days
            </p>
            {isExistingLoan && remainingInstallmentsCount > 0 && (
              <p className="text-[10px] font-bold text-text-secondary font-mono">
                {remainingInstallmentsCount} days left
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">
              Est. Installment
            </p>
            <p className="text-lg font-black text-accent tracking-tighter font-mono">
              ₹{estimatedInstallment.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Real-time Dual Loan Warning Banner */}
      {duplicateLoanError?.exists && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col gap-3 mx-1">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={16} />
            </div>
            <div className="min-w-0">
              <h5 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Dual Loan Not Allowed
              </h5>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                An active loan already exists for <strong>{formData.name}</strong> (+91 {formData.phone.replace(/\D/g, '').slice(-10)}) under ID <strong>{duplicateLoanError.existingLoanId}</strong>. You cannot create a dual loan using the same name and phone number.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 space-y-6 px-1">
        {/* Section 1: Core Identity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-black text-accent uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Core Identity
            </h4>
            {isNewLoan && (
              <span className="text-[10px] font-bold text-text-secondary flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full border border-border/60">
                <Lock size={11} className="text-accent" />
                <span>Locked to borrower</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-1">
              <label htmlFor="customer-input-name" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 flex items-center justify-between">
                <span>Full Name</span>
                {isNewLoan && <span className="text-[9px] font-bold lowercase opacity-70">(uneditable for {isRenewal ? 'renewal' : 'new loan'})</span>}
              </label>
              <div className="relative">
                <input
                  id="customer-input-name"
                  type="text"
                  required
                  aria-required="true"
                  aria-label="Borrower full name"
                  disabled={isNewLoan}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full bg-bg border border-border/60 rounded-2xl h-14 px-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold ${
                    isNewLoan ? 'opacity-70 cursor-not-allowed bg-muted/40 text-text-secondary select-none' : ''
                  }`}
                  placeholder="Borrower's Name"
                />
                {isNewLoan && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 pointer-events-none" aria-hidden="true">
                    <Lock size={16} />
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 flex items-center justify-between">
                <span>Phone Numbers (Optional)</span>
                {!isNewLoan && phoneNumbers[0] && phoneNumbers[0].trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPhoneNumbers(prev => [...prev, ''])}
                    className="text-[10px] font-bold text-accent hover:underline lowercase cursor-pointer"
                  >
                    + Add Phone
                  </button>
                )}
                {isNewLoan && <span className="text-[9px] font-bold lowercase opacity-70">(uneditable for {isRenewal ? 'renewal' : 'new loan'})</span>}
              </div>
              <div className="space-y-2.5">
                {phoneNumbers.map((num, idx) => (
                  <div key={idx} className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-text-secondary opacity-40" aria-hidden="true">+91</span>
                      <input
                        type="tel"
                        aria-label={`Phone number ${idx + 1}`}
                        disabled={isNewLoan}
                        value={num}
                        onChange={e => {
                          const numeric = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhoneNumbers(prev => {
                            const updated = [...prev];
                            updated[idx] = numeric;
                            return updated;
                          });
                          setFormData(f => ({ ...f, phone: numeric }));
                        }}
                        className={`w-full bg-bg border border-border/60 rounded-2xl h-14 pl-14 pr-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold ${
                          isNewLoan ? 'opacity-70 cursor-not-allowed bg-muted/40 text-text-secondary select-none' : ''
                        }`}
                        placeholder="10-digit number (optional)"
                      />
                    </div>
                    {!isNewLoan && phoneNumbers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneNumbers(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-3.5 rounded-2xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors cursor-pointer shrink-0"
                        title="Remove phone"
                        aria-label="Remove phone number"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex justify-between items-end mb-1.5 ml-1">
                <label htmlFor="customer-input-id-suffix" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em]">
                  Account ID
                </label>
                {!isEdit && !isNewLoan && (
                  <div className="flex items-center gap-1.5">
                    {isCheckingId ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-60">Checking...</span>
                    ) : isIdUnique ? (
                      isIdRecycled ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                          <RotateCcw size={10} className="stroke-[2.5]" />
                          <span>Recycling ID: {fullId}</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest text-success" role="status">
                          Available
                        </span>
                      )
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-danger" role="status">
                        Taken
                      </span>
                    )}
                  </div>
                )}
                {isNewLoan && (
                  <span className="text-[9px] font-bold text-text-secondary opacity-70">
                    Existing Account
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-card border-y border-l border-border/60 rounded-l-2xl flex items-center justify-center pointer-events-none z-10" aria-hidden="true">
                  <span className="text-[12px] font-black text-text-primary tracking-widest">CUST-</span>
                </div>
                <input
                  id="customer-input-id-suffix"
                  type="number"
                  min="1"
                  max="999"
                  required
                  aria-required="true"
                  aria-label="Account ID suffix"
                  readOnly={isEdit || isNewLoan}
                  disabled={isNewLoan}
                  value={idSuffix}
                  onChange={e => handleIdChange(e.target.value)}
                  className={`w-full bg-bg border ${
                    !isIdUnique && !isEdit && !isNewLoan 
                      ? 'border-danger/50 focus:border-danger' 
                      : (isIdRecycled && isIdUnique && !isEdit && !isNewLoan 
                          ? 'border-emerald-500/60 focus:border-emerald-500 bg-emerald-500/[0.03]' 
                          : 'border-border/60 focus:border-accent')
                  } rounded-2xl h-14 pl-[5.5rem] pr-10 focus:outline-none focus:ring-4 transition-all text-[15px] font-black tracking-widest ${
                    isEdit || isNewLoan ? 'opacity-70 cursor-not-allowed bg-muted/40' : ''
                  }`}
                  placeholder="001"
                />
                {!isEdit && !isNewLoan && isSyncingId && (
                  <div className="absolute right-4" aria-hidden="true">
                    <Loader2 size={16} className="text-text-secondary opacity-50 animate-spin" />
                  </div>
                )}
                {isNewLoan && (
                  <div className="absolute right-4 text-text-secondary opacity-40 pointer-events-none" aria-hidden="true">
                    <Lock size={16} />
                  </div>
                )}
              </div>

              {/* Prominent status indicator when recycling a previously deleted ID */}
              {!isEdit && !isNewLoan && isIdUnique && isIdRecycled && (
                <div className="mt-2.5 flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <RotateCcw size={13} className="stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black tracking-tight text-emerald-900 dark:text-emerald-100">
                        Recycling ID: {fullId}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        Deleted ID Reused
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80 font-medium leading-relaxed mt-0.5">
                      This ID was previously deleted and is now available for reuse. Saving will start a clean, fresh ledger for this customer.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Section 2: Financials & Collection Schedule */}
        <div>
          <h4 className="text-[11px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Financials & Schedule
          </h4>
          <div className="space-y-5">
            {/* Principal / Loan Amount with Quick Amounts inside and Interest Button beside */}
              <div>
                <label htmlFor="customer-input-loan" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 flex items-center justify-between">
                  <span>
                    {isRenewal 
                        ? `Renewal Principal` 
                        : (isNewLoan ? `New Loan Principal` : 'Loan Amount')}
                  </span>
                  {principalAmountNum > 0 && (
                    <span className="text-xs font-mono font-black text-accent tracking-tight">
                      ₹{principalAmountNum.toLocaleString('en-IN')}
                    </span>
                  )}
                </label>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div 
                      ref={loanBoxRef}
                      className={`relative bg-bg border rounded-2xl transition-all duration-200 cursor-text ${
                        isLoanFocused 
                          ? 'border-accent ring-4 ring-accent/5 p-3.5' 
                          : 'border-border/60 hover:border-border/90 px-3.5 h-14 flex flex-col justify-center'
                      }`}
                      onClick={() => {
                        const inputEl = document.getElementById('customer-input-loan');
                        if (inputEl) inputEl.focus();
                        setIsLoanFocused(true);
                      }}
                    >
                      {/* Amount input row */}
                      <div className="flex items-center w-full">
                        <span className="text-[18px] font-black text-accent shrink-0 mr-2 select-none" aria-hidden="true">
                          ₹
                        </span>
                        <input
                          id="customer-input-loan"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          required
                          aria-required="true"
                          aria-label="Loan principal amount in Rupees"
                          value={formData.loan}
                          onFocus={() => setIsLoanFocused(true)}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            handlePrincipalChange(val);
                          }}
                          className="flex-1 min-w-0 bg-transparent focus:outline-none text-[20px] font-black font-mono text-text-primary placeholder:text-text-secondary/30 tracking-tight"
                          placeholder="Enter amount e.g. 25000"
                        />
                        {formData.loan !== '' && Number(formData.loan) > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrincipalChange('');
                            }}
                            aria-label="Clear loan amount"
                            className="p-1.5 ml-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-muted transition-colors"
                          >
                            <X size={16} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>

                      {/* Quick amounts preset pills */}
                      <AnimatePresence>
                        {isLoanFocused && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="pt-2.5 mt-2.5 border-t border-border/40 overflow-hidden"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary opacity-60">
                                Preset Amounts
                              </span>
                              {principalAmountNum > 0 && (
                                <span className="text-[10px] font-mono font-bold text-accent">
                                  ₹{principalAmountNum.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <div 
                              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" 
                              role="group" 
                              aria-label="Quick preset amounts"
                            >
                              {quickAmounts.map(amount => {
                                const isSelected = principalAmountNum === amount;
                                return (
                                  <button
                                    key={amount}
                                    type="button"
                                    aria-label={`Set amount to ₹${amount.toLocaleString('en-IN')}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handlePrincipalChange(amount.toString());
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono shrink-0 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-accent text-white shadow-xs font-black scale-102'
                                        : 'bg-muted/80 hover:bg-muted text-text-secondary hover:text-text-primary border border-border/60'
                                    }`}
                                  >
                                    ₹{amount >= 100000 ? `${amount / 100000}L` : amount >= 1000 ? `${amount / 1000}k` : amount}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Interest button beside the loan amount field */}
                  <button
                    type="button"
                    onClick={() => setHasInterest(!hasInterest)}
                    aria-label={hasInterest ? "Interest enabled, click to toggle" : "Add interest to loan"}
                    className={`h-14 px-3 sm:px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shrink-0 border transition-all cursor-pointer active:scale-95 ${
                      hasInterest
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'bg-card border-border/60 text-text-secondary hover:border-accent/40 hover:text-text-primary hover:bg-muted/30'
                    }`}
                  >
                    <Percent size={15} strokeWidth={2.5} />
                    <span className="hidden xs:inline sm:inline">Interest</span>
                    {hasInterest && (
                      <span className="text-[10px] font-mono bg-amber-500 text-white rounded-md px-1.5 py-0.5">
                        {interestRate}%
                      </span>
                    )}
                  </button>
                </div>
              </div>

            {/* Interest Section: Only applicable when Interest is enabled */}
            {hasInterest && (
            <motion.div 
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-card border border-amber-500/30 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0" aria-hidden="true">
                    <Percent size={15} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                      Interest Details
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {interestRate}% applied • Both % and amount (₹) are fully editable
                    </span>
                  </div>
                </div>

                {!isRenewal && (
                  <button
                    type="button"
                    onClick={() => setHasInterest(false)}
                    aria-label="Remove interest"
                    className="text-[11px] font-bold text-text-secondary hover:text-danger px-2.5 py-1 rounded-lg hover:bg-danger/10 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>

              {hasInterest && (
                <div className="space-y-3 pt-1 border-t border-border/40">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Interest Rate (%) Field - Editable */}
                    <div>
                      <label htmlFor="customer-input-interest-rate" className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-widest ml-1 mb-1.5 block">
                        Interest Rate (%)
                      </label>
                      <div className="relative">
                        <input
                          id="customer-input-interest-rate"
                          type="number"
                          step="0.1"
                          min="0"
                          aria-label="Interest rate percentage"
                          value={interestRate}
                          onChange={e => handleInterestRateChange(parseFloat(e.target.value) || 0)}
                          className="w-full bg-bg border border-border/60 rounded-2xl h-13 pl-4 pr-9 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-sm font-bold font-mono"
                          placeholder="3"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-text-secondary opacity-60" aria-hidden="true">
                          %
                        </span>
                      </div>

                      {/* Quick % chips */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-2" role="group" aria-label="Preset interest rates">
                        {quickInterestRates.map(rate => (
                          <button
                            key={rate}
                            type="button"
                            aria-label={`Set interest rate to ${rate}%`}
                            onClick={() => handleInterestRateChange(rate)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono border transition-all cursor-pointer ${
                              interestRate === rate
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-bg border-border/70 hover:bg-muted text-text-secondary'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interest Amount (₹) Field - Editable */}
                    <div>
                      <label htmlFor="customer-input-interest-amount" className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-widest ml-1 mb-1.5 block">
                        Interest Amount (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-text-secondary opacity-40" aria-hidden="true">
                          ₹
                        </span>
                        <input
                          id="customer-input-interest-amount"
                          type="number"
                          min="0"
                          step="10"
                          aria-label="Interest amount in Rupees"
                          value={interestAmount || ''}
                          onChange={e => handleInterestAmountChange(parseInt(e.target.value) || 0)}
                          className="w-full bg-bg border border-border/60 rounded-2xl h-13 pl-8 pr-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-sm font-bold font-mono text-amber-600 dark:text-amber-400"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-[10px] text-text-secondary opacity-60 ml-1 mt-1.5 block">
                        Directly editable in Rupees
                      </span>
                    </div>
                  </div>

                  {/* Breakdown & Total Summary */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-medium">
                      Principal ₹{principalAmountNum.toLocaleString()} + Interest ₹{(interestAmount || 0).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                        Total Loan:
                      </span>
                      <span className="font-mono font-black text-sm text-text-primary">
                        ₹{totalLoanWithInterest.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
            )}

            {principalAmountNum > 0 && (
              <>
                {/* Collection Frequency (Daily 1d, Weekly 7d, Monthly 30d, or Custom Days) */}
                <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] block">
                      Collection Frequency
                    </label>
                    <span className="text-[10px] font-bold text-accent">
                      {formData.frequencyDays === 1 ? 'Daily (1 Day)' : formData.frequencyDays === 7 ? 'Weekly (7 Days)' : formData.frequencyDays === 30 ? 'Monthly (30 Days)' : `Every ${formData.frequencyDays} Days`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {frequencyOptions.map(opt => {
                      const isSelected = !isCustomFrequency && formData.frequencyDays === opt.days;
                      return (
                        <button
                          key={opt.key}
                          id={`freq-btn-${opt.key}`}
                          type="button"
                          onClick={() => handleSelectFrequency(opt.key, opt.days)}
                          className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' 
                              : 'bg-bg border-border/50 text-text-secondary hover:border-accent/40'
                          }`}
                        >
                          <span className="text-xs font-black">{opt.label}</span>
                          <span className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-white/80' : 'opacity-40'}`}>
                            {opt.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Frequency Days Option */}
                  <div className="pt-1 flex items-center justify-between gap-3 border-t border-border/30 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomFrequency(!isCustomFrequency)}
                      className={`text-[11px] font-bold transition-colors cursor-pointer ${isCustomFrequency ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      {isCustomFrequency ? '✓ Custom Days Interval' : '+ Custom Collection Interval'}
                    </button>

                    {isCustomFrequency && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">Every</span>
                        <input
                          id="customer-custom-freq-days"
                          type="number"
                          min="1"
                          value={formData.frequencyDays}
                          onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setFormData(prev => ({
                              ...prev,
                              frequency: 'custom',
                              frequencyDays: val,
                            }));
                          }}
                          className="w-16 h-9 px-2 bg-bg border border-border/60 rounded-xl text-center text-xs font-black focus:outline-none focus:border-accent font-mono"
                        />
                        <span className="text-xs text-text-secondary">Days</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration / Number of Days with Quick Duration visible at bottom inside the text field on tap */}
                <div>
                  <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label htmlFor="customer-input-duration" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] block">
                      Loan Tenure / Duration
                    </label>
                    <span className="text-xs font-black text-text-primary font-mono">
                      {formData.duration} Days Total
                    </span>
                  </div>

                  <div 
                    ref={durationBoxRef}
                    className={`relative bg-bg border rounded-2xl transition-all duration-200 cursor-text ${
                      isDurationFocused 
                        ? 'border-accent ring-4 ring-accent/5 p-3' 
                        : 'border-border/60 hover:border-border/90 px-3.5 h-14 flex flex-col justify-center'
                    }`}
                    onClick={() => {
                      const inputEl = document.getElementById('customer-input-duration');
                      if (inputEl) inputEl.focus();
                      setIsDurationFocused(true);
                    }}
                  >
                    {/* Duration input row */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center flex-1 min-w-0">
                        <input
                          id="customer-input-duration"
                          type="number"
                          min="1"
                          aria-label="Tenure duration in days"
                          value={formData.duration || ''}
                          onFocus={() => setIsDurationFocused(true)}
                          onChange={e => {
                            const days = parseInt(e.target.value) || 0;
                            setFormData(prev => ({
                              ...prev,
                              duration: days > 0 ? days : 1
                            }));
                          }}
                          className="w-20 min-w-[50px] bg-transparent focus:outline-none text-[15px] font-bold font-mono text-text-primary placeholder:text-text-secondary/40"
                          placeholder="100"
                        />
                        <span className="text-xs font-bold text-text-secondary opacity-60 mr-2 shrink-0 select-none">
                          Days
                        </span>
                      </div>
                    </div>

                    {/* Quick duration presets visible at bottom inside the text field on tap/focus */}
                    <AnimatePresence>
                      {isDurationFocused && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="pt-2 mt-2 border-t border-border/40 overflow-hidden"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary opacity-60">
                              Quick Presets
                            </span>
                            <span className="text-[10px] font-mono font-bold text-accent">
                              {formData.duration} Days
                            </span>
                          </div>
                          <div 
                            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" 
                            role="group" 
                            aria-label="Quick preset loan durations"
                          >
                            {durationPresets.map(preset => {
                              const isSelected = formData.duration === preset.days;
                              return (
                                <button
                                  key={preset.days}
                                  id={`duration-preset-${preset.days}`}
                                  type="button"
                                  aria-label={`Select tenure of ${preset.label}`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSelectDurationDays(preset.days);
                                  }}
                                  className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono shrink-0 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-accent text-white shadow-xs font-black scale-102'
                                      : 'bg-muted/80 hover:bg-muted text-text-secondary hover:text-text-primary border border-border/60'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Date Pickers (Start Date & Calculated End Date) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="customer-input-start-date" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 block">Start Date</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 pointer-events-none" aria-hidden="true" />
                      <input
                        id="customer-input-start-date"
                        type="date"
                        required
                        aria-required="true"
                        aria-label="Loan start date"
                        value={formData.startDate}
                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-9 pr-3 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[12px] font-bold font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="customer-input-end-date" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 block">End Date</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 pointer-events-none" aria-hidden="true" />
                      <input
                        id="customer-input-end-date"
                        type="date"
                        required
                        aria-required="true"
                        aria-label="Loan end date"
                        value={endDate}
                        onChange={e => handleEndDateChange(e.target.value)}
                        className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-9 pr-3 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[12px] font-bold font-mono"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Section 2.5: Optional Existing Customer with Prior Repayments */}
            {!isNewLoan && !isEdit && (
              <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0" aria-hidden="true">
                      <History size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                          Existing Loan / Prior Repayments?
                        </span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                          Optional
                        </span>
                      </div>
                      <span className="text-[10px] text-text-secondary leading-tight block mt-0.5">
                        For onboarding borrowers who already have an active running loan with paid installments
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !isExistingLoan;
                      setIsExistingLoan(next);
                    }}
                    aria-label={isExistingLoan ? "Disable existing loan prior repayments" : "Enable existing loan prior repayments"}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isExistingLoan 
                        ? 'bg-accent text-white border-accent shadow-xs' 
                        : 'bg-bg border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {isExistingLoan ? 'Enabled ✓' : '+ Add Prior Paid'}
                  </button>
                </div>

                {isExistingLoan && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-3 border-t border-border/40"
                  >
                    {/* Method Switch: Enter Remaining Pending Balance (Default) vs Enter Amount Already Paid */}
                    <div className="flex items-center justify-between bg-bg p-1 rounded-xl border border-border/60" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={inputMode === 'pending'}
                        onClick={() => setInputMode('pending')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          inputMode === 'pending'
                            ? 'bg-accent text-white shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Enter Remaining Pending (₹)
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={inputMode === 'paid'}
                        onClick={() => setInputMode('paid')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          inputMode === 'paid'
                            ? 'bg-accent text-white shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Enter Amount Already Paid (₹)
                      </button>
                    </div>

                    {/* Primary Input Field */}
                    {inputMode === 'pending' ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5 ml-1">
                          <label htmlFor="customer-input-pending-balance" className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block">
                            Remaining Pending Balance (₹)
                          </label>
                          <span className="text-[10px] text-text-secondary font-mono">
                            Total: ₹{totalLoanWithInterest.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-600 dark:text-amber-400 font-mono" aria-hidden="true">₹</span>
                          <input
                            id="customer-input-pending-balance"
                            type="number"
                            min="0"
                            max={totalLoanWithInterest}
                            step="50"
                            aria-label="Remaining pending balance in Rupees"
                            value={pendingBalanceInput}
                            onChange={e => handlePendingBalanceChange(e.target.value)}
                            placeholder={totalLoanWithInterest ? `e.g. ${Math.round(totalLoanWithInterest * 0.7)}` : '0'}
                            className="w-full bg-bg border border-amber-500/40 rounded-2xl h-14 pl-10 pr-4 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-[15px] font-bold font-mono text-amber-600 dark:text-amber-400"
                          />
                        </div>
                        <span className="text-[10px] text-text-secondary opacity-70 ml-1 mt-1 block">
                          Enter the current unpaid balance remaining on the borrower's notebook
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1.5 ml-1">
                          <label htmlFor="customer-input-already-paid" className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">
                            Amount Already Collected / Paid (₹)
                          </label>
                          <span className="text-[10px] text-text-secondary font-mono">
                            Total: ₹{totalLoanWithInterest.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono" aria-hidden="true">₹</span>
                          <input
                            id="customer-input-already-paid"
                            type="number"
                            min="0"
                            max={totalLoanWithInterest}
                            step="50"
                            aria-label="Amount already paid in Rupees"
                            value={alreadyPaidInput}
                            onChange={e => handleAlreadyPaidChange(e.target.value)}
                            placeholder={totalLoanWithInterest ? `e.g. ${Math.round(totalLoanWithInterest * 0.3)}` : '0'}
                            className="w-full bg-bg border border-emerald-500/40 rounded-2xl h-14 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-[15px] font-bold font-mono text-emerald-600 dark:text-emerald-400"
                          />
                        </div>
                        <span className="text-[10px] text-text-secondary opacity-70 ml-1 mt-1 block">
                          Enter the sum of installments already collected from this borrower
                        </span>
                      </div>
                    )}

                    {/* Quick Preset Buttons */}
                    {totalLoanWithInterest > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block ml-1">
                          Quick Presets:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handlePresetPercentagePaid(25)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono border bg-bg border-border/70 hover:bg-muted text-text-secondary transition-all active:scale-95 cursor-pointer"
                          >
                            25% Paid (₹{Math.round(totalLoanWithInterest * 0.75).toLocaleString('en-IN')} pend.)
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePresetPercentagePaid(50)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono border bg-bg border-border/70 hover:bg-muted text-text-secondary transition-all active:scale-95 cursor-pointer"
                          >
                            50% Paid (₹{Math.round(totalLoanWithInterest * 0.5).toLocaleString('en-IN')} pend.)
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePresetPercentagePaid(75)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono border bg-bg border-border/70 hover:bg-muted text-text-secondary transition-all active:scale-95 cursor-pointer"
                          >
                            75% Paid (₹{Math.round(totalLoanWithInterest * 0.25).toLocaleString('en-IN')} pend.)
                          </button>
                          {estimatedInstallment > 0 && [10, 30, 50].map(days => {
                            const paidVal = days * estimatedInstallment;
                            if (paidVal >= totalLoanWithInterest) return null;
                            return (
                              <button
                                key={days}
                                type="button"
                                onClick={() => handlePresetDaysPaid(days)}
                                className="px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono border bg-bg border-border/70 hover:bg-muted text-text-secondary transition-all active:scale-95 cursor-pointer"
                              >
                                {days}d Paid (₹{paidVal.toLocaleString('en-IN')})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Real-time Bi-directional Summary Card */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest block">
                            Already Paid
                          </span>
                          <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            ₹{existingPaidNum.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-text-secondary font-mono mt-0.5 block">
                            ~{priorInstallmentsPaid} installments
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest block">
                            Remaining Pending
                          </span>
                          <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5 block">
                            ₹{existingPendingNum.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-text-secondary font-mono mt-0.5 block">
                            ~{remainingInstallmentsCount} installments left
                          </span>
                        </div>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full bg-border/40 rounded-full h-2 overflow-hidden flex">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${repaymentProgressPct}%` }}
                        />
                      </div>

                      {/* Audit Ledger Notice */}
                      <div className="pt-1 flex items-start gap-2 text-[11px] text-text-secondary leading-snug">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <span>A single <strong>opening balance ledger entry of ₹{existingPaidNum.toLocaleString('en-IN')}</strong> will be created on registration for audit integrity.</span>
                        </div>
                      </div>

                      {/* Opening Balance Ledger Note Field */}
                      <div className="pt-2 border-t border-border/30">
                        <label htmlFor="customer-opening-balance-note" className="text-[10px] font-bold text-text-secondary opacity-60 uppercase tracking-wider block mb-1">
                          Audit Record Note:
                        </label>
                        <input
                          id="customer-opening-balance-note"
                          type="text"
                          value={openingBalanceNote}
                          onChange={e => setOpeningBalanceNote(e.target.value)}
                          placeholder={`Opening Balance: ${priorInstallmentsPaid} days collected prior to system registration`}
                          className="w-full bg-bg border border-border/50 rounded-xl h-9 px-3 text-xs focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

        {/* Section 3: Notes / Remarks & Review */}
        <div className="space-y-4">
          <div>
            <label htmlFor="customer-input-notes" className="text-[11px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" /> Notes / Remarks
            </label>
            <textarea
              id="customer-input-notes"
              aria-label="Additional notes or remarks"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-bg border border-border/60 rounded-2xl p-4 min-h-[90px] focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[13px]"
              placeholder={isRenewal ? `e.g. Loan Restructured with interest` : (isNewLoan ? `e.g. Loan Disbursed` : "Add any additional details here...")}
            />
          </div>

          {/* Registration Summary Card */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
            <h5 className="text-xs font-black uppercase tracking-wider text-accent">Registration Summary</h5>
            <div className="grid grid-cols-2 gap-3 text-xs font-medium">
              <div className="p-3 rounded-xl bg-bg border border-border/40">
                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Borrower Name</span>
                <span className="font-black text-text-primary text-sm">{formData.name || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-bg border border-border/40">
                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Phone Number</span>
                <span className="font-black text-text-primary text-sm">+91 {formData.phone || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-bg border border-border/40">
                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Total Loan Amount</span>
                <span className="font-black text-accent text-sm font-mono">₹{totalLoanWithInterest.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-bg border border-border/40">
                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Loan Tenure</span>
                <span className="font-black text-text-primary text-sm font-mono">{formData.duration} Days</span>
              </div>
            </div>
          </div>
        </div>
        )}

        {isEdit && onDelete && !isNewLoan && (
          <div className="pt-4 border-t border-border">
             <button
                id="customer-btn-delete"
                type="button"
                aria-label={`Delete customer ${customer?.name || ''}`}
                onClick={() => customer && onDelete(customer.id, customer.name)}
                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 border bg-danger/10 text-danger border-danger/20 active:scale-95 transition-all cursor-pointer min-h-[44px]"
              >
                <Trash2 size={18} aria-hidden="true" />
                Delete Customer
              </button>
          </div>
        )}
      </form>
      
      {/* Footer Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/90 backdrop-blur-xl border-t border-border/40 pb-[env(safe-area-inset-bottom)] z-50">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <button
            id="customer-btn-cancel"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 h-14 rounded-2xl bg-bg border border-border font-black text-[11px] uppercase tracking-widest text-text-secondary active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            id="customer-btn-save"
            type="button"
            onClick={() => handleSubmit()}
            disabled={
              isSubmitting ||
              !formData.name.trim() ||
              (isNewLoan 
                ? (totalLoanWithInterest < 0 || (Number(formData.loan) > 0 && (formData.duration || 0) < 1))
                : ((!isIdUnique && !isEdit) || Number(formData.loan) < 0 || duplicateLoanError?.exists))
            }
            className={`flex-[2] h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2 ${
              duplicateLoanError?.exists
                ? 'bg-rose-600 text-white shadow-rose-600/20'
                : 'bg-accent text-white shadow-accent/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : duplicateLoanError?.exists ? (
              <span>Dual Loan Prohibited</span>
            ) : isRenewal ? (
              `Renew Loan`
            ) : isNewLoan ? (
              `Issue New Loan`
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Create Account'
            )}
          </button>
        </div>
      </div>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-bg/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-24 h-24 rounded-3xl bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-6"
            >
              <CheckCircle2 size={56} className="stroke-[2.5]" />
            </motion.div>
            <motion.h3 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl font-black text-text-primary uppercase tracking-tight"
            >
              Registration Successful!
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-text-secondary mt-1 font-medium max-w-xs"
            >
              Account has been created and registered successfully in the ledger.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
