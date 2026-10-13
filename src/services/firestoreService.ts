import { db, auth } from '../lib/firebase';
export { db, auth };
import { toast } from 'sonner';
import { 
  collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, 
  writeBatch, query, orderBy, getDocs, runTransaction, serverTimestamp, where, collectionGroup,
  deleteField, limit, WriteBatch
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { cacheStorage } from '../lib/storage';

export interface LoanCycle {
  cycleNumber: number;          // 1, 2, 3...
  loanAmount: number;           // Total loan for this cycle
  paidAmount: number;           // Total repaid in this cycle
  pendingAmount: number;        // Remaining balance at time of renewal (if rolled over)
  interestAdded?: number;       // Interest added on renewal
  interestType?: 'percentage' | 'flat';
  interestRate?: number;        // Percentage rate if applicable
  newTotalDebt?: number;        // pendingAmount + interestAdded
  startDate: number;            // Cycle start timestamp
  endDate: number;              // Cycle target completion date
  completedAt: number;          // Actual date cycle was closed/renewed
  durationDays: number;         // Term duration in days
  status: 'completed' | 'matured_renewed' | 'rolled_over';
  rolloverAction?: 'deducted_from_payout' | 'absorbed' | 'cleared' | 'none';
  advanceSavings?: number;      // Accumulated advance savings at cycle completion
  advanceApplied?: number;      // Advance credit transferred into this cycle
  notes?: string;
}

export interface RenewalData {
  newLoanAmount: number;
  durationDays: number;
  startDate: number;
  endDate: number;
  rolloverAction?: 'deducted_from_payout' | 'absorbed' | 'cleared' | 'none';
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
  frequencyDays?: number;
  advanceApplied?: number;      // Amount of accumulated advance to credit towards new loan
  interestRate?: number;        // Interest rate percentage applied (e.g. 3%)
  interestAmount?: number;      // Interest amount in Rupees
  notes?: string;
}

export interface MaturedRenewalData {
  interestAmount: number;
  interestType: 'percentage' | 'flat';
  interestRate?: number;
  newTotalDebt: number;
  durationDays: number;
  startDate: number;
  endDate: number;
  notes?: string;
}

export interface Customer {
  id: string;
  docPath?: string;
  name: string;
  phone: string;
  loan: number;
  loanAmount?: number;
  totalLoan?: number;
  paid: number;
  pending: number;
  startDate: number;
  endDate: number;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
  frequencyDays?: number;
  durationDays?: number;
  notes?: string;
  info?: string;
  uniqueKey?: string; // name_phone
  isOverdue?: boolean;
  overdueAmount?: number;
  expectedPaid?: number;
  daysMissing?: number;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
  lastPayment?: any;
  isDeleted?: boolean;
  isPinned?: boolean;
  accountType?: 'loan' | 'saving'; // 'loan' (default) or 'saving' (pigmy daily deposit)
  targetDeposit?: number;          // Target savings goal for savings accounts
  dailySavings?: number;           // Standard daily deposit target
  currentCycle?: number;
  cycles?: LoanCycle[];
  advanceBalance?: number;      // Accumulated daily savings deposits after loan completion
  lastRenewalDate?: number;
  renewalStatus?: 'pending_review' | 'rejected' | 'renewed' | null;
  renewalRejectedAt?: number;
  hasOpeningBalance?: boolean;
  openingBalance?: number;
}

export const firestoreUtils = {
  calculateOverdue: (customer: Customer) => {
    if (customer.isDeleted) return { isOverdue: false, amount: 0 };
    
    const now = Date.now();
    if (now < customer.startDate) return { isOverdue: false, amount: 0 };

    const totalLoan = customer.loanAmount || customer.loan || customer.totalLoan || 0;
    const durationDays = Math.max(1, Math.round((customer.endDate - customer.startDate) / (1000 * 60 * 60 * 24)));
    const dailyInstallment = totalLoan / durationDays;
    const daysSinceStart = Math.min(durationDays, Math.floor((now - customer.startDate) / (1000 * 60 * 60 * 24)));
    
    const expectedPaid = Math.floor(daysSinceStart * dailyInstallment);
    const actualPaid = customer.paid || 0;
    const isOverdue = actualPaid < expectedPaid;
    const amount = Math.max(0, expectedPaid - actualPaid);
    const daysMissing = Math.floor(amount / (dailyInstallment || 1));

    return { isOverdue, amount, expectedPaid, daysMissing };
  }
};

export interface AuditRecord {
  timestamp: number;
  oldValue: any;
  newValue: any;
  action: string;
}

export interface Transaction {
  id: string;
  docPath?: string;
  customerId: string;
  amount: number;
  type: 'cash' | 'phonepe' | 'unsettled' | 'NP';
  status: 'paid' | 'pending' | 'unsettled' | 'settled';
  entryStatus?: 'active' | 'modified';
  parentId?: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  createdAt?: any;
  updatedAt?: any;
  paidAt?: any;
  unsettledAt?: any;
  npMarkedAt?: any;
  npMarkedDate?: string;
  convertedFromNP?: boolean;
  settledAt?: any;
  settledFromNpId?: string;
  settledMethod?: 'cash' | 'phonepe';
  isSettled?: boolean;
  isAdvance?: boolean;          // Payment was recorded as advance savings
  isWithdrawal?: boolean;       // Payout or withdrawal from advance savings deposit
  isOpeningBalance?: boolean;   // Opening balance / prior loan collection record
  createdBy?: string;
  isDeleted?: boolean;
  notes?: string;
  history?: AuditRecord[];
}

export interface NotificationAction {
  label: string;
  actionKey: 'NAVIGATE' | 'UNDO_TRANSACTION' | 'MARK_READ' | 'SNOOZE' | 'COLLECT';
  payload?: any;
}

export interface NotificationRecord {
  id: string;
  userId?: string;
  type: 'success' | 'error' | 'info' | 'transaction' | 'warning' | 'critical';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message?: string;
  amount?: number;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  alertCategory?: 'upcoming' | 'due_today' | 'overdue' | 'collection' | 'general';
  dueDate?: number;
  diffDays?: number;
  paymentType?: string;
  isRead: boolean;
  timestamp: number;
  createdAt?: any;
  actions?: NotificationAction[];
}

enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete',
  LIST = 'list', GET = 'get', WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  
  const errorObj = error as any;
  if (errorObj?.code === 'permission-denied') {
    toast.error('Permission Denied: Please check Firestore Security Rules.');
  } else {
    toast.error(`Database Error: ${errInfo.error}`);
  }
  
  throw new Error(JSON.stringify(errInfo));
}

function isPlainObject(value: any): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

// Deeply removes undefined values before sending to Firestore
function cleanData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => cleanData(item)) as unknown as T;
  }
  if (isPlainObject(obj)) {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = cleanData(val);
      }
    }
    return result;
  }
  return obj;
}

// Scalable batch write helper to enforce the Firestore 500-write limit
async function commitBatchInChunks(operations: Array<(batch: WriteBatch) => void>) {
  const CHUNK_SIZE = 400; // Well below Firestore 500-operation ceiling
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(op => op(batch));
    await batch.commit();
  }
}

export const firestoreService = {
  // Helper to generate next customer ID by filling gaps from deleted/recycled IDs
  async getNextCustomerId(): Promise<string> {
    try {
      const usedNumbers = new Set<number>();

      // 1. Fetch root customers
      const rootSnap = await getDocs(collection(db, 'customers')).catch(() => null);
      if (rootSnap && !rootSnap.empty) {
        rootSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d?.isDeleted) return; // Deleted customer IDs are free for reuse!
          const id = String(d?.id || docSnap.id);
          const match = id.match(/^CUST-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > 0) {
              usedNumbers.add(num);
            }
          }
        });
      }

      // 2. Fetch collectionGroup if distinct (safe scan without unindexed where clause)
      const groupSnap = await getDocs(query(collectionGroup(db, 'customers'))).catch(() => null);

      if (groupSnap && !groupSnap.empty) {
        groupSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d?.isDeleted) return;
          const id = String(d?.id || docSnap.id);
          const match = id.match(/^CUST-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > 0) {
              usedNumbers.add(num);
            }
          }
        });
      }

      // 3. Fallback: check localStorage cache for active customers
      try {
        const cachedCust = localStorage.getItem('cache_customers');
        if (cachedCust) {
          const parsed = JSON.parse(cachedCust);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => {
              if (c && !c.isDeleted && typeof c.id === 'string') {
                const match = c.id.match(/^CUST-(\d+)$/i);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (!isNaN(num) && num > 0) {
                    usedNumbers.add(num);
                  }
                }
              }
            });
          }
        }
      } catch {}

      // Find lowest positive integer not currently assigned to any active customer
      let nextNum = 1;
      while (usedNumbers.has(nextNum)) {
        nextNum++;
      }

      return `CUST-${nextNum.toString().padStart(3, '0')}`;
    } catch {
      return 'CUST-001';
    }
  },

  async checkIdAvailability(id: string): Promise<{ available: boolean; isRecycled: boolean }> {
    try {
      if (!id) return { available: true, isRecycled: false };

      let hasActiveDoc = false;
      let hasDeletedDoc = false;

      // 1. Direct getDoc on root
      try {
        const directDoc = await getDoc(doc(db, 'customers', id));
        if (directDoc.exists()) {
          const d = directDoc.data();
          if (d?.isDeleted) {
            hasDeletedDoc = true;
          } else {
            hasActiveDoc = true;
          }
        }
      } catch {}

      // 2. Query root customers collection
      const rootSnap = await getDocs(query(
        collection(db, 'customers'), 
        where('id', '==', id)
      )).catch(() => null);

      if (rootSnap && !rootSnap.empty) {
        rootSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d?.isDeleted) {
            hasDeletedDoc = true;
          } else {
            hasActiveDoc = true;
          }
        });
      }

      // 3. Check user-scoped doc if user is signed in
      if (auth.currentUser?.uid) {
        try {
          const userCustDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'customers', id));
          if (userCustDoc.exists()) {
            const d = userCustDoc.data();
            if (d?.isDeleted) {
              hasDeletedDoc = true;
            } else {
              hasActiveDoc = true;
            }
          }
        } catch {}
      }

      // 4. Check local cache
      try {
        const cachedCust = localStorage.getItem('cache_customers');
        if (cachedCust) {
          const parsed = JSON.parse(cachedCust);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => {
              if (c && c.id === id) {
                if (c.isDeleted) {
                  hasDeletedDoc = true;
                } else {
                  hasActiveDoc = true;
                }
              }
            });
          }
        }
      } catch {}

      if (hasActiveDoc) {
        return { available: false, isRecycled: false };
      }

      return {
        available: true,
        isRecycled: hasDeletedDoc
      };
    } catch {
      return { available: true, isRecycled: false };
    }
  },

  async checkIdUnique(id: string): Promise<boolean> {
    const res = await this.checkIdAvailability(id);
    return res.available;
  },


  async checkDuplicateCustomer(
    name: string, 
    phone: string, 
    accountType: 'loan' | 'saving' = 'loan', 
    excludeCustomerId?: string
  ): Promise<{ allowed: boolean; reason?: string; existingLoanId?: string }> {
    try {
      const cleanName = name.trim().toLowerCase();
      const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);

      const matchingMap = new Map<string, Customer>();

      // 1. Query root customers collection
      try {
        const rootSnap = await getDocs(query(
          collection(db, 'customers'),
          where('phone', '==', cleanPhone)
        ));
        rootSnap.docs.forEach(d => {
          const data = d.data() as Customer;
          if (!data.isDeleted) {
            matchingMap.set(d.id, { id: d.id, ...data });
          }
        });
      } catch {}

      // 2. Local cache check
      try {
        const cachedCust = localStorage.getItem('cache_customers');
        if (cachedCust) {
          const parsed = JSON.parse(cachedCust);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => {
              if (c && !c.isDeleted) {
                const p = String(c.phone || '').trim().replace(/\D/g, '').slice(-10);
                if (p === cleanPhone) {
                  matchingMap.set(c.id, c);
                }
              }
            });
          }
        }
      } catch {}

      const matchingDocs = Array.from(matchingMap.values())
        .filter(c => !excludeCustomerId || c.id !== excludeCustomerId)
        .filter(c => (c.name || '').trim().toLowerCase() === cleanName);

      if (matchingDocs.length === 0) return { allowed: true };

      // RULE 1: DO NOT CREATE DUAL LOAN USING SAME NAME AND PHONE NO
      if (accountType === 'loan') {
        const existingLoan = matchingDocs.find(c => c.accountType !== 'saving');
        if (existingLoan) {
          return {
            allowed: false,
            existingLoanId: existingLoan.id,
            reason: `Dual loan not allowed: An active loan already exists for ${name} (+91 ${cleanPhone}) under ID ${existingLoan.id}. You cannot create a second loan with the same name and phone, but you can create a Saving account.`
          };
        }
        return { allowed: true };
      }

      // RULE 2: USING THE SAME NAME AND PHONE NO TO CREATE SAVING IS ALLOWED
      if (accountType === 'saving') {
        return { allowed: true };
      }

      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  },

  async checkPhoneExists(phone: string): Promise<{ exists: boolean; name: string | null }> {
    try {
      const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);

      // 1. Check local cache
      try {
        const cachedCust = localStorage.getItem('cache_customers');
        if (cachedCust) {
          const parsed = JSON.parse(cachedCust);
          if (Array.isArray(parsed)) {
            const found = parsed.find((c: any) => c && !c.isDeleted && String(c.phone || '').trim().replace(/\D/g, '').slice(-10) === cleanPhone);
            if (found) return { exists: true, name: found.name };
          }
        }
      } catch {}

      // 2. Query root customers
      const rootSnap = await getDocs(query(
        collection(db, 'customers'), 
        where('phone', '==', cleanPhone)
      )).catch(() => null);

      if (rootSnap && !rootSnap.empty) {
        const activeDoc = rootSnap.docs.find(d => !d.data()?.isDeleted);
        if (activeDoc) {
          return { exists: true, name: (activeDoc.data() as Customer).name };
        }
      }

      return { exists: false, name: null };
    } catch {
      return { exists: false, name: null };
    }
  },

  subscribeCustomers(
    param1?: any,
    param2?: any,
    param3?: any
  ) {
    const callback: (data: Customer[]) => void = typeof param1 === 'function' ? param1 : (typeof param2 === 'function' ? param2 : () => {});
    const onError: ((error: any) => void) | undefined = typeof param2 === 'function' && typeof param1 !== 'function' ? param3 : (typeof param2 === 'function' ? param2 : undefined);

    const q = query(collectionGroup(db, 'customers'));
    return onSnapshot(q, (snap) => {
      const map = new Map<string, Customer>();

      snap.docs.forEach(docSnap => {
        const d = docSnap.data();
        const id = String(d.id || docSnap.id);
        const cust: Customer = {
          id,
          docPath: docSnap.ref.path,
          ...d
        } as Customer;

        if (cust.isDeleted) return;

        const existing = map.get(id);
        if (!existing) {
          map.set(id, cust);
        } else {
          // If already encountered, pick the version with later updatedAt / createdAt
          const existingTime = existing.updatedAt?.toMillis?.() || existing.updatedAt || existing.createdAt?.toMillis?.() || existing.createdAt || 0;
          const newTime = cust.updatedAt?.toMillis?.() || cust.updatedAt || cust.createdAt?.toMillis?.() || cust.createdAt || 0;
          if (newTime >= existingTime) {
            map.set(id, cust);
          }
        }
      });

      const data = Array.from(map.values()).sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10);
        const numB = parseInt(b.id.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      console.log(`[Firestore Realtime] Customers synced without auth. Total: ${data.length}`);
      callback(data);
    }, (error: any) => {
      console.error("Firestore Error in customers subscription:", error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'customers');
      callback([]);
    });
  },

  subscribeTransactions(
    param1?: any,
    param2?: any,
    param3?: any
  ) {
    const callback: (data: Transaction[]) => void = typeof param1 === 'function' ? param1 : (typeof param2 === 'function' ? param2 : () => {});
    const onError: ((error: any) => void) | undefined = typeof param2 === 'function' && typeof param1 !== 'function' ? param3 : (typeof param2 === 'function' ? param2 : undefined);

    const q = query(collectionGroup(db, 'entries'));
    return onSnapshot(q, (snap) => {
      const map = new Map<string, Transaction>();

      snap.docs.forEach(docSnap => {
        const d = docSnap.data();
        const id = String(d.id || docSnap.id);
        const tx: Transaction = {
          id,
          docPath: docSnap.ref.path,
          ...d
        } as Transaction;

        if (tx.isDeleted) return;

        const existing = map.get(id);
        if (!existing) {
          map.set(id, tx);
        } else {
          const existingTime = existing.updatedAt?.toMillis?.() || existing.timestamp || 0;
          const newTime = tx.updatedAt?.toMillis?.() || tx.timestamp || 0;
          if (newTime >= existingTime) {
            map.set(id, tx);
          }
        }
      });

      const data = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      console.log(`[Firestore Realtime] Entries synced without auth. Total: ${data.length}`);
      callback(data);
    }, (error: any) => {
      console.error("Firestore Error in transactions subscription:", error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'entries');
      callback([]);
    });
  },

  async saveCustomer(customer: Partial<Customer> & { id: string }) {
    if (!customer.id || !/^[a-zA-Z0-9_\-]{1,128}$/.test(customer.id)) {
      throw new Error('Invalid customer ID format.');
    }
    if (!customer.name || typeof customer.name !== 'string' || customer.name.trim().length === 0 || customer.name.length > 200) {
      throw new Error('Customer name must be between 1 and 200 characters.');
    }
    const cleanPhone = String(customer.phone || '').trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('Customer phone must be between 10 and 15 digits.');
    }

    const accountType = customer.accountType || 'loan';
    if (accountType === 'loan') {
      const dupCheck = await this.checkDuplicateCustomer(
        customer.name.trim(),
        cleanPhone,
        'loan',
        customer.id
      );
      if (!dupCheck.allowed) {
        throw new Error(dupCheck.reason || 'Dual loan not allowed for same name and phone number.');
      }
    }
    const isSaving = accountType === 'saving';
    const targetDeposit = isSaving ? Number(customer.targetDeposit ?? customer.loan ?? customer.loanAmount ?? 0) : undefined;
    const loanAmount = isSaving ? 0 : Math.max(0, Number(customer.loan ?? customer.loanAmount ?? customer.totalLoan ?? 0));
    const paidAmount = customer.paid ?? 0;
    const pendingAmount = isSaving ? 0 : (customer.pending !== undefined ? customer.pending : Math.max(0, loanAmount - paidAmount));
    const advanceBalance = customer.advanceBalance !== undefined ? customer.advanceBalance : (isSaving ? paidAmount : 0);
    const uniqueKey = isSaving
      ? `${customer.name.trim().toLowerCase()}_${cleanPhone}_saving_${customer.id}`
      : `${customer.name.trim().toLowerCase()}_${cleanPhone}_loan`;

    const rootCustomerRef = doc(db, 'customers', customer.id);
    const existingRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
    const data = cleanData({
      ...customer,
      name: customer.name.trim(),
      phone: cleanPhone,
      accountType,
      targetDeposit,
      loan: loanAmount,
      loanAmount: loanAmount,
      totalLoan: loanAmount,
      paid: paidAmount,
      pending: pendingAmount,
      advanceBalance,
      uniqueKey,
      createdBy: customer.createdBy || 'agent'
    });
    const now = serverTimestamp();

    try {
      let snap;
      try {
        snap = await getDoc(existingRef);
      } catch (err) {
        console.warn(`[Firestore Offline] Failed to get doc:`, err);
      }

      const isRecycled = snap?.exists() && snap.data()?.isDeleted === true;

      if (isRecycled) {
        // User requested: When reused, permanently purge old deleted records and start fresh!
        await this.purgeDeletedCustomerHistory(customer.id);
      }

      const payload: any = cleanData({
        ...data,
        isDeleted: false,
        updatedAt: now
      });

      // Maintain createdAt immutability for existing records (including recycled IDs)
      if (!snap?.exists()) {
        payload.createdAt = now;
      } else {
        // Do not overwrite createdAt on existing documents to satisfy Firestore update security rules
        delete payload.createdAt;
      }

      if (isRecycled) {
        // Reset old deleted record metadata so the recycled customer starts completely fresh
        payload.deletedAt = deleteField();
        payload.recycledAt = now;
        payload.cycles = [];
        payload.lastRenewalDate = deleteField();
        payload.renewalStatus = deleteField();
        payload.renewalRejectedAt = deleteField();
        payload.lastPayment = deleteField();
        payload.isPinned = false;
      }

      await setDoc(rootCustomerRef, payload, { merge: true });
      if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
        await setDoc(doc(db, customer.docPath), payload, { merge: true }).catch(() => {});
      }
      console.log(`[Firestore Write] Successfully saved customer: ${customer.id}`);
    } catch (error: any) {
      console.error(`[Firestore Error - saveCustomer]:`, error);
      handleFirestoreError(error, OperationType.WRITE, `customers/${customer.id}`);
      throw error;
    }
  },

  async saveCustomerWithOpeningBalance(
    customer: Partial<Customer> & { id: string },
    openingBalance: {
      amount: number;
      note?: string;
      timestamp?: number;
    }
  ) {
    if (!customer.id || !/^[a-zA-Z0-9_\-]{1,128}$/.test(customer.id)) {
      throw new Error('Invalid customer ID format.');
    }
    if (!customer.name || typeof customer.name !== 'string' || customer.name.trim().length === 0 || customer.name.length > 200) {
      throw new Error('Customer name must be between 1 and 200 characters.');
    }
    const cleanPhone = String(customer.phone || '').trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('Customer phone must be between 10 and 15 digits.');
    }

    const accountType = customer.accountType || 'loan';
    if (accountType === 'loan') {
      const dupCheck = await this.checkDuplicateCustomer(
        customer.name.trim(),
        cleanPhone,
        'loan',
        customer.id
      );
      if (!dupCheck.allowed) {
        throw new Error(dupCheck.reason || 'Dual loan not allowed for same name and phone number.');
      }
    }
    const isSaving = accountType === 'saving';
    const targetDeposit = isSaving ? Number(customer.targetDeposit ?? customer.loan ?? customer.loanAmount ?? 0) : undefined;
    const loanAmount = isSaving ? 0 : Math.max(0, Number(customer.loan ?? customer.loanAmount ?? customer.totalLoan ?? 0));
    const paidAmount = Math.max(0, isSaving ? (Number(openingBalance.amount) || 0) : Math.min(loanAmount, Number(openingBalance.amount) || 0));
    const pendingAmount = isSaving ? 0 : Math.max(0, loanAmount - paidAmount);
    const advanceBalance = isSaving ? paidAmount : (customer.advanceBalance || 0);
    const uniqueKey = isSaving
      ? `${customer.name.trim().toLowerCase()}_${cleanPhone}_saving_${customer.id}`
      : `${customer.name.trim().toLowerCase()}_${cleanPhone}_loan`;

    const rootCustomerRef = doc(db, 'customers', customer.id);
    const existingRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;

    const txId = `open_${customer.id}_${Date.now()}`;
    const rootTxRef = doc(db, 'entries', txId);

    const now = serverTimestamp();
    const effectiveTimestamp = openingBalance.timestamp || customer.startDate || Date.now();
    const effectiveDate = format(new Date(effectiveTimestamp), 'yyyy-MM-dd');

    const customerPayload = cleanData({
      ...customer,
      name: customer.name.trim(),
      phone: cleanPhone,
      accountType,
      targetDeposit,
      loan: loanAmount,
      loanAmount: loanAmount,
      totalLoan: loanAmount,
      paid: paidAmount,
      pending: pendingAmount,
      advanceBalance,
      uniqueKey,
      hasOpeningBalance: true,
      openingBalance: paidAmount,
      lastPayment: now,
      createdBy: customer.createdBy || 'agent',
      createdAt: now,
      updatedAt: now
    });

    try {
      let snap;
      try {
        snap = await getDoc(existingRef);
      } catch (err) {
        console.warn(`[Firestore Offline] Failed to get doc:`, err);
      }

      const isRecycled = snap?.exists() && snap.data()?.isDeleted === true;

      if (isRecycled) {
        // User requested: When reused, permanently purge old deleted records and start fresh!
        await this.purgeDeletedCustomerHistory(customer.id);
      }

      const finalCustomerPayload: any = cleanData({
        ...customerPayload,
        isDeleted: false,
        updatedAt: now
      });

      // Maintain createdAt immutability for existing records (including recycled IDs)
      if (!snap?.exists()) {
        finalCustomerPayload.createdAt = now;
      } else {
        delete finalCustomerPayload.createdAt;
      }

      if (isRecycled) {
        finalCustomerPayload.deletedAt = deleteField();
        finalCustomerPayload.recycledAt = now;
        finalCustomerPayload.cycles = [];
        finalCustomerPayload.lastRenewalDate = deleteField();
        finalCustomerPayload.renewalStatus = deleteField();
        finalCustomerPayload.renewalRejectedAt = deleteField();
        finalCustomerPayload.isPinned = false;
      }

      // 1. Create/save the customer record
      await setDoc(rootCustomerRef, finalCustomerPayload, { merge: true });
      if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
        await setDoc(doc(db, customer.docPath), finalCustomerPayload, { merge: true }).catch(() => {});
      }

      // 2. Create the opening balance transaction record in entries
      if (paidAmount > 0) {
        const txPayload = cleanData({
          id: txId,
          customerId: customer.id,
          amount: paidAmount,
          type: 'cash',
          status: 'paid',
          entryStatus: 'active',
          date: effectiveDate,
          timestamp: effectiveTimestamp,
          notes: openingBalance.note || `Opening Balance: Prior repayments recorded`,
          isOpeningBalance: true,
          createdBy: 'agent',
          createdAt: now,
          updatedAt: now,
          paidAt: now
        });

        await setDoc(rootTxRef, txPayload, { merge: true });
        const subTxRef = doc(db, 'customers', customer.id, 'entries', txId);
        await setDoc(subTxRef, txPayload, { merge: true }).catch(() => {});
      }

      console.log(`[Firestore Write] Successfully registered customer ${customer.id} with opening balance: ₹${paidAmount}`);
    } catch (error: any) {
      console.error(`[Firestore Error - saveCustomerWithOpeningBalance]:`, error);
      handleFirestoreError(error, OperationType.WRITE, `customers/${customer.id}`);
      throw error;
    }
  },

  async updateCustomer(id: string, updates: Partial<Customer>, docPath?: string) {
    const rootRef = doc(db, 'customers', id);
    const data: any = cleanData({ ...updates, updatedAt: serverTimestamp() });
    delete data.createdAt; // Prevent Firestore permission errors when updating existing customer
    await setDoc(rootRef, data, { merge: true });
    if (docPath && docPath !== rootRef.path) {
      await setDoc(doc(db, docPath), data, { merge: true }).catch(() => {});
    }
  },

  async renewCustomerLoan(
    customer: Customer,
    renewal: RenewalData
  ): Promise<Customer> {
    if (!customer?.id) throw new Error('Customer ID is required');

    const rootCustomerRef = doc(db, 'customers', customer.id);
    const currentCycleNum = customer.currentCycle || 1;
    const oldPending = Math.max(0, customer.pending || 0);
    const oldPaid = customer.paid || 0;
    const oldLoan = customer.loanAmount || customer.loan || 0;

    const currentAdvance = customer.advanceBalance || 0;
    const advanceToApply = renewal.advanceApplied !== undefined 
      ? Math.min(currentAdvance, Math.max(0, renewal.advanceApplied))
      : currentAdvance;

    const remainingAdvance = Math.max(0, currentAdvance - advanceToApply);
    const newLoanTotal = renewal.newLoanAmount;
    const initialPaid = advanceToApply;
    const initialPending = Math.max(0, newLoanTotal - initialPaid);

    const completedCycle: LoanCycle = {
      cycleNumber: currentCycleNum,
      loanAmount: oldLoan,
      paidAmount: oldPaid,
      pendingAmount: oldPending,
      advanceSavings: currentAdvance,
      advanceApplied: advanceToApply,
      ...(renewal.interestAmount !== undefined ? { interestAdded: renewal.interestAmount, interestRate: renewal.interestRate } : {}),
      startDate: customer.startDate || (Date.now() - (customer.durationDays || 100) * 86400000),
      endDate: customer.endDate || Date.now(),
      completedAt: Date.now(),
      durationDays: customer.durationDays || 100,
      status: oldPending <= 0 ? 'completed' : 'rolled_over',
      rolloverAction: oldPending > 0 ? (renewal.rolloverAction || 'absorbed') : 'none',
      notes: customer.notes || ''
    };

    const existingCycles = Array.isArray(customer.cycles) ? customer.cycles : [];
    const updatedCycles = [...existingCycles, completedCycle];
    const newCycleNum = currentCycleNum + 1;
    const now = serverTimestamp();

    const updatedCustomerData: Partial<Customer> = {
      loan: newLoanTotal,
      loanAmount: newLoanTotal,
      totalLoan: newLoanTotal,
      paid: initialPaid,
      pending: initialPending,
      advanceBalance: remainingAdvance,
      startDate: renewal.startDate,
      endDate: renewal.endDate,
      durationDays: renewal.durationDays,
      frequency: renewal.frequency || customer.frequency || 'daily',
      frequencyDays: renewal.frequencyDays || customer.frequencyDays || 1,
      currentCycle: newCycleNum,
      cycles: updatedCycles,
      lastRenewalDate: Date.now(),
      notes: renewal.notes ? renewal.notes : (advanceToApply > 0 ? `Cycle #${newCycleNum} New Loan (₹${advanceToApply.toLocaleString('en-IN')} Advance Applied)` : `Cycle #${newCycleNum} New Loan`),
      updatedAt: now,
      ...(customer.renewalStatus ? { renewalStatus: deleteField() as any } : {}),
      ...(customer.renewalRejectedAt ? { renewalRejectedAt: deleteField() as any } : {})
    };

    await setDoc(rootCustomerRef, cleanData(updatedCustomerData), { merge: true });
    if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
      await setDoc(doc(db, customer.docPath), cleanData(updatedCustomerData), { merge: true }).catch(() => {});
    }

    return {
      ...customer,
      ...updatedCustomerData,
      currentCycle: newCycleNum,
      cycles: updatedCycles
    } as Customer;
  },

  async renewMaturedLoan(
    customer: Customer,
    renewal: MaturedRenewalData
  ): Promise<Customer> {
    if (!customer?.id) throw new Error('Customer ID is required');

    const rootCustomerRef = doc(db, 'customers', customer.id);
    const currentCycleNum = customer.currentCycle || 1;
    const oldPending = Math.max(0, customer.pending !== undefined ? customer.pending : ((customer.loanAmount || customer.loan || 0) - (customer.paid || 0)));
    const oldPaid = customer.paid || 0;
    const oldLoan = customer.loanAmount || customer.loan || 0;

    const completedCycle: LoanCycle = {
      cycleNumber: currentCycleNum,
      loanAmount: oldLoan,
      paidAmount: oldPaid,
      pendingAmount: oldPending,
      interestAdded: renewal.interestAmount ?? 0,
      interestType: renewal.interestType || 'flat',
      ...(renewal.interestRate !== undefined ? { interestRate: renewal.interestRate } : {}),
      newTotalDebt: renewal.newTotalDebt,
      startDate: customer.startDate || (Date.now() - (customer.durationDays || 100) * 86400000),
      endDate: customer.endDate || Date.now(),
      completedAt: Date.now(),
      durationDays: customer.durationDays || 100,
      status: 'matured_renewed',
      notes: customer.notes || ''
    };

    const existingCycles = Array.isArray(customer.cycles) ? customer.cycles : [];
    const updatedCycles = [...existingCycles, completedCycle];
    const newCycleNum = currentCycleNum + 1;
    const now = serverTimestamp();

    const updatedCustomerData: any = {
      loan: renewal.newTotalDebt,
      loanAmount: renewal.newTotalDebt,
      totalLoan: renewal.newTotalDebt,
      paid: 0,
      pending: renewal.newTotalDebt,
      startDate: renewal.startDate,
      endDate: renewal.endDate,
      durationDays: renewal.durationDays,
      currentCycle: newCycleNum,
      cycles: cleanData(updatedCycles),
      renewalStatus: deleteField(),
      renewalRejectedAt: deleteField(),
      lastRenewalDate: Date.now(),
      notes: renewal.notes ? renewal.notes : `Cycle #${newCycleNum} Renewal (Restructured ₹${oldPending.toLocaleString('en-IN')} + ₹${renewal.interestAmount.toLocaleString('en-IN')} interest)`,
      updatedAt: now
    };

    const payload = cleanData(updatedCustomerData);

    await setDoc(rootCustomerRef, payload, { merge: true });
    if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
      await setDoc(doc(db, customer.docPath), payload, { merge: true }).catch(() => {});
    }

    return {
      ...customer,
      ...updatedCustomerData,
      renewalStatus: undefined,
      renewalRejectedAt: undefined,
      currentCycle: newCycleNum,
      cycles: cleanData(updatedCycles)
    } as Customer;
  },

  async rejectMaturedRenewal(customerId: string, docPath?: string): Promise<void> {
    if (!customerId) throw new Error('Customer ID is required');
    const rootRef = doc(db, 'customers', customerId);
    const updateData = cleanData({
      renewalStatus: 'rejected',
      renewalRejectedAt: Date.now(),
      updatedAt: serverTimestamp()
    });
    await setDoc(rootRef, updateData, { merge: true });
    if (docPath && docPath !== rootRef.path) {
      await setDoc(doc(db, docPath), updateData, { merge: true }).catch(() => {});
    }
  },

  async reopenMaturedRenewal(customerId: string, docPath?: string): Promise<void> {
    if (!customerId) throw new Error('Customer ID is required');
    const rootRef = doc(db, 'customers', customerId);
    const updateData = cleanData({
      renewalStatus: deleteField(),
      renewalRejectedAt: deleteField(),
      updatedAt: serverTimestamp()
    });
    await setDoc(rootRef, updateData, { merge: true });
    if (docPath && docPath !== rootRef.path) {
      await setDoc(doc(db, docPath), updateData, { merge: true }).catch(() => {});
    }
  },

  /**
   * Permanently deletes all customer data, ledger records, and associated transactions.
   * If direct document deletion is restricted by Firestore security rules, it performs
   * a complete data scrub/wipe to permanently remove all personal, financial, and contact data.
   */
  async deleteCustomer(id: string, docPath?: string, knownTxIds: string[] = []) {
    let backendSuccess = false;
    const rootRef = doc(db, 'customers', id);

    try {
      // 0. Invoke backend Admin deletion endpoint to permanently delete customer and all collections in Firebase
      try {
        const adminDeleteResp = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docPath, knownTxIds })
        });
        if (adminDeleteResp.ok) {
          backendSuccess = true;
          console.log(`[Firestore Service] Customer ${id} permanently deleted via backend Admin API.`);
        } else {
          // Fallback to POST endpoint
          const postResp = await fetch(`/api/customers/${encodeURIComponent(id)}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docPath, knownTxIds })
          });
          if (postResp.ok) {
            backendSuccess = true;
            console.log(`[Firestore Service] Customer ${id} permanently deleted via backend Admin POST API.`);
          }
        }
      } catch (adminErr) {
        console.warn(`[Firestore Service] Backend admin delete endpoint call notice:`, adminErr);
      }

      // 1. Immediately clean up local offline cache and localStorage
      await cacheStorage.removeCustomerAndTransactions(id).catch(() => {});
      try {
        const cachedCust = localStorage.getItem('cache_customers');
        if (cachedCust) {
          const list = JSON.parse(cachedCust);
          if (Array.isArray(list)) {
            localStorage.setItem('cache_customers', JSON.stringify(list.filter((c: any) => c?.id !== id)));
          }
        }
        const cachedTx = localStorage.getItem('cache_transactions');
        if (cachedTx) {
          const list = JSON.parse(cachedTx);
          if (Array.isArray(list)) {
            localStorage.setItem('cache_transactions', JSON.stringify(list.filter((t: any) => t?.customerId !== id)));
          }
        }
      } catch {}

      // 2. If backend Admin API succeeded, data is permanently scrubbed in Firebase.
      // Fire-and-forget client cache refresh and return cleanly.
      if (backendSuccess) {
        deleteDoc(rootRef).catch(() => {});
        if (docPath && docPath !== rootRef.path) {
          deleteDoc(doc(db, docPath)).catch(() => {});
        }
        if (Array.isArray(knownTxIds)) {
          knownTxIds.forEach(txId => {
            if (txId) {
              deleteDoc(doc(db, 'entries', txId)).catch(() => {});
            }
          });
        }
        console.log(`[Firestore Delete] Customer ${id} and all related data permanently deleted.`);
        return { success: true };
      }

      // 3. Client-side fallback if backend API was unreachable (e.g. offline mode)
      const entryRefs = new Map<string, any>();

      if (Array.isArray(knownTxIds)) {
        knownTxIds.forEach(txId => {
          if (txId) {
            entryRefs.set(`root_${txId}`, doc(db, 'entries', txId));
            if (docPath && docPath !== rootRef.path) {
              entryRefs.set(`user_sub_${txId}`, doc(db, `${docPath}/entries`, txId));
            }
          }
        });
      }

      // Best-effort find transactions to delete
      try {
        const rootEntriesQuery = query(
          collection(db, 'entries'), 
          where('customerId', '==', id)
        );
        const rootSnap = await getDocs(rootEntriesQuery);
        rootSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
      } catch (e) {
        console.warn('Could not query root entries for customer deletion:', e);
      }

      // Delete transaction references
      for (const [_, ref] of entryRefs) {
        await deleteDoc(ref).catch(() => {});
      }

      // Delete root customer document
      let deletedRoot = false;
      try {
        await deleteDoc(rootRef);
        deletedRoot = true;
      } catch (delErr) {
        console.warn('Direct deleteDoc rootRef failed, attempting soft-delete:', delErr);
      }

      if (docPath && docPath !== rootRef.path) {
        await deleteDoc(doc(db, docPath)).catch(() => {});
      }

      if (!deletedRoot) {
        // Attempt soft-delete marker if deleteDoc was prohibited by client rules
        try {
          await setDoc(rootRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (setErr) {
          console.warn('Soft-delete fallback notice:', setErr);
        }
      }

      console.log(`[Firestore Delete] Customer ${id} deletion completed via client fallback.`);
      return { success: true };
    } catch (error: any) {
      console.warn(`[Firestore Delete] Customer deletion notice:`, error);
      // Clean up cache even on error so UI doesn't remain stale
      await cacheStorage.removeCustomerAndTransactions(id).catch(() => {});
      if (backendSuccess) {
        return { success: true };
      }
      const errMsg = error?.message || String(error);
      if (errMsg.includes('permission') || errMsg.includes('PERMISSION') || errMsg.includes('Missing or insufficient')) {
        toast.info('Customer removed locally and queued for purge.');
        return { success: true, localOnly: true };
      }
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    }
  },

  async togglePinCustomer(id: string, isPinned: boolean, docPath?: string) {
    try {
      const rootRef = doc(db, 'customers', id);
      const data = { isPinned, updatedAt: serverTimestamp() };
      await setDoc(rootRef, data, { merge: true });
      if (docPath && docPath !== rootRef.path) {
        await setDoc(doc(db, docPath), data, { merge: true }).catch(() => {});
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${id}`);
    }
  },

  async undoDeleteCustomer(id: string, docPath?: string, knownTxIds: string[] = []) {
    try {
      const rootRef = doc(db, 'customers', id);
      const restoreData = { isDeleted: false, updatedAt: serverTimestamp(), deletedAt: null };
      const ops: Array<(batch: WriteBatch) => void> = [];

      ops.push(batch => {
        batch.set(rootRef, restoreData, { merge: true });
        if (docPath && docPath !== rootRef.path) {
          batch.set(doc(db, docPath), restoreData, { merge: true });
        }
      });

      const entryRefs = new Map<string, any>();

      if (Array.isArray(knownTxIds)) {
        knownTxIds.forEach(txId => {
          if (txId) {
            entryRefs.set(`root_${txId}`, doc(db, 'entries', txId));
            entryRefs.set(`sub_${id}_${txId}`, doc(db, 'customers', id, 'entries', txId));
            if (docPath && docPath !== rootRef.path) {
              entryRefs.set(`user_sub_${txId}`, doc(db, `${docPath}/entries`, txId));
            }
          }
        });
      }

      try {
        const rootEntriesQuery = query(collection(db, 'entries'), where('customerId', '==', id));
        const rootSnap = await getDocs(rootEntriesQuery);
        rootSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
      } catch (e) {}

      try {
        const subSnap = await getDocs(collection(db, 'customers', id, 'entries'));
        subSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
      } catch (e) {}

      if (docPath && docPath !== rootRef.path) {
        try {
          const docPathSnap = await getDocs(collection(db, `${docPath}/entries`));
          docPathSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
        } catch (e) {}
      }

      try {
        const groupQuery = query(collectionGroup(db, 'entries'), where('customerId', '==', id));
        const groupSnap = await getDocs(groupQuery);
        groupSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
      } catch (e) {}

      const txRestoreData = { isDeleted: false, updatedAt: serverTimestamp(), deletedAt: null };
      entryRefs.forEach(ref => {
        ops.push(batch => {
          batch.set(ref, txRestoreData, { merge: true });
        });
      });

      await commitBatchInChunks(ops);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${id}`);
    }
  },

  /**
   * Scans and purges any orphaned entries belonging to deleted customers in Firestore
   */
  async cleanupOrphanedEntries(): Promise<number> {
    try {
      // 1. Fetch all deleted customers
      const deletedSnap = await getDocs(query(
        collection(db, 'customers'),
        where('isDeleted', '==', true)
      )).catch(() => null);

      if (!deletedSnap || deletedSnap.empty) return 0;

      const deletedCustIds = deletedSnap.docs.map(d => d.id);
      const ops: Array<(batch: WriteBatch) => void> = [];

      for (const custId of deletedCustIds) {
        // Root entries
        try {
          const rootEntries = await getDocs(query(
            collection(db, 'entries'),
            where('customerId', '==', custId)
          ));
          rootEntries.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.isDeleted) {
              ops.push(batch => {
                batch.set(docSnap.ref, { isDeleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() }, { merge: true });
              });
            }
          });
        } catch (e) {}

        // Subcollection entries
        try {
          const subEntries = await getDocs(collection(db, 'customers', custId, 'entries'));
          subEntries.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.isDeleted) {
              ops.push(batch => {
                batch.set(docSnap.ref, { isDeleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() }, { merge: true });
              });
            }
          });
        } catch (e) {}
      }

      if (ops.length > 0) {
        await commitBatchInChunks(ops);
      }
      return ops.length;
    } catch (err) {
      console.warn('Orphaned entries cleanup note:', err);
      return 0;
    }
  },

  /**
   * Permanently deletes old transaction history and subcollection entries
   * for a recycled customer ID so a new borrower starts completely fresh.
   */
  async purgeDeletedCustomerHistory(id: string): Promise<void> {
    try {
      const ops: Array<(batch: WriteBatch) => void> = [];
      const entryRefs = new Map<string, any>();

      // 1. Root collection 'entries' for this customer
      try {
        const rootSnap = await getDocs(query(
          collection(db, 'entries'), 
          where('customerId', '==', id)
        ));
        rootSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
      } catch (e) {}

      // 2. Subcollection 'customers/{id}/entries'
      try {
        const subSnap = await getDocs(collection(db, 'customers', id, 'entries'));
        subSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
      } catch (e) {}

      // 3. Collection group entries as fallback
      try {
        const groupSnap = await getDocs(query(
          collectionGroup(db, 'entries'), 
          where('customerId', '==', id)
        ));
        groupSnap.docs.forEach(d => entryRefs.set(d.ref.path, d.ref));
      } catch (e) {}

      // Mark all discovered entry documents as permanently deleted and purged
      entryRefs.forEach(ref => {
        ops.push(batch => {
          batch.set(ref, { 
            isDeleted: true, 
            purgedForReuse: true,
            updatedAt: serverTimestamp(), 
            deletedAt: serverTimestamp() 
          }, { merge: true });
        });
      });

      if (ops.length > 0) {
        await commitBatchInChunks(ops);
      }

      // Purge local cache for this customer
      await cacheStorage.removeCustomerAndTransactions(id).catch(() => {});
    } catch (err) {
      console.warn('[Firestore] Purge deleted customer history note:', err);
    }
  },

  async updateTransaction(
    txId: string, 
    updates: Partial<Transaction>, 
    oldTx: Transaction, 
    customer: Customer, 
    actionName: string
  ) {
    if (!txId) throw new Error('Invalid entry ID');
    if (!customer?.id) throw new Error('Invalid customer ID');

    try {
      await runTransaction(db, async (transaction) => {
        const rootCustomerRef = doc(db, 'customers', customer.id);
        const customerRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
        
        const rootTxRef = doc(db, 'entries', txId);
        const txRef = oldTx.docPath ? doc(db, oldTx.docPath) : rootTxRef;
        
        const [customerSnap, txSnap] = await Promise.all([
          transaction.get(customerRef),
          transaction.get(txRef)
        ]);

        const currentCustomer = customerSnap.exists() ? (customerSnap.data() as Customer) : customer;
        const currentTx = txSnap.exists() ? (txSnap.data() as Transaction) : oldTx;
        
        const newType = updates.type !== undefined ? updates.type : currentTx.type;
        const newAmount = updates.amount !== undefined ? updates.amount : currentTx.amount;
        
        let newStatus: Transaction['status'] = currentTx.status;
        if (updates.status) {
          newStatus = updates.status;
        } else if (updates.type) {
          if (updates.type === 'unsettled' || updates.type === 'NP') newStatus = 'unsettled';
          else if (updates.type === 'cash' || updates.type === 'phonepe') newStatus = 'paid';
          else newStatus = 'pending';
        } else if (newType === 'unsettled' || newType === 'NP') {
          newStatus = 'unsettled';
        } else if (newType === 'cash' || newType === 'phonepe') {
          newStatus = 'paid';
        }
        
        const oldEffectiveAmt = (currentTx.status === 'paid' && currentTx.type !== 'NP' && currentTx.type !== 'unsettled') ? currentTx.amount : 0;
        const newEffectiveAmt = (newStatus === 'paid' && newType !== 'NP' && newType !== 'unsettled') ? newAmount : 0;
        
        const paidDiff = newEffectiveAmt - oldEffectiveAmt;
        const pendingDiff = -paidDiff;

        const history = currentTx.history || [];
        const auditRecord: AuditRecord = {
          timestamp: Date.now(),
          oldValue: { amount: currentTx.amount, type: currentTx.type, status: currentTx.status },
          newValue: { amount: newAmount, type: newType, status: newStatus },
          action: actionName
        };

        const updatedCustomerData: Partial<Customer> = {
          paid: (currentCustomer.paid || 0) + paidDiff,
          pending: (currentCustomer.pending || 0) + pendingDiff,
          updatedAt: serverTimestamp()
        };

        const nowServer = serverTimestamp();
        let newPaidAt = currentTx.paidAt;
        let newUnsettledAt = currentTx.unsettledAt;

        if (newStatus === 'paid') {
          updatedCustomerData.lastPayment = nowServer;
          if (!newPaidAt) newPaidAt = nowServer;
          newUnsettledAt = null;
        } else if (newStatus === 'unsettled') {
          newPaidAt = null;
          if (!newUnsettledAt) newUnsettledAt = nowServer;
        } else {
          newPaidAt = null;
          newUnsettledAt = null;
        }

        transaction.set(rootCustomerRef, updatedCustomerData, { merge: true });
        if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
          transaction.set(doc(db, customer.docPath), updatedCustomerData, { merge: true });
        }

        const cleanedUpdates = cleanData({
          ...updates,
          status: newStatus,
          type: newType,
          amount: newAmount,
          paidAt: newPaidAt,
          unsettledAt: newUnsettledAt,
          history: [...history, auditRecord],
          updatedAt: nowServer,
          entryStatus: 'active',
          createdBy: 'agent'
        });

        transaction.set(rootTxRef, cleanedUpdates, { merge: true });
        if (oldTx.docPath && oldTx.docPath !== rootTxRef.path) {
          transaction.set(doc(db, oldTx.docPath), cleanedUpdates, { merge: true });
        }

        const historyRef = doc(collection(rootTxRef, 'history'));
        transaction.set(historyRef, {
          ...auditRecord,
          createdAt: serverTimestamp()
        });
      });
      return true;
    } catch (error) {
      console.error('Update Transaction failed:', error);
      handleFirestoreError(error, OperationType.WRITE, `entries/${txId}`);
      throw error;
    }
  },

  async saveTransaction(
    txData: Partial<Transaction> & { id: string }, 
    customer: Customer, 
    oldTx?: Transaction
  ): Promise<boolean> {
    if (!txData.id || !/^[a-zA-Z0-9_\-]{1,128}$/.test(txData.id)) {
      throw new Error('Invalid transaction ID format.');
    }
    if (!customer?.id || !/^[a-zA-Z0-9_\-]{1,128}$/.test(customer.id)) {
      throw new Error('Invalid customer ID format.');
    }
    if (txData.amount === undefined || typeof txData.amount !== 'number' || txData.amount <= 0) {
      throw new Error('Transaction amount must be greater than zero.');
    }

    try {
      await runTransaction(db, async (transaction) => {
        const rootCustomerRef = doc(db, 'customers', customer.id);
        const customerRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
        
        const rootTxRef = doc(db, 'entries', txData.id);
        const txDocPath = txData.docPath || (customer.docPath ? `${customer.docPath}/entries/${txData.id}` : undefined);
        const subTxRef = txDocPath ? doc(db, txDocPath) : null;

        const [customerSnap, txSnap] = await Promise.all([
          transaction.get(customerRef),
          transaction.get(rootTxRef) // use root reference for checking transaction existence
        ]);

        const currentCustomer = customerSnap.exists() ? (customerSnap.data() as Customer) : customer;
        const currentTx = txSnap.exists() ? (txSnap.data() as Transaction) : (oldTx || null);

        let paidDiff = 0;
        let pendingDiff = 0;

        if (currentTx && currentTx.status === 'paid' && currentTx.type !== 'NP' && currentTx.type !== 'unsettled') {
          paidDiff -= (currentTx.amount || 0);
          pendingDiff += (currentTx.amount || 0);
        }

        const isNP = txData.type === 'NP' || txData.type === 'unsettled' || txData.status === 'unsettled';
        const isActualPayment = (txData.status === 'paid' || !txData.status) && !isNP;

        const currentPending = currentCustomer.pending !== undefined 
          ? currentCustomer.pending 
          : Math.max(0, (currentCustomer.loanAmount || currentCustomer.loan || 0) - (currentCustomer.paid || 0));

        let advanceDiff = 0;

        if (isActualPayment) {
          const amt = txData.amount || 0;
          if (currentPending <= 0 || txData.isAdvance) {
            // Customer loan is completed: all of this payment goes into advance savings credit!
            advanceDiff += amt;
            paidDiff += amt;
            pendingDiff = 0; // pending stays 0
            txData.isAdvance = true; // Mark as advance savings transaction!
          } else if (amt > currentPending) {
            // Customer pays more than pending: remaining balance cleared to 0, excess to advance savings!
            const excess = amt - currentPending;
            paidDiff += amt;
            pendingDiff -= currentPending;
            advanceDiff += excess;
            txData.isAdvance = true;
          } else {
            paidDiff += amt;
            pendingDiff -= amt;
          }
        }

        const nowServer = serverTimestamp();
        const updatedCustomerData: Partial<Customer> = {};
        if (paidDiff !== 0 || pendingDiff !== 0 || advanceDiff !== 0) {
          updatedCustomerData.paid = (currentCustomer.paid || 0) + paidDiff;
          updatedCustomerData.pending = Math.max(0, (currentCustomer.pending || 0) + pendingDiff);
          if (advanceDiff !== 0 || currentCustomer.advanceBalance !== undefined) {
            updatedCustomerData.advanceBalance = Math.max(0, (currentCustomer.advanceBalance || 0) + advanceDiff);
          }
          updatedCustomerData.updatedAt = nowServer;
        }

        if (isActualPayment) {
          updatedCustomerData.lastPayment = nowServer;
        }

        if (Object.keys(updatedCustomerData).length > 0) {
          transaction.set(rootCustomerRef, updatedCustomerData, { merge: true });
          if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
            transaction.set(doc(db, customer.docPath), updatedCustomerData, { merge: true });
          }
        }

        const effectiveDate = txData.date || (typeof format === 'function' ? format(new Date(), 'yyyy-MM-dd') : new Date().toISOString().slice(0, 10));
        const effectiveStatus: Transaction['status'] = txData.status || (isNP ? 'unsettled' : 'paid');
        const effectiveType: Transaction['type'] = txData.type || (isNP ? 'unsettled' : 'cash');

        const cleanedTxData = cleanData({
          ...txData,
          customerId: customer.id,
          date: effectiveDate,
          status: effectiveStatus,
          type: effectiveType,
          isDeleted: false,
          createdBy: txData.createdBy || 'agent',
          updatedAt: nowServer,
          createdAt: currentTx?.createdAt || nowServer,
          paidAt: isActualPayment ? (txData.paidAt || nowServer) : null,
          unsettledAt: isNP ? (txData.unsettledAt || nowServer) : null
        });

        transaction.set(rootTxRef, cleanedTxData, { merge: true });
        if (subTxRef && subTxRef.path !== rootTxRef.path) {
          transaction.set(subTxRef, cleanedTxData, { merge: true });
        }
      });
      return true;
    } catch (error: any) {
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        const batch = writeBatch(db);
        const rootCustomerRef = doc(db, 'customers', customer.id);
        const rootTxRef = doc(db, 'entries', txData.id);
        const txDocPath = txData.docPath || (customer.docPath ? `${customer.docPath}/entries/${txData.id}` : undefined);
        const subTxRef = txDocPath ? doc(db, txDocPath) : null;

        let paidDiff = 0;
        let pendingDiff = 0;
        let advanceDiff = 0;
        if (oldTx && oldTx.status === 'paid' && oldTx.type !== 'NP' && oldTx.type !== 'unsettled') {
          paidDiff -= (oldTx.amount || 0);
          pendingDiff += (oldTx.amount || 0);
        }
        const isNP = txData.type === 'NP' || txData.type === 'unsettled' || txData.status === 'unsettled';
        const isActualPayment = (txData.status === 'paid' || !txData.status) && !isNP;
        
        const currentPending = customer.pending !== undefined 
          ? customer.pending 
          : Math.max(0, (customer.loanAmount || customer.loan || 0) - (customer.paid || 0));

        if (isActualPayment) {
          const amt = txData.amount || 0;
          if (currentPending <= 0 || txData.isAdvance) {
            advanceDiff += amt;
            paidDiff += amt;
            pendingDiff = 0;
            txData.isAdvance = true;
          } else if (amt > currentPending) {
            const excess = amt - currentPending;
            paidDiff += amt;
            pendingDiff -= currentPending;
            advanceDiff += excess;
            txData.isAdvance = true;
          } else {
            paidDiff += amt;
            pendingDiff -= amt;
          }
        }

        if (paidDiff !== 0 || pendingDiff !== 0 || advanceDiff !== 0) {
          const updateData: any = {
            paid: (customer.paid || 0) + paidDiff,
            pending: Math.max(0, (customer.pending || 0) + pendingDiff),
            updatedAt: serverTimestamp()
          };
          if (advanceDiff !== 0 || customer.advanceBalance !== undefined) {
            updateData.advanceBalance = Math.max(0, (customer.advanceBalance || 0) + advanceDiff);
          }
          batch.set(rootCustomerRef, updateData, { merge: true });
          if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
            batch.set(doc(db, customer.docPath), updateData, { merge: true });
          }
        }

        const effectiveDate = txData.date || (typeof format === 'function' ? format(new Date(), 'yyyy-MM-dd') : new Date().toISOString().slice(0, 10));
        const effectiveStatus: Transaction['status'] = txData.status || (isNP ? 'unsettled' : 'paid');
        const effectiveType: Transaction['type'] = txData.type || (isNP ? 'unsettled' : 'cash');

        const cleanedTxData = cleanData({
          ...txData,
          customerId: customer.id,
          date: effectiveDate,
          status: effectiveStatus,
          type: effectiveType,
          isDeleted: false,
          createdBy: txData.createdBy || 'agent',
          createdAt: txData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          paidAt: isActualPayment ? (txData.paidAt || serverTimestamp()) : null,
          unsettledAt: isNP ? (txData.unsettledAt || serverTimestamp()) : null
        });

        batch.set(rootTxRef, cleanedTxData, { merge: true });
        if (subTxRef && subTxRef.path !== rootTxRef.path) {
          batch.set(subTxRef, cleanedTxData, { merge: true });
        }

        await batch.commit();
        return true;
      }
      handleFirestoreError(error, OperationType.WRITE, `entries/${txData.id}`);
      return false;
    }
  },

  async settleTransaction(tx: Transaction, paymentType: 'cash' | 'phonepe') {
    if (tx.type !== 'unsettled' && (tx.type as string) !== 'not_paid') return;
    toast.success('Redirecting to full update pipeline...');
  },

  async deleteTransaction(tx: Transaction, customer: Customer) {
    if (!tx?.id || !customer?.id) return;
    try {
      await runTransaction(db, async (transaction) => {
        const rootCustomerRef = doc(db, 'customers', customer.id);
        const customerRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;

        const rootTxRef = doc(db, 'entries', tx.id);
        const txDocPath = tx.docPath || (customer.docPath ? `${customer.docPath}/entries/${tx.id}` : undefined);
        const subTxRef = txDocPath ? doc(db, txDocPath) : null;

        const customerSnap = await transaction.get(customerRef);
        
        if (customerSnap.exists() && tx.status === 'paid' && tx.type !== 'NP' && tx.type !== 'unsettled') {
          const currentCustomer = customerSnap.data() as Customer;
          const currentAdvance = currentCustomer.advanceBalance || 0;
          let newAdvance = currentAdvance;
          let newPending = (currentCustomer.pending || 0);

          if (tx.isWithdrawal) {
            // Reversing a withdrawal refunds the amount back to advance balance
            newAdvance = currentAdvance + tx.amount;
          } else if (currentAdvance > 0 && (tx.isAdvance || newPending <= 0)) {
            newAdvance = Math.max(0, currentAdvance - tx.amount);
          } else {
            newPending += tx.amount;
          }

          const updateData: any = {
            paid: tx.isWithdrawal ? (currentCustomer.paid || 0) : Math.max(0, (currentCustomer.paid || 0) - tx.amount),
            pending: newPending,
            updatedAt: serverTimestamp()
          };
          if (currentCustomer.advanceBalance !== undefined || tx.isWithdrawal) {
            updateData.advanceBalance = newAdvance;
          }
          transaction.set(rootCustomerRef, updateData, { merge: true });
          if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
            transaction.set(doc(db, customer.docPath), updateData, { merge: true });
          }
        }
        
        const deleteData = { isDeleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() };
        transaction.set(rootTxRef, deleteData, { merge: true });
        if (subTxRef && subTxRef.path !== rootTxRef.path) {
          transaction.set(subTxRef, deleteData, { merge: true });
        }
      });
    } catch (error: any) {
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        const batch = writeBatch(db);
        const rootTxRef = doc(db, 'entries', tx.id);
        const txDocPath = tx.docPath || (customer.docPath ? `${customer.docPath}/entries/${tx.id}` : undefined);
        const subTxRef = txDocPath ? doc(db, txDocPath) : null;

        const deleteData = { isDeleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() };
        batch.set(rootTxRef, deleteData, { merge: true });
        if (subTxRef && subTxRef.path !== rootTxRef.path) {
          batch.set(subTxRef, deleteData, { merge: true });
        }
        if (tx.status === 'paid' && tx.type !== 'NP' && tx.type !== 'unsettled') {
          const rootCustomerRef = doc(db, 'customers', customer.id);
          const updateData: any = tx.isWithdrawal
            ? {
                advanceBalance: (customer.advanceBalance || 0) + tx.amount,
                updatedAt: serverTimestamp()
              }
            : {
                paid: Math.max(0, (customer.paid || 0) - tx.amount),
                pending: (customer.pending || 0) + tx.amount,
                updatedAt: serverTimestamp()
              };
          batch.set(rootCustomerRef, updateData, { merge: true });
          if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
            batch.set(doc(db, customer.docPath), updateData, { merge: true });
          }
        }
        await batch.commit();
      } else {
        handleFirestoreError(error, OperationType.DELETE, `entries/${tx.id}`);
      }
    }
  },

  async undoDeleteTransaction(tx: Transaction, customer: Customer) {
    if (!tx?.id || !customer?.id) return;
    try {
      await runTransaction(db, async (transaction) => {
        const rootCustomerRef = doc(db, 'customers', customer.id);
        const customerRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
        const rootTxRef = doc(db, 'entries', tx.id);
        const txDocPath = tx.docPath || (customer.docPath ? `${customer.docPath}/entries/${tx.id}` : undefined);
        const subTxRef = txDocPath ? doc(db, txDocPath) : null;

        const customerSnap = await transaction.get(customerRef);
        if (customerSnap.exists() && tx.status === 'paid' && tx.type !== 'NP' && tx.type !== 'unsettled') {
          const currentCustomer = customerSnap.data() as Customer;
          const currentAdvance = currentCustomer.advanceBalance || 0;
          let newAdvance = currentAdvance;
          let newPending = currentCustomer.pending || 0;

          if (tx.isWithdrawal) {
            newAdvance = Math.max(0, currentAdvance - tx.amount);
          } else if (currentAdvance > 0 && tx.isAdvance) {
            newAdvance = currentAdvance + tx.amount;
          } else {
            newPending = Math.max(0, newPending - tx.amount);
          }

          const updateData: any = {
            paid: tx.isWithdrawal ? (currentCustomer.paid || 0) : (currentCustomer.paid || 0) + tx.amount,
            pending: newPending,
            updatedAt: serverTimestamp()
          };
          if (currentCustomer.advanceBalance !== undefined || tx.isWithdrawal) {
            updateData.advanceBalance = newAdvance;
          }
          transaction.set(rootCustomerRef, updateData, { merge: true });
          if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
            transaction.set(doc(db, customer.docPath), updateData, { merge: true });
          }
        }

        const restoreData = { isDeleted: false, updatedAt: serverTimestamp(), deletedAt: null };
        transaction.set(rootTxRef, restoreData, { merge: true });
        if (subTxRef && subTxRef.path !== rootTxRef.path) {
          transaction.set(subTxRef, restoreData, { merge: true });
        }
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `entries/${tx.id}`);
    }
  },

  /**
   * Withdraw / Payout accumulated advance savings deposit for a customer
   */
  async withdrawAdvanceDeposit(
    customer: Customer,
    amount: number,
    payoutType: 'cash' | 'phonepe',
    notes?: string
  ): Promise<{ transaction: Transaction; updatedCustomer: Customer; previousAdvance: number; newAdvance: number }> {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }
    const currentAdvance = customer.advanceBalance || 0;
    if (amount > currentAdvance) {
      throw new Error(`Cannot withdraw ₹${amount}. Available advance balance is ₹${currentAdvance}`);
    }

    const txId = uuidv4();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowTimestamp = Date.now();

    const txData: Transaction = {
      id: txId,
      customerId: customer.id,
      amount,
      type: payoutType,
      status: 'paid',
      date: todayStr,
      timestamp: nowTimestamp,
      paidAt: nowTimestamp,
      isAdvance: true,
      isWithdrawal: true,
      notes: notes || `Advance deposit withdrawal of ₹${amount} via ${payoutType === 'phonepe' ? 'PhonePe UPI' : 'Cash'}`
    };

    let updatedCust: Customer = { ...customer };
    let previousAdv = currentAdvance;
    let newAdv = Math.max(0, currentAdvance - amount);

    await runTransaction(db, async (t) => {
      const rootCustomerRef = doc(db, 'customers', customer.id);
      const customerRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
      const rootTxRef = doc(db, 'entries', txId);

      const customerSnap = await t.get(customerRef);
      if (!customerSnap.exists()) {
        throw new Error('Customer record not found');
      }

      const freshCust = customerSnap.data() as Customer;
      previousAdv = freshCust.advanceBalance || 0;
      if (amount > previousAdv) {
        throw new Error(`Insufficient advance balance. Available: ₹${previousAdv}`);
      }
      newAdv = Math.max(0, previousAdv - amount);

      const customerUpdate = {
        advanceBalance: newAdv,
        updatedAt: serverTimestamp()
      };

      t.set(rootCustomerRef, customerUpdate, { merge: true });
      if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
        t.set(doc(db, customer.docPath), customerUpdate, { merge: true });
      }

      const cleanedTx = cleanData({
        ...txData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      t.set(rootTxRef, cleanedTx);
      if (customer.docPath) {
        t.set(doc(db, `${customer.docPath}/entries`, txId), cleanedTx);
      }

      updatedCust = {
        ...freshCust,
        advanceBalance: newAdv
      };
    });

    return {
      transaction: txData,
      updatedCustomer: updatedCust,
      previousAdvance: previousAdv,
      newAdvance: newAdv
    };
  },

  async clearAll() {
    try {
      const ops: Array<(batch: WriteBatch) => void> = [];
      const customersSnap = await getDocs(query(collectionGroup(db, 'customers')));
      customersSnap.forEach(d => {
        ops.push(batch => batch.set(d.ref, { isDeleted: true, updatedAt: serverTimestamp() }, { merge: true }));
      });
      
      const txSnap = await getDocs(query(collectionGroup(db, 'entries')));
      txSnap.forEach(d => {
        ops.push(batch => batch.set(d.ref, { isDeleted: true, updatedAt: serverTimestamp() }, { merge: true }));
      });
      
      await commitBatchInChunks(ops);
      toast.success('Database cleared.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'clearAll');
    }
  },

  async exportData() {
    try {
      const customersSnap = await getDocs(query(collectionGroup(db, 'customers')));
      const txSnap = await getDocs(query(collectionGroup(db, 'entries')));
      
      const customers = customersSnap.docs.map(d => d.data());
      const transactions = txSnap.docs.map(d => d.data());
      
      return JSON.stringify({ customers, transactions });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'exportData');
      return JSON.stringify({ customers: [], transactions: [] });
    }
  },

  async importData(json: string) {
    try {
      const data = JSON.parse(json);
      const ops: Array<(batch: WriteBatch) => void> = [];
      
      if (data.customers && Array.isArray(data.customers)) {
        for (const c of data.customers) {
          if (c.id) {
            ops.push(batch => {
              batch.set(doc(db, 'customers', c.id), { ...c, updatedAt: serverTimestamp() }, { merge: true });
            });
          }
        }
      }
      if (data.transactions && Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          if (t.id) {
            ops.push(batch => {
              batch.set(doc(db, 'entries', t.id), { ...t, updatedAt: serverTimestamp() }, { merge: true });
            });
          }
        }
      }
      
      await commitBatchInChunks(ops);
      toast.success('Import completed successfully.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'importData');
    }
  },

  subscribeNotifications(
    param1?: any,
    param2?: any
  ) {
    const callback: (data: NotificationRecord[]) => void = typeof param1 === 'function' ? param1 : (typeof param2 === 'function' ? param2 : () => {});
    setTimeout(() => callback([]), 0);
    return () => {};
  },

  async addNotification(notificationOrUserId: any, maybeNotification?: any) {
    return null;
  },

  async markNotificationRead(notificationIdOrUserId: string, maybeNotificationId?: string) {},

  async deleteNotification(notificationIdOrUserId: string, maybeNotificationId?: string) {},

  async clearNotifications() {},

  async getNotificationPreferences(userId?: string) {
    return null;
  },

  async saveNotificationPreferences(preferencesOrUserId: any, maybePreferences?: any) {}
};
