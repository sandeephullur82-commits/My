import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, RenewalData, firestoreService } from '../services/firestoreService';
import { notificationService } from '../services/notificationService';
import { toast } from 'sonner';
import { format, addDays, differenceInDays, parseISO, isValid } from 'date-fns';
import { safeFormat, safeDifferenceInDays } from '../lib/utils';
import { Calendar, Loader2, Trash2, Clock, Check, Lock, Sparkles, IndianRupee, RotateCcw, CheckCircle2, Percent } from 'lucide-react';

interface CustomerFormProps {
  customer?: Customer; // if provided, we are in Edit mode, New Loan mode, or Renewal mode
  mode?: 'create' | 'edit' | 'new_loan' | 'renewal';
  onSave?: (customer: Partial<Customer> & { id: string }) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string, name: string) => void;
  onSuccess?: (updatedCustomer: Customer) => void;
}

export function CustomerForm({ customer, mode, onSave, onCancel, onDelete, onSuccess }: CustomerFormProps) {
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
          frequency: parsed.frequency || 'daily',
          frequencyDays: parsed.frequencyDays || 1,
        };
      } catch (e) {
        // fallback
      }
    }
    return { 
      name: '', 
      phone: '', 
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
      if (Number(formData.loan) <= 0) toast.error('Enter valid amount (> ₹0)');
      if (!isIdUnique && !isEdit) toast.error('ID already used');
      return;
    }

    const normalizedName = formData.name.trim();
    const normalizedPhone = cleanPhone;
    
    if (!isEdit || normalizedName !== customer?.name || normalizedPhone !== customer?.phone) {
      const isUnique = await firestoreService.checkDuplicateCustomer(normalizedName, normalizedPhone);
      if (!isUnique) {
        toast.error('Customer already exists (same name & phone)');
        return;
      }
      const phoneCheck = await firestoreService.checkPhoneExists(normalizedPhone);
      if (phoneCheck.exists && phoneCheck.name?.toLowerCase() !== normalizedName.toLowerCase()) {
        toast.info(`Notice: Phone number also in use by "${phoneCheck.name}".`);
      }
    }

    const finalLoanAmt = totalLoanWithInterest;
    const startMs = parseISO(formData.startDate).getTime();
    const endMs = parseISO(endDate).getTime();
    const uniqueKey = `${normalizedName.toLowerCase()}_${normalizedPhone}`;
    
    setIsSubmitting(true);
    try {
      if (isEdit && customer) {
        if (onSave) {
          await onSave({
            id: customer.id,
            name: normalizedName,
            phone: normalizedPhone,
            loanAmount: finalLoanAmt,
            loan: finalLoanAmt,
            pending: finalLoanAmt - customer.paid,
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
        if (onSave) {
          await onSave({
            id: fullId,
            name: normalizedName,
            phone: normalizedPhone,
            loan: finalLoanAmt,
            loanAmount: finalLoanAmt,
            paid: 0,
            pending: finalLoanAmt,
            startDate: startMs,
            endDate: endMs,
            frequency: formData.frequency,
            frequencyDays: formData.frequencyDays || 1,
            durationDays: formData.duration || 100,
            notes: formData.notes,
            uniqueKey
          });
        }
        toast.success(`${normalizedName} (${fullId}) created`);
        localStorage.removeItem('pigmy_draft_new_customer');
        onCancel();
      }
    } catch (err) {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} customer.`);
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

        {/* Financial Highlights */}
        <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-4 mt-1">
          <div>
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">
              {hasInterest && interestAmount > 0 ? 'Total Due' : (isNewLoan && effectiveAdvanceToApply > 0 ? 'Opening Due' : 'Total Loan')}
            </p>
            <p className="text-lg font-black text-text-primary tracking-tighter font-mono">
              ₹{(isNewLoan && effectiveAdvanceToApply > 0 ? netOpeningPending : totalLoanWithInterest).toLocaleString()}
            </p>
            {hasInterest && interestAmount > 0 && (
              <p className="text-[10px] font-bold text-accent font-mono">
                incl. ₹{interestAmount.toLocaleString()} ({interestRate}%)
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">Tenure</p>
            <p className="text-lg font-black text-text-primary tracking-tighter font-mono">
              {formData.duration} Days
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">Est. Installment</p>
            <p className="text-lg font-black text-accent tracking-tighter font-mono">
              ₹{estimatedInstallment.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

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

          <div className="space-y-4">
            <div>
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

            <div>
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

            <div>
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
            {/* Principal / Loan Amount */}
            <div>
              <label htmlFor="customer-input-loan" className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] ml-1 mb-1.5 block">
                {isRenewal 
                  ? `Renewal Principal (Cycle #${nextCycle})` 
                  : (isNewLoan ? `New Loan Principal (Cycle #${nextCycle})` : 'Loan Amount')}
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
                  aria-label="Loan principal amount in Rupees"
                  value={formData.loan}
                  onChange={e => handlePrincipalChange(e.target.value)}
                  className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-10 pr-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold font-mono"
                  placeholder="0.00"
                />
              </div>

              {/* Quick loan amounts */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2" role="group" aria-label="Preset loan amounts">
                {quickAmounts.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    aria-label={`Set loan amount to ₹${amount.toLocaleString('en-IN')}`}
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

            {/* Interest Section: Default 3% & Interest Amount, Both Editable */}
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
                : ((!isIdUnique && !isEdit) || formData.phone.replace(/\D/g, '').slice(-10).length !== 10 || Number(formData.loan) <= 0))
            }
            className="flex-[2] h-14 rounded-2xl bg-accent text-white font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-accent/20 disabled:opacity-50 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              isRenewal 
                ? `Renew Loan (Cycle #${nextCycle})`
                : (isNewLoan 
                    ? `Issue New Loan (Cycle #${nextCycle})` 
                    : (isEdit ? 'Save Changes' : 'Create Account'))
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
