import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Phone, CheckCircle2, AlertTriangle, X, Upload, Plus, Check, ShieldCheck, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { firestoreService, Customer } from '../services/firestoreService';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface ImportedContact {
  id: string;
  name: string;
  phone: string;
  rawPhone: string;
  cleanedPhone: string;
  isValid10Digit: boolean;
  selected: boolean;
  accountType: 'loan' | 'saving';
  loanAmount: number;
}

interface BatchContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCustomers: Customer[];
  onSuccess: () => void;
}

export function BatchContactImportModal({ isOpen, onClose, existingCustomers, onSuccess }: BatchContactImportModalProps) {
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [defaultLoanAmount, setDefaultLoanAmount] = useState<number>(10000);
  const [defaultAccountType, setDefaultAccountType] = useState<'loan' | 'saving'>('loan');
  const [manualInputText, setManualInputText] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);

  if (!isOpen) return null;

  // Helper to validate and normalize 10-digit phone number
  const validateAndNormalizePhone = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '');
    let tenDigits = digits;
    if (digits.length > 10 && digits.startsWith('91')) {
      tenDigits = digits.slice(-10);
    } else if (digits.length > 10) {
      tenDigits = digits.slice(-10);
    }
    const isValid10Digit = tenDigits.length === 10 && /^\d{10}$/.test(tenDigits);
    return {
      rawPhone: raw,
      cleanedPhone: tenDigits,
      isValid10Digit
    };
  };

  // 1. Pick from Device Address Book using Contact Picker API
  const handlePickFromDeviceContacts = async () => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      toast.error('Contact Picker API is not supported on this device/browser. Please use bulk paste or sample contacts below.');
      setShowManualPaste(true);
      return;
    }

    try {
      setIsImporting(true);
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const selectedContacts = await (navigator.contacts as any).select(props, opts);

      if (!selectedContacts || selectedContacts.length === 0) {
        setIsImporting(false);
        return;
      }

      const newImported: ImportedContact[] = [];
      selectedContacts.forEach((c: any, index: number) => {
        const name = (c.name && c.name[0]) ? c.name[0] : `Contact ${index + 1}`;
        const rawPhone = (c.tel && c.tel[0]) ? c.tel[0] : '';
        const { cleanedPhone, isValid10Digit } = validateAndNormalizePhone(rawPhone);

        newImported.push({
          id: `imp_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          phone: cleanedPhone || rawPhone,
          rawPhone,
          cleanedPhone,
          isValid10Digit,
          selected: isValid10Digit,
          accountType: defaultAccountType,
          loanAmount: defaultLoanAmount
        });
      });

      setContacts(prev => [...prev, ...newImported]);
      toast.success(`Imported ${newImported.length} contacts from device address book.`);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(error);
        toast.error('Failed to access device contacts. Try manual paste.');
        setShowManualPaste(true);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // 2. Parse manual paste (Name, Phone per line)
  const handleProcessManualPaste = () => {
    if (!manualInputText.trim()) {
      toast.error('Please enter contact details (Name, Phone)');
      return;
    }

    const lines = manualInputText.split('\n');
    const newImported: ImportedContact[] = [];

    lines.forEach((line, index) => {
      if (!line.trim()) return;
      const parts = line.split(/[,;\t|]+/);
      let name = parts[0] ? parts[0].trim() : `Contact ${index + 1}`;
      let rawPhone = parts[1] ? parts[1].trim() : (parts.length === 1 ? parts[0].trim() : '');

      if (parts.length === 1 && /^\d/.test(name)) {
        rawPhone = name;
        name = `Customer ${index + 1}`;
      }

      const { cleanedPhone, isValid10Digit } = validateAndNormalizePhone(rawPhone);

      newImported.push({
        id: `imp_man_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        phone: cleanedPhone || rawPhone,
        rawPhone,
        cleanedPhone,
        isValid10Digit,
        selected: isValid10Digit,
        accountType: defaultAccountType,
        loanAmount: defaultLoanAmount
      });
    });

    setContacts(prev => [...prev, ...newImported]);
    setManualInputText('');
    setShowManualPaste(false);
    toast.success(`Loaded ${newImported.length} contacts. Review validation below.`);
  };

  // Load Sample Contacts for testing/demo
  const handleLoadSampleContacts = () => {
    const samples = [
      { name: 'Rajesh Kumar', phone: '9876543210' },
      { name: 'Anita Sharma', phone: '9123456789' },
      { name: 'Vikram Singh', phone: '9988776655' },
      { name: 'Pooja Verma', phone: '8877665544' },
      { name: 'Invalid Phone Test', phone: '12345' }
    ];

    const newImported: ImportedContact[] = samples.map((s, index) => {
      const { cleanedPhone, isValid10Digit } = validateAndNormalizePhone(s.phone);
      return {
        id: `imp_sample_${Date.now()}_${index}`,
        name: s.name,
        phone: cleanedPhone || s.phone,
        rawPhone: s.phone,
        cleanedPhone,
        isValid10Digit,
        selected: isValid10Digit,
        accountType: defaultAccountType,
        loanAmount: defaultLoanAmount
      };
    });

    setContacts(prev => [...prev, ...newImported]);
    toast.success('Loaded 5 sample contacts for validation testing.');
  };

  const handleToggleSelect = (id: string) => {
    setContacts(prev => prev.map(c => {
      if (c.id === id && c.isValid10Digit) {
        return { ...c, selected: !c.selected };
      }
      return c;
    }));
  };

  const handleUpdateContactPhone = (id: string, newRawPhone: string) => {
    const { cleanedPhone, isValid10Digit } = validateAndNormalizePhone(newRawPhone);
    setContacts(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          rawPhone: newRawPhone,
          cleanedPhone,
          isValid10Digit,
          selected: isValid10Digit && c.selected
        };
      }
      return c;
    }));
  };

  const handleUpdateContactName = (id: string, newName: string) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
  };

  const handleRemoveContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  // Batch Register Selected & Valid Contacts with celebratory feedback
  const handleBatchRegister = async () => {
    const selectedValid = contacts.filter(c => c.selected && c.isValid10Digit);
    if (selectedValid.length === 0) {
      toast.error('No valid contacts selected for batch registration. Ensure phone numbers are 10 digits.');
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let failCount = 0;

    for (const c of selectedValid) {
      try {
        const cleanName = c.name.trim();
        const cleanPhone = c.cleanedPhone;
        const timestampId = `CUS_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 5)}`;
        
        const isSavingAcc = c.accountType === 'saving';
        const loanAmt = isSavingAcc ? 0 : c.loanAmount;
        const targetDep = isSavingAcc ? c.loanAmount : undefined;

        await firestoreService.saveCustomer({
          id: timestampId,
          name: cleanName,
          phone: cleanPhone,
          accountType: c.accountType,
          loan: loanAmt,
          loanAmount: loanAmt,
          targetDeposit: targetDep,
          paid: 0,
          pending: isSavingAcc ? 0 : loanAmt,
          advanceBalance: 0,
          startDate: Date.now(),
          endDate: Date.now() + (100 * 24 * 60 * 60 * 1000),
          frequency: 'daily',
          frequencyDays: 1,
          durationDays: 100,
          notes: 'Batch imported from contacts',
          uniqueKey: `${cleanName.toLowerCase()}_${cleanPhone}_${c.accountType}_${timestampId}`
        });

        successCount++;
      } catch (err) {
        console.error('Batch register error for contact:', c.name, err);
        failCount++;
      }
    }

    setIsSaving(false);

    if (successCount > 0) {
      // Trigger canvas-confetti celebration
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {
        console.error(e);
      }

      setRegisteredCount(successCount);
      setShowSuccessAnim(true);

      setTimeout(() => {
        toast.success(`Successfully registered ${successCount} customers in batch!`);
        if (failCount > 0) {
          toast.warning(`${failCount} contacts failed to register (possibly duplicate name/phone).`);
        }
        onSuccess();
        onClose();
      }, 1800);
    } else {
      toast.error('Batch registration failed. Check for duplicate phone numbers.');
    }
  };

  const validCount = contacts.filter(c => c.isValid10Digit).length;
  const selectedCount = contacts.filter(c => c.selected && c.isValid10Digit).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border/80 w-full max-w-3xl max-h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Success celebratory overlay */}
        <AnimatePresence>
          {showSuccessAnim && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-card/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4"
            >
              <div className="w-24 h-24 bg-accent/15 text-accent rounded-full flex items-center justify-center shadow-inner relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  <CheckCircle2 size={56} className="text-accent" />
                </motion.div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-md animate-bounce">
                  <Sparkles size={16} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black text-text-primary uppercase tracking-wider">Batch Import Successful!</h3>
                <p className="text-sm text-text-secondary font-medium mt-1">
                  Successfully registered <span className="text-accent font-bold">{registeredCount}</span> contacts into your customer list.
                </p>
              </div>
              <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5 }}
                  className="h-full bg-accent"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent/15 text-accent rounded-2xl flex items-center justify-center shadow-inner">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-base font-black text-text-primary uppercase tracking-wider">Batch Import Contacts</h2>
              <p className="text-xs text-text-secondary font-medium">Select & validate contacts from your phone's address book</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handlePickFromDeviceContacts}
              disabled={isImporting}
              className="p-4 rounded-2xl bg-accent text-white flex flex-col items-center justify-center gap-2 text-center shadow-lg shadow-accent/20 cursor-pointer disabled:opacity-50"
            >
              {isImporting ? <Loader2 size={24} className="animate-spin" /> : <Users size={24} />}
              <span className="text-xs font-black uppercase tracking-wider">Pick From Device</span>
              <span className="text-[10px] opacity-80">Select multiple from phone book</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowManualPaste(!showManualPaste)}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-accent/40 flex flex-col items-center justify-center gap-2 text-center text-text-primary transition-all cursor-pointer shadow-xs"
            >
              <Upload size={24} className="text-accent" />
              <span className="text-xs font-black uppercase tracking-wider">Bulk Paste / CSV</span>
              <span className="text-[10px] text-text-secondary">Paste Name, Phone per line</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleLoadSampleContacts}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-accent/40 flex flex-col items-center justify-center gap-2 text-center text-text-primary transition-all cursor-pointer shadow-xs"
            >
              <Plus size={24} className="text-accent" />
              <span className="text-xs font-black uppercase tracking-wider">Load Samples</span>
              <span className="text-[10px] text-text-secondary">Test validation instantly</span>
            </motion.button>
          </div>

          {/* Bulk Paste Drawer */}
          {showManualPaste && (
            <div className="p-4 bg-muted/50 rounded-2xl border border-border/80 space-y-3 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-text-primary">Paste Contacts (Name, Phone)</span>
                <button onClick={() => setShowManualPaste(false)} className="text-text-secondary hover:text-text-primary"><X size={14} /></button>
              </div>
              <textarea
                value={manualInputText}
                onChange={e => setManualInputText(e.target.value)}
                placeholder="Rahul Kumar, 9876543210&#10;Anita Sharma, 9123456789&#10;Vikram Singh, 9988776655"
                rows={4}
                className="w-full p-3 bg-card border border-border/80 rounded-xl text-xs font-mono outline-none focus:border-accent transition-all"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowManualPaste(false)}
                  className="px-4 py-2 rounded-xl bg-card text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessManualPaste}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  Import & Validate
                </button>
              </div>
            </div>
          )}

          {/* Defaults for batch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/40 rounded-2xl border border-border/50">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-secondary block mb-1">Default Account Type</label>
              <select
                value={defaultAccountType}
                onChange={e => setDefaultAccountType(e.target.value as any)}
                className="w-full h-10 px-3 bg-card border border-border/80 rounded-xl text-xs font-bold text-text-primary outline-none focus:border-accent"
              >
                <option value="loan">Loan Account</option>
                <option value="saving">Saving Account</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-secondary block mb-1">Default Amount (₹)</label>
              <input
                type="number"
                value={defaultLoanAmount}
                onChange={e => setDefaultLoanAmount(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 bg-card border border-border/80 rounded-xl text-xs font-bold text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Validation & Contacts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-text-secondary">Imported Contacts Review</h3>
                <span className="px-2 py-0.5 bg-accent/15 text-accent rounded-md text-[10px] font-mono font-bold">
                  {validCount} Valid / {contacts.length} Total
                </span>
              </div>
              {contacts.length > 0 && (
                <button
                  onClick={() => {
                    const allValidSelected = contacts.every(c => !c.isValid10Digit || c.selected);
                    setContacts(prev => prev.map(c => c.isValid10Digit ? { ...c, selected: !allValidSelected } : c));
                  }}
                  className="text-[10px] font-bold text-accent hover:underline cursor-pointer"
                >
                  Toggle Select All Valid
                </button>
              )}
            </div>

            {contacts.length === 0 ? (
              <div className="py-16 text-center bg-card/40 rounded-2xl border border-dashed border-border/30 flex flex-col items-center justify-center gap-3">
                <Users size={36} className="text-text-secondary opacity-30" />
                <p className="text-xs font-bold text-text-secondary">No contacts imported yet.</p>
                <p className="text-[10px] text-text-secondary opacity-60 max-w-xs">
                  Click "Pick From Device" or "Bulk Paste" above to import and validate 10-digit phone numbers.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {contacts.map(contact => (
                  <div
                    key={contact.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                      contact.selected && contact.isValid10Digit
                        ? 'bg-accent/5 border-accent/40 shadow-xs'
                        : contact.isValid10Digit
                        ? 'bg-card border-border/80'
                        : 'bg-red-500/5 border-red-500/30'
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={contact.selected}
                      disabled={!contact.isValid10Digit}
                      onChange={() => handleToggleSelect(contact.id)}
                      className="w-4 h-4 accent-accent rounded cursor-pointer disabled:opacity-30"
                    />

                    {/* Name */}
                    <div className="flex-1 min-w-[120px]">
                      <input
                        type="text"
                        value={contact.name}
                        onChange={e => handleUpdateContactName(contact.id, e.target.value)}
                        className="w-full bg-transparent text-xs font-bold text-text-primary outline-none border-b border-transparent focus:border-accent"
                        placeholder="Customer Name"
                      />
                    </div>

                    {/* Phone & Validation Step */}
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <Phone size={12} className="text-text-secondary shrink-0" />
                        <input
                          type="text"
                          value={contact.rawPhone}
                          onChange={e => handleUpdateContactPhone(contact.id, e.target.value)}
                          className={`w-full bg-card px-2 py-1 rounded-lg text-xs font-mono font-bold outline-none border ${
                            contact.isValid10Digit ? 'border-border/80 text-text-primary' : 'border-red-500/50 text-red-500'
                          }`}
                          placeholder="10-digit phone"
                        />
                      </div>
                      <div className="flex items-center gap-1 px-1">
                        {contact.isValid10Digit ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-success">
                            <CheckCircle2 size={11} /> Valid 10-Digit ({contact.cleanedPhone})
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-red-500">
                            <AlertTriangle size={11} /> Invalid format (Must be exactly 10 digits)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete item */}
                    <button
                      onClick={() => handleRemoveContact(contact.id)}
                      className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center text-text-secondary hover:text-red-500 transition-colors cursor-pointer shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 bg-muted/30 flex items-center justify-between">
          <span className="text-xs font-bold text-text-secondary">
            {selectedCount} contact{selectedCount === 1 ? '' : 's'} ready for registration
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-card border border-border/80 text-xs font-bold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              Cancel
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={selectedCount === 0 || isSaving}
              onClick={handleBatchRegister}
              className="px-6 py-2.5 rounded-xl bg-accent text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-accent/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />}
              Register Selected ({selectedCount})
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
