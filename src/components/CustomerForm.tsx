import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, firestoreService } from '../services/firestoreService';
import { toast } from 'sonner';
import { format, addDays, differenceInDays, parseISO, isValid } from 'date-fns';
import { safeFormat, safeDifferenceInDays } from '../lib/utils';
import { Calendar, Loader2, Trash2, Clock, Check } from 'lucide-react';

interface CustomerFormProps {
  customer?: Customer; // if provided, we are in Edit mode
  onSave: (customer: Partial<Customer> & { id: string }) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: string, name: string) => void;
}

export function CustomerForm({ customer, onSave, onCancel, onDelete }: CustomerFormProps) {
  const isEdit = !!customer;

  const [formData, setFormData] = useState(() => {
    if (isEdit) {
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

  const loanAmountNum = Number(formData.loan) || 0;
  const paidAmount = customer?.paid || 0;
  const balance = loanAmountNum - paidAmount;

  const [idSuffix, setIdSuffix] = useState(isEdit ? (customer.displayId?.split('-')[1] || customer.id.replace('CUST-','')) : '001');
  const [isSyncingId, setIsSyncingId] = useState(false);
  const [isIdUnique, setIsIdUnique] = useState(true);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [showLoanSuggestions, setShowLoanSuggestions] = useState(false);
  const [isCustomFrequency, setIsCustomFrequency] = useState(
    formData.frequencyDays !== 1 && formData.frequencyDays !== 7 && formData.frequencyDays !== 30
  );

  const fullId = useMemo(() => {
    if (isEdit) return customer.id;
    return `CUST-${idSuffix.padStart(3, '0')}`;
  }, [idSuffix, isEdit, customer]);

  const endDate = useMemo(() => {
    const start = parseISO(formData.startDate);
    if (!isValid(start)) return '';
    return format(addDays(start, (formData.duration || 1) - 1), 'yyyy-MM-dd');
  }, [formData.startDate, formData.duration]);

  useEffect(() => {
    if (isEdit) return;
    const fetchId = async () => {
      setIsSyncingId(true);
      const nextIdFull = await firestoreService.getNextCustomerId();
      const suffix = nextIdFull.split('-')[1];
      setIdSuffix(suffix);
      setIsSyncingId(false);
    };
    fetchId();
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    if (idSuffix.length === 3) {
      const check = async () => {
        setIsCheckingId(true);
        const unique = await firestoreService.checkIdUnique(fullId);
        setIsIdUnique(unique);
        setIsCheckingId(false);
      };
      check();
    }
  }, [fullId, isEdit]);

  useEffect(() => {
    if (!isEdit) {
      localStorage.setItem('pigmy_draft_new_customer', JSON.stringify(formData));
    }
  }, [formData, isEdit]);

  const quickAmounts = [1000, 5000, 10000, 20000, 50000];
  
  // Frequency presets with number of days (1, 7, 30 days)
  const frequencyOptions = [
    { key: 'daily', label: 'Daily', days: 1, tag: '1 Day' },
    { key: 'weekly', label: 'Weekly', days: 7, tag: '7 Days' },
    { key: 'monthly', label: 'Monthly', days: 30, tag: '30 Days' },
  ];

  // Preset durations with exact number of days
  const durationPresets = [
    { label: '1 Day', days: 1 },
    { label: '7 Days', days: 7 },
    { label: '30 Days', days: 30 },
    { label: '100 Days', days: 100 },
    { label: '200 Days', days: 200 },
    { label: '365 Days', days: 365 },
  ];

  // Calculate estimated installment per collection cycle
  const estimatedInstallment = useMemo(() => {
    if (!loanAmountNum || !formData.duration) return 0;
    const freqDays = Math.max(1, formData.frequencyDays || 1);
    const numInstallments = Math.max(1, Math.round(formData.duration / freqDays));
    return Math.round(loanAmountNum / numInstallments);
  }, [loanAmountNum, formData.duration, formData.frequencyDays]);

  const handlePhoneChange = (val: string) => {
    const numeric = String(val || '').replace(/\D/g, '').slice(0, 10);
    setFormData({ ...formData, phone: numeric });
  };

  const handleIdChange = (val: string) => {
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
      // If duration is currently 100 but user selects 1 or 7 or 30 days and wants duration matched,
      // or keep duration independent
    }));
  };

  const handleSelectDurationDays = (days: number) => {
    setFormData(prev => ({
      ...prev,
      duration: days,
      // If user clicks 1 day, align to Daily (1d)
      // If user clicks 7 days, align to Weekly (7d)
      // If user clicks 30 days, align to Monthly (30d)
      frequency: days === 1 ? 'daily' : days === 7 ? 'weekly' : days === 30 ? 'monthly' : prev.frequency,
      frequencyDays: days === 1 ? 1 : days === 7 ? 7 : days === 30 ? 30 : prev.frequencyDays,
    }));
    if (days === 1 || days === 7 || days === 30) {
      setIsCustomFrequency(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.loan || (!isIdUnique && !isEdit) || formData.phone.length !== 10 || Number(formData.loan) <= 0) {
      if (formData.phone.length !== 10) toast.error('Enter valid 10-digit phone number');
      if (Number(formData.loan) <= 0) toast.error('Enter valid amount (> ₹0)');
      if (!isIdUnique && !isEdit) toast.error('ID already used');
      return;
    }

    const normalizedName = formData.name.trim();
    const normalizedPhone = formData.phone.trim();
    
    if (!isEdit || normalizedName !== customer.name || normalizedPhone !== customer.phone) {
      const isDuplicate = await firestoreService.checkDuplicateCustomer(normalizedName, normalizedPhone);
      if (!isDuplicate) {
        toast.error('Customer already exists (same name & phone)');
        return;
      }
      const phoneCheck = await firestoreService.checkPhoneExists(normalizedPhone);
      if (phoneCheck.exists && phoneCheck.name?.toLowerCase() !== normalizedName.toLowerCase()) {
        let proceed = true;
        try {
          proceed = window.confirm(`Phone number already used by "${phoneCheck.name}". Continue?`);
        } catch (e) {
          toast.info(`Notice: Phone number already used by "${phoneCheck.name}".`);
          proceed = true;
        }
        if (!proceed) return;
      }
    }

    const loanAmount = Number(formData.loan);
    const startMs = parseISO(formData.startDate).getTime();
    const endMs = parseISO(endDate).getTime();
    const uniqueKey = `${normalizedName.toLowerCase()}_${normalizedPhone}`;
    
    try {
      if (isEdit) {
        await onSave({
          id: customer.id,
          name: normalizedName,
          phone: normalizedPhone,
          loanAmount: loanAmount,
          loan: loanAmount,
          pending: loanAmount - customer.paid,
          startDate: startMs,
          endDate: endMs,
          frequency: formData.frequency,
          frequencyDays: formData.frequencyDays || 1,
          durationDays: formData.duration || 100,
          notes: formData.notes
        });
        toast.success(`Changes to ${normalizedName} saved`);
        onCancel();
      } else {
        await onSave({
          id: fullId,
          name: normalizedName,
          phone: normalizedPhone,
          loan: loanAmount,
          loanAmount: loanAmount,
          paid: 0,
          pending: loanAmount,
          startDate: startMs,
          endDate: endMs,
          frequency: formData.frequency,
          frequencyDays: formData.frequencyDays || 1,
          durationDays: formData.duration || 100,
          notes: formData.notes,
          uniqueKey
        });
        toast.success(`${normalizedName} (${fullId}) created`);
        localStorage.removeItem('pigmy_draft_new_customer');
      }
    } catch (err) {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} customer.`);
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
          <div className="w-14 h-14 rounded-2xl bg-accent text-white flex items-center justify-center font-black text-xl shadow-lg shadow-accent/20">
            {formData.name ? formData.name.charAt(0).toUpperCase() : '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-text-primary tracking-tight truncate">
              {formData.name || 'Borrower Name'}
            </h3>
            <p className="text-[11px] font-bold text-text-secondary opacity-60 uppercase tracking-widest mt-0.5">
              {formData.phone ? `+91 ${formData.phone}` : 'Enter Phone'}
            </p>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-accent/10 text-accent border border-accent/20">
            {frequencyDisplayLabel}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-4 mt-2">
          <div>
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">Total Loan</p>
            <p className="text-lg font-black text-text-primary tracking-tighter">
              ₹{(Number(formData.loan) || 0).toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">Tenure</p>
            <p className="text-lg font-black text-text-primary tracking-tighter">
              {formData.duration} Days
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] mb-1">Est. Installment</p>
            <p className="text-lg font-black text-accent tracking-tighter">
              ₹{estimatedInstallment.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-8 px-1">
        {/* Section 1: Core Identity */}
        <div>
          <h4 className="text-[11px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Core Identity
          </h4>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em] ml-1 mb-1.5 block">Full Name</label>
              <input
                id="customer-input-name"
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-bg border border-border/60 rounded-2xl h-14 px-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold"
                placeholder="Borrower's Name"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em] ml-1 mb-1.5 block">Phone Number</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-text-secondary opacity-40">+91</span>
                <input
                  id="customer-input-phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-14 pr-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold"
                  placeholder="10-digit number"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-1.5 ml-1">
                <label className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em]">Account ID</label>
                {!isEdit && (
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isIdUnique ? 'text-success' : 'text-danger'}`}>
                    {isCheckingId ? 'Checking...' : isIdUnique ? 'Available' : 'Taken'}
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-card border-y border-l border-border/60 rounded-l-2xl flex items-center justify-center pointer-events-none z-10">
                  <span className="text-[12px] font-black text-text-primary tracking-widest">CUST-</span>
                </div>
                <input
                  id="customer-input-id-suffix"
                  type="number"
                  required
                  readOnly={isEdit}
                  value={idSuffix}
                  onChange={e => handleIdChange(e.target.value)}
                  className={`w-full bg-bg border ${!isIdUnique && !isEdit ? 'border-danger/50 focus:border-danger' : 'border-border/60 focus:border-accent'} rounded-2xl h-14 pl-[5.5rem] pr-10 focus:outline-none focus:ring-4 transition-all text-[15px] font-black tracking-widest ${isEdit ? 'opacity-70' : ''}`}
                  placeholder="001"
                />
                {!isEdit && isSyncingId && (
                  <div className="absolute right-4">
                    <Loader2 size={16} className="text-text-secondary opacity-50 animate-spin" />
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
            {/* Loan Amount */}
            <div>
              <label className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em] ml-1 mb-1.5 block">Loan Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-text-secondary opacity-40">₹</span>
                <input
                  id="customer-input-loan"
                  type="number"
                  required
                  value={formData.loan}
                  onChange={e => {
                    setFormData({ ...formData, loan: e.target.value });
                    setShowLoanSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowLoanSuggestions(false), 200)}
                  className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-10 pr-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold"
                  placeholder="0.00"
                />
              </div>
              <AnimatePresence>
                {showLoanSuggestions && (
                  <motion.div
                    key="loan-suggestions"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex gap-2 overflow-x-auto pb-2 mt-3 no-scrollbar"
                  >
                    {quickAmounts.map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFormData({ ...formData, loan: amount.toString() })}
                        className="px-4 py-2 rounded-xl bg-card border border-border/40 text-[11px] font-bold text-text-primary whitespace-nowrap hover:border-accent hover:text-accent transition-colors shadow-sm"
                      >
                        +₹{amount.toLocaleString()}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
                  className={`text-[11px] font-bold transition-colors ${isCustomFrequency ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
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
                      className="w-16 h-9 px-2 bg-bg border border-border/60 rounded-xl text-center text-xs font-black focus:outline-none focus:border-accent"
                    />
                    <span className="text-xs text-text-secondary">Days</span>
                  </div>
                )}
              </div>
            </div>

            {/* Duration / Number of Days (1, 7, 30, 100, 200, 365 Days & Custom Input) */}
            <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] block">
                  Loan Tenure / Duration (Days)
                </label>
                <span className="text-xs font-black text-text-primary">
                  {formData.duration} Days Total
                </span>
              </div>

              {/* Quick Duration Buttons using exact number of days */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {durationPresets.map(preset => {
                  const isSelected = formData.duration === preset.days;
                  return (
                    <button
                      key={preset.days}
                      id={`duration-preset-${preset.days}`}
                      type="button"
                      onClick={() => handleSelectDurationDays(preset.days)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold border text-center transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-accent/15 border-accent text-accent font-black shadow-sm' 
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
                <label className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-widest mb-1.5 block">
                  Enter Custom Duration (Number of Days)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="customer-input-duration"
                    type="number"
                    min="1"
                    value={formData.duration || ''}
                    onChange={e => {
                      const days = parseInt(e.target.value) || 0;
                      setFormData(prev => ({
                        ...prev,
                        duration: days > 0 ? days : 1
                      }));
                    }}
                    className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-4 pr-16 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[15px] font-bold"
                    placeholder="e.g. 1, 7, 30, 100"
                  />
                  <span className="absolute right-4 text-xs font-black uppercase text-text-secondary opacity-50 tracking-wider pointer-events-none">
                    Days
                  </span>
                </div>
              </div>
            </div>

            {/* Date Pickers (Start Date & Calculated End Date) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em] ml-1 mb-1.5 block">Start Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" />
                  <input
                    id="customer-input-start-date"
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-9 pr-3 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[12px] font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em] ml-1 mb-1.5 block">End Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" />
                  <input
                    id="customer-input-end-date"
                    type="date"
                    required
                    value={endDate}
                    onChange={e => handleEndDateChange(e.target.value)}
                    className="w-full bg-bg border border-border/60 rounded-2xl h-14 pl-9 pr-3 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[12px] font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Notes */}
        <div>
          <label className="text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-[0.2em] ml-1 mb-1.5 flex items-center gap-2">
            Notes <span className="opacity-50">(Optional)</span>
          </label>
          <textarea
            id="customer-input-notes"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            className="w-full bg-bg border border-border/60 rounded-2xl p-4 min-h-[90px] focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-[13px]"
            placeholder="Add any additional details here..."
          />
        </div>

        {isEdit && onDelete && (
          <div className="pt-4 border-t border-border">
             <button
                id="customer-btn-delete"
                type="button"
                onClick={() => customer && onDelete(customer.id, customer.name)}
                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 border bg-danger/10 text-danger border-danger/20 active:scale-95 transition-all"
              >
                <Trash2 size={18} />
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
            className="flex-1 h-14 rounded-2xl bg-bg border border-border font-black text-[11px] uppercase tracking-widest text-text-secondary active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            id="customer-btn-save"
            onClick={handleSubmit}
            disabled={(!isIdUnique && !isEdit) || formData.phone.length !== 10 || Number(formData.loan) <= 0}
            className="flex-[2] h-14 rounded-2xl bg-accent text-white font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-accent/20 disabled:opacity-50 disabled:shadow-none cursor-pointer"
          >
            {isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
