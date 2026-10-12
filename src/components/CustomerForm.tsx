import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, RenewalData, firestoreService } from '../services/firestoreService';
import { notificationService } from '../services/notificationService';
import { toast } from 'sonner';
import { format, addDays, differenceInDays, parseISO, isValid } from 'date-fns';
import { safeFormat, safeDifferenceInDays } from '../lib/utils';
import { Calendar, Loader2, Trash2, Clock, Check, Lock, Sparkles, IndianRupee, RotateCcw, CheckCircle2, Percent, History, AlertTriangle } from 'lucide-react';

interface CustomerFormProps {
  customer?: Customer; // if provided, we are in Edit mode, New Loan mode, or Renewal mode
  mode?: 'create' | 'edit' | 'new_loan' | 'renewal';
  initialAccountType?: 'loan' | 'saving';
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
  initialAccountType = 'loan', 
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
        accountType: (customer.accountType || 'loan') as 'loan' | 'saving',
        loan: defaultLoanAmt,
        notes: isRenewal
          ? `Cycle #${nextCycle} Renewal`
          : (accruedAdvance > 0 
              ? `Cycle #${nextCycle} New Loan (₹${accruedAdvance.toLocaleString('en-IN')} Advance Applied)` 
              : `Cycle #${nextCycle} New Loan`),
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
        accountType: (customer.accountType || 'loan') as 'loan' | 'saving',
        loan: customer.accountType === 'saving' ? (customer.targetDeposit || customer.loan || 0) : (customer.loanAmount || customer.loan || 0),
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
          accountType: (initialAccountType || parsed.accountType || 'loan') as 'loan' | 'saving',
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
      accountType: initialAccountType as 'loan' | 'saving',
      loan: '', 
      notes: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      duration: 100,
      frequency: 'daily',
      frequencyDays: 1,
    };
  });

  const principalAmountNum = Number(formData.loan) || 0;
  const paidAmount = customer?.paid || 0;

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
      if (typeof customer.displayId === 'string' && customer.displayId.includes('-')) {
        return customer.displayId.split('-')[1];
      }
      return String(customer.displayId || customer.id.replace('CUST-', ''));
    }
    return '001';
  });

  const [isSyncingId, setIsSyncingId] = useState(false);
  const [isIdUnique, setIsIdUnique] = useState(true);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomFrequency, setIsCustomFrequency] = useState(
    formData.frequencyDays !== 1 && formData.frequencyDays !== 7 && formData.frequencyDays !== 30
  );

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
    if (idSuffix.length === 3) {
      const check = async () => {
        setIsCheckingId(true);
        const unique = await firestoreService.checkIdUnique(fullId);
        setIsIdUnique(unique);
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

    if (formData.accountType === 'loan' && cleanName.length >= 2 && cleanPhone.length === 10) {
      setIsCheckingDuplicate(true);
      const timer = setTimeout(async () => {
        try {
          const result = await firestoreService.checkDuplicateCustomer(
            cleanName,
            cleanPhone,
            'loan'
          );
          if (!result.allowed) {
            setDuplicateLoanError({
              exists: true,
              existingLoanId: result.existingLoanId,
              reason: result.reason
            });
          } else {
            setDuplicateLoanError(null);
          }
        } catch (e) {
          setDuplicateLoanError(null);
        } finally {
          setIsCheckingDuplicate(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setDuplicateLoanError(null);
      setIsCheckingDuplicate(false);
    }
  }, [formData.name, formData.phone, formData.accountType, isNewLoan, isEdit]);

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
      if (totalLoanWithInterest <= 0) {
        toast.error('Please enter a valid loan amount (> ₹0)');
        return;
      }
      if ((formData.duration || 0) < 1) {
        toast.error('Loan tenure must be at least 1 day');
        return;
      }

      setIsSubmitting(true);
      try {
        const startParsed = parseISO(formData.startDate);
        const startMs = isValid(startParsed) ? startParsed.getTime() : Date.now();
        const endParsed = parseISO(endDate);
        const endMs = isValid(endParsed) ? endParsed.getTime() : addDays(startMs, formData.duration || 100).getTime();

        const defaultNotes = isRenewal
          ? `Cycle #${nextCycle} Renewal (Principal ₹${principalAmountNum.toLocaleString('en-IN')}${hasInterest && interestAmount > 0 ? ` + ₹${interestAmount.toLocaleString('en-IN')} Interest @ ${interestRate}%` : ''})`
          : (effectiveAdvanceToApply > 0 ? `Cycle #${nextCycle} New Loan (₹${effectiveAdvanceToApply.toLocaleString('en-IN')} Advance Applied)` : `Cycle #${nextCycle} New Loan`);

        const payload: RenewalData = {
          newLoanAmount: totalLoanWithInterest,
          durationDays: formData.duration || 100,
          startDate: startMs,
          endDate: endMs,
          rolloverAction: prevPending > 0 ? 'absorbed' : 'cleared',
          frequency: formData.frequency as any,
          frequencyDays: formData.frequencyDays || 1,
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
          toast.success(`🎉 ${isRenewal ? 'Loan renewed' : 'New Loan started'} for ${customer.name} (Cycle #${nextCycle})! ₹${effectiveAdvanceToApply.toLocaleString('en-IN')} Advance applied.`);
        } else {
          toast.success(`🎉 ${isRenewal ? 'Loan renewed' : 'New Loan started'} for ${customer.name} (Cycle #${nextCycle})!`);
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

    // Validate New Customer or Edit Customer flow
    const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10);
    if (!formData.name || !formData.loan || (!isIdUnique && !isEdit) || cleanPhone.length !== 10 || Number(formData.loan) <= 0) {
      if (cleanPhone.length !== 10) toast.error('Enter valid 10-digit phone number');
      if (Number(formData.loan) <= 0) toast.error(formData.accountType === 'saving' ? 'Enter valid target savings (> ₹0)' : 'Enter valid loan amount (> ₹0)');
      if (!isIdUnique && !isEdit) toast.error('ID already used');
      return;
    }

    const normalizedName = formData.name.trim();
    const normalizedPhone = cleanPhone;
    
    if (!isEdit || normalizedName !== customer?.name || normalizedPhone !== customer?.phone || formData.accountType !== (customer?.accountType || 'loan')) {
      const checkResult = await firestoreService.checkDuplicateCustomer(
        normalizedName, 
        normalizedPhone, 
        formData.accountType,
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

    const isSaving = formData.accountType === 'saving';
    const finalLoanAmt = isSaving ? 0 : totalLoanWithInterest;
    const targetDepositAmt = isSaving ? totalLoanWithInterest : undefined;
    const startMs = parseISO(formData.startDate).getTime();
    const endMs = parseISO(endDate).getTime();
    const uniqueKey = isSaving
      ? `${normalizedName.toLowerCase()}_${normalizedPhone}_saving_${isEdit && customer ? customer.id : fullId}`
      : `${normalizedName.toLowerCase()}_${normalizedPhone}_loan`;
    
    setIsSubmitting(true);
    try {
      if (isEdit && customer) {
        if (onSave) {
          await onSave({
            id: customer.id,
            name: normalizedName,
            phone: normalizedPhone,
            accountType: formData.accountType,
            targetDeposit: targetDepositAmt,
            loanAmount: finalLoanAmt,
            loan: finalLoanAmt,
            pending: isSaving ? 0 : Math.max(0, finalLoanAmt - (customer.paid || 0)),
            advanceBalance: isSaving ? (customer.paid || 0) : customer.advanceBalance,
            startDate: startMs,
            endDate: endMs,
            frequency: formData.frequency,
            frequencyDays: formData.frequencyDays || 1,
            durationDays: formData.duration || 100,
            notes: formData.notes
          });
        }
        toast.success(`Changes to ${normalizedName} saved`);
        onCancel();
      } else {
        const priorPaidAmount = isExistingLoan ? existingPaidNum : 0;
        const initialPendingAmt = isSaving ? 0 : (isExistingLoan ? existingPendingNum : finalLoanAmt);

        const openingBalanceData = (isExistingLoan && priorPaidAmount > 0) ? {
          amount: priorPaidAmount,
          note: openingBalanceNote.trim() || (isSaving
            ? `Opening Savings Deposit: Prior collected savings (${priorInstallmentsPaid} days @ ₹${estimatedInstallment || 1}/day)`
            : `Opening Balance: Prior loan collections (${priorInstallmentsPaid} days @ ₹${estimatedInstallment || 1}/day)`),
          timestamp: startMs
        } : undefined;

        if (onSave) {
          await onSave({
            id: fullId,
            name: normalizedName,
            phone: normalizedPhone,
            accountType: formData.accountType,
            targetDeposit: targetDepositAmt,
            loan: finalLoanAmt,
            loanAmount: finalLoanAmt,
            paid: priorPaidAmount,
            pending: initialPendingAmt,
            advanceBalance: isSaving ? priorPaidAmount : 0,
            startDate: startMs,
            endDate: endMs,
            frequency: formData.frequency,
            frequencyDays: formData.frequencyDays || 1,
            durationDays: formData.duration || 100,
            notes: formData.notes,
            uniqueKey,
            hasOpeningBalance: isExistingLoan && priorPaidAmount > 0,
            openingBalance: isExistingLoan && priorPaidAmount > 0 ? priorPaidAmount : undefined
          }, openingBalanceData);
        }
        toast.success(
          isSaving
            ? `🐷 ${normalizedName} (${fullId}) Saving Account created!`
            : (isExistingLoan && priorPaidAmount > 0
              ? `${normalizedName} (${fullId}) registered with ₹${priorPaidAmount.toLocaleString('en-IN')} opening collections`
              : `${normalizedName} (${fullId}) created`)
        );
        localStorage.removeItem('pigmy_draft_new_customer');
        onCancel();
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
                  {isRenewal ? `Renewal • #${nextCycle}` : `Cycle #${nextCycle}`}
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
                    Cycle #{currentCycle} Unpaid Balance
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
                    Cycle #{currentCycle} Fully Cleared
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
                      Apply as initial credit on Cycle #{nextCycle}
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
              {formData.accountType === 'saving'
                ? 'Target Savings'
                : (isExistingLoan && existingPaidNum > 0
                  ? 'Pending Due'
                  : (hasInterest && interestAmount > 0 ? 'Total Due' : (isNewLoan && effectiveAdvanceToApply > 0 ? 'Opening Due' : 'Total Loan')))}
            </p>
            <p className="text-lg font-black text-text-primary tracking-tighter font-mono">
              ₹{(isExistingLoan && existingPaidNum > 0
                ? existingPendingNum
                : (isNewLoan && effectiveAdvanceToApply > 0 ? netOpeningPending : totalLoanWithInterest)
              ).toLocaleString()}
            </p>
            {formData.accountType === 'saving' ? (
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                Pigmy Savings
              </p>
            ) : hasInterest && interestAmount > 0 ? (
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
              {formData.accountType === 'saving' ? 'Daily Target' : 'Est. Installment'}
            </p>
            <p className="text-lg font-black text-accent tracking-tighter font-mono">
              ₹{estimatedInstallment.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Account Type Selector for New Accounts (Loan vs Saving) */}
      {!isNewLoan && !isEdit && (
        <div className="bg-card/70 p-1.5 rounded-2xl border border-border/70 flex items-center gap-2 mx-1 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setFormData(prev => ({ ...prev, accountType: 'loan' }));
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              formData.accountType === 'loan'
                ? 'bg-accent text-white shadow-md shadow-accent/25'
                : 'text-text-secondary hover:text-text-primary hover:bg-muted/60'
            }`}
          >
            <span>💳 Loan Account</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData(prev => ({ ...prev, accountType: 'saving' }));
              setDuplicateLoanError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              formData.accountType === 'saving'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-text-secondary hover:text-text-primary hover:bg-muted/60'
            }`}
          >
            <span>🐷 Saving Account</span>
          </button>
        </div>
      )}

      {/* Real-time Dual Loan Warning Banner */}
      {duplicateLoanError?.exists && formData.accountType === 'loan' && (
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
          <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-text-secondary">
              Borrower can create a Saving account with these details:
            </span>
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, accountType: 'saving' }));
                setDuplicateLoanError(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
            >
              🐷 Switch to Saving Account
            </button>
          </div>
        </div>
      )}

      {/* Pigmy Saving Account Confirmation Banner */}
      {formData.accountType === 'saving' && !isNewLoan && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 mx-1">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg shrink-0">
            🐷
          </div>
          <div className="text-xs text-emerald-800 dark:text-emerald-300 min-w-0">
            <p className="font-black uppercase tracking-wider">Pigmy Saving Account</p>
            <p className="text-[11px] opacity-80 mt-0.5">
              Using the same name and phone number to create a Saving account is fully allowed alongside their loan account.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-8 px-1">
        {/* Section 1: Core Identity (Disabled & Uneditable for New Loan & Renewal) */}
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
              <label htmlFor="customer-input-phone" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 flex items-center justify-between">
                <span>Phone Number</span>
                {isNewLoan && <span className="text-[9px] font-bold lowercase opacity-70">(uneditable for {isRenewal ? 'renewal' : 'new loan'})</span>}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-text-secondary opacity-40" aria-hidden="true">+91</span>
                <input
                  id="customer-input-phone"
                  type="tel"
                  required
                  aria-required="true"
                  aria-label="10-digit phone number"
                  disabled={isNewLoan}
                  value={formData.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  className={`w-full bg-bg border border-border/60 rounded-2xl h-14 pl-14 pr-12 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold ${
                    isNewLoan ? 'opacity-70 cursor-not-allowed bg-muted/40 text-text-secondary select-none' : ''
                  }`}
                  placeholder="10-digit number"
                />
                {isNewLoan && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 pointer-events-none" aria-hidden="true">
                    <Lock size={16} />
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex justify-between items-end mb-1.5 ml-1">
                <label htmlFor="customer-input-id-suffix" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em]">
                  Account ID
                </label>
                {!isEdit && !isNewLoan && (
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isIdUnique ? 'text-success' : 'text-danger'}`} role="status">
                    {isCheckingId ? 'Checking...' : isIdUnique ? 'Available' : 'Taken'}
                  </span>
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
                  required
                  aria-required="true"
                  aria-label="Account ID suffix"
                  readOnly={isEdit || isNewLoan}
                  disabled={isNewLoan}
                  value={idSuffix}
                  onChange={e => handleIdChange(e.target.value)}
                  className={`w-full bg-bg border ${
                    !isIdUnique && !isEdit && !isNewLoan ? 'border-danger/50 focus:border-danger' : 'border-border/60 focus:border-accent'
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
            </div>
          </div>
        </div>

        {/* Section 2: Financials & Collection Schedule */}
        <div>
          <h4 className="text-[11px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Financials & Schedule
          </h4>
          <div className="space-y-5">
            {/* Principal / Loan Amount or Target Savings */}
            <div>
              <label htmlFor="customer-input-loan" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 block">
                {formData.accountType === 'saving'
                  ? 'Target Savings Goal (₹)'
                  : (isRenewal 
                      ? `Renewal Principal (Cycle #${nextCycle})` 
                      : (isNewLoan ? `New Loan Principal (Cycle #${nextCycle})` : 'Loan Amount'))}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-text-secondary opacity-40" aria-hidden="true">₹</span>
                <input
                  id="customer-input-loan"
                  type="number"
                  min="500"
                  step="500"
                  required
                  aria-required="true"
                  aria-label={formData.accountType === 'saving' ? "Target savings goal in Rupees" : "Loan principal amount in Rupees"}
                  value={formData.loan}
                  onChange={e => handlePrincipalChange(e.target.value)}
                  className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-10 pr-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold font-mono"
                  placeholder="0.00"
                />
              </div>

              {/* Quick preset amounts */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2" role="group" aria-label="Preset amounts">
                {quickAmounts.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    aria-label={`Set amount to ₹${amount.toLocaleString('en-IN')}`}
                    onClick={() => handlePrincipalChange(amount.toString())}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border transition-all active:scale-95 cursor-pointer ${
                      principalAmountNum === amount
                        ? 'bg-accent text-white border-accent shadow-xs'
                        : 'bg-card border-border/70 hover:bg-muted text-text-secondary'
                    }`}
                  >
                    ₹{amount >= 1000 ? `${amount / 1000}k` : amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Interest Section: Only applicable for Loans */}
            {formData.accountType !== 'saving' && (
            <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-4">
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
                      Default 3% applied • Both % and amount are fully editable
                    </span>
                  </div>
                </div>

                {!isRenewal && (
                  <button
                    type="button"
                    onClick={() => setHasInterest(!hasInterest)}
                    aria-label={hasInterest ? "Interest is enabled, click to disable" : "Enable interest calculation"}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      hasInterest
                        ? 'bg-accent text-white border-accent'
                        : 'bg-bg border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {hasInterest ? 'Interest Enabled' : '+ Add Interest'}
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
            </div>
            )}

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

            {/* Duration / Number of Days (50, 100, 120, 150, 200 Days & Custom Input) */}
            <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] block">
                  Loan Tenure / Duration (Days)
                </span>
                <span className="text-xs font-black text-text-primary font-mono">
                  {formData.duration} Days Total
                </span>
              </div>

              {/* Quick Duration Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="group" aria-label="Preset loan duration options">
                {durationPresets.map(preset => {
                  const isSelected = formData.duration === preset.days;
                  return (
                    <button
                      key={preset.days}
                      id={`duration-preset-${preset.days}`}
                      type="button"
                      aria-label={`Select tenure of ${preset.label}`}
                      onClick={() => handleSelectDurationDays(preset.days)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold border text-center transition-all cursor-pointer font-mono ${
                        isSelected 
                          ? 'bg-accent/15 border-accent text-accent font-black shadow-xs' 
                          : 'bg-bg border-border/40 text-text-secondary hover:border-text-secondary/40'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Direct Duration in Days Numeric Input */}
              <div className="pt-2">
                <label htmlFor="customer-input-duration" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-widest mb-1.5 block">
                  Enter Custom Duration (Number of Days)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="customer-input-duration"
                    type="number"
                    min="1"
                    aria-label="Tenure duration in days"
                    value={formData.duration || ''}
                    onChange={e => {
                      const days = parseInt(e.target.value) || 0;
                      setFormData(prev => ({
                        ...prev,
                        duration: days > 0 ? days : 1
                      }));
                    }}
                    className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-4 pr-16 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold font-mono"
                    placeholder="e.g. 50, 100, 120"
                  />
                  <span className="absolute right-4 text-xs font-black uppercase text-text-secondary opacity-50 tracking-wider pointer-events-none" aria-hidden="true">
                    Days
                  </span>
                </div>
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
            )}
          </div>
        </div>

        {/* Section 3: Notes / Remarks */}
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
            placeholder={isRenewal ? `e.g. Cycle #${nextCycle} Restructured with interest` : (isNewLoan ? `e.g. Cycle #${nextCycle} Disbursed` : "Add any additional details here...")}
          />
        </div>

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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-xl border-t border-border/40 pb-[env(safe-area-inset-bottom)] z-50">
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
            onClick={() => handleSubmit()}
            disabled={
              isSubmitting ||
              (isNewLoan 
                ? (totalLoanWithInterest <= 0 || (formData.duration || 0) < 1)
                : ((!isIdUnique && !isEdit) || formData.phone.replace(/\D/g, '').slice(-10).length !== 10 || Number(formData.loan) <= 0 || (duplicateLoanError?.exists && formData.accountType === 'loan')))
            }
            className={`flex-[2] h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2 ${
              duplicateLoanError?.exists && formData.accountType === 'loan'
                ? 'bg-rose-600 text-white shadow-rose-600/20'
                : formData.accountType === 'saving'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/25'
                  : 'bg-accent text-white shadow-accent/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : duplicateLoanError?.exists && formData.accountType === 'loan' ? (
              <span>Dual Loan Prohibited</span>
            ) : isRenewal ? (
              `Renew Loan (Cycle #${nextCycle})`
            ) : isNewLoan ? (
              `Issue New Loan (Cycle #${nextCycle})`
            ) : isEdit ? (
              'Save Changes'
            ) : formData.accountType === 'saving' ? (
              'Create Saving Account'
            ) : (
              'Create Loan Account'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
