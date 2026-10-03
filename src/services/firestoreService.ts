import { db, auth } from '../lib/firebase';
export { db, auth };
import { toast } from 'sonner';
import { 
  collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, 
  writeBatch, query, orderBy, getDocs, runTransaction, serverTimestamp, where, collectionGroup 
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface Customer {
  id: string;
  docPath?: string;
  displayId?: string | number;
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

// Helper to remove undefined values before sending to Firestore
function cleanData<T extends object>(data: T): T {
  const result: any = {};
  Object.keys(data).forEach(key => {
    const val = (data as any)[key];
    if (val !== undefined) {
      result[key] = val;
    }
  });
  return result;
}

export const firestoreService = {
  // Helper to generate next customer ID
  async getNextCustomerId(): Promise<string> {
    try {
      const snap = await getDocs(query(collectionGroup(db, 'customers')));
      if (snap.empty) return 'CUST-001';
      
      const ids = snap.docs
        .map(doc => doc.data()?.id || doc.id)
        .filter(id => typeof id === 'string' && /^CUST-\d{3}$/.test(id))
        .map(id => parseInt(String(id).replace('CUST-', ''), 10))
        .sort((a, b) => b - a);
        
      if (ids.length === 0) return 'CUST-001';
      const nextId = ids[0] + 1;
      return `CUST-${nextId.toString().padStart(3, '0')}`;
    } catch {
      return 'CUST-001';
    }
  },

  async checkIdUnique(id: string): Promise<boolean> {
    try {
      const snap = await getDocs(query(
        collectionGroup(db, 'customers'), 
        where('id', '==', id)
      ));
      return snap.empty;
    } catch {
      return true;
    }
  },

  async checkDuplicateCustomer(name: string, phone: string): Promise<boolean> {
    try {
      const uniqueKey = `${name.trim().toLowerCase()}_${phone.trim()}`;
      const snap = await getDocs(query(
        collectionGroup(db, 'customers'), 
        where('uniqueKey', '==', uniqueKey), 
        where('isDeleted', '==', false)
      ));
      return snap.empty;
    } catch {
      return true;
    }
  },

  async checkPhoneExists(phone: string): Promise<{ exists: boolean; name: string | null }> {
    try {
      const snap = await getDocs(query(
        collectionGroup(db, 'customers'), 
        where('phone', '==', phone.trim()), 
        where('isDeleted', '==', false)
      ));
      if (snap.empty) return { exists: false, name: null };
      return { exists: true, name: (snap.docs[0].data() as Customer).name };
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
    const rootCustomerRef = doc(db, 'customers', customer.id);
    const existingRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
    const data = cleanData({ ...customer, createdBy: customer.createdBy || 'agent' });
    const now = serverTimestamp();

    try {
      let snap;
      try {
        snap = await getDoc(existingRef);
      } catch (err) {
        console.warn(`[Firestore Offline] Failed to get doc:`, err);
      }

      const payload = {
        ...data,
        createdAt: snap?.exists() ? (snap.data()?.createdAt || now) : now,
        updatedAt: now
      };

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

  async updateCustomer(id: string, updates: Partial<Customer>, docPath?: string) {
    const rootRef = doc(db, 'customers', id);
    const data = cleanData({ ...updates, updatedAt: serverTimestamp() });
    await setDoc(rootRef, data, { merge: true });
    if (docPath && docPath !== rootRef.path) {
      await setDoc(doc(db, docPath), data, { merge: true }).catch(() => {});
    }
  },

  async deleteCustomer(id: string, docPath?: string) {
    try {
      const rootRef = doc(db, 'customers', id);
      const batch = writeBatch(db);
      const updateData = { isDeleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() };
      
      batch.set(rootRef, updateData, { merge: true });
      if (docPath && docPath !== rootRef.path) {
        batch.set(doc(db, docPath), updateData, { merge: true });
      }

      // Mark associated entries as deleted
      try {
        const entriesQuery = query(
          collectionGroup(db, 'entries'), 
          where('customerId', '==', id)
        );
        const entriesSnap = await getDocs(entriesQuery);
        entriesSnap.docs.forEach(d => {
          batch.set(d.ref, { isDeleted: true, updatedAt: serverTimestamp() }, { merge: true });
        });
      } catch (e) {
        console.warn('Could not query associated entries for deletion batch:', e);
      }

      await batch.commit();
    } catch (error: any) {
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

  async undoDeleteCustomer(id: string, docPath?: string) {
    try {
      const rootRef = doc(db, 'customers', id);
      const batch = writeBatch(db);
      const restoreData = { isDeleted: false, updatedAt: serverTimestamp(), deletedAt: null };
      
      batch.set(rootRef, restoreData, { merge: true });
      if (docPath && docPath !== rootRef.path) {
        batch.set(doc(db, docPath), restoreData, { merge: true });
      }

      try {
        const entriesQuery = query(
          collectionGroup(db, 'entries'), 
          where('customerId', '==', id)
        );
        const entriesSnap = await getDocs(entriesQuery);
        entriesSnap.docs.forEach(d => {
          batch.set(d.ref, { isDeleted: false, updatedAt: serverTimestamp() }, { merge: true });
        });
      } catch (e) {
        console.warn('Could not query associated entries for restore:', e);
      }

      await batch.commit();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${id}`);
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
    try {
      await runTransaction(db, async (transaction) => {
        const rootCustomerRef = doc(db, 'customers', customer.id);
        const customerRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
        
        const rootTxRef = doc(db, 'entries', txData.id);
        const txRef = txData.docPath ? doc(db, txData.docPath) : rootTxRef;

        const [customerSnap, txSnap] = await Promise.all([
          transaction.get(customerRef),
          transaction.get(txRef)
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

        if (isActualPayment) {
          paidDiff += (txData.amount || 0);
          pendingDiff -= (txData.amount || 0);
        }

        const nowServer = serverTimestamp();
        const updatedCustomerData: Partial<Customer> = {};
        if (paidDiff !== 0 || pendingDiff !== 0) {
          updatedCustomerData.paid = (currentCustomer.paid || 0) + paidDiff;
          updatedCustomerData.pending = (currentCustomer.pending || 0) + pendingDiff;
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

        const cleanedTxData = cleanData({
          ...txData,
          customerId: customer.id,
          createdBy: 'agent',
          updatedAt: nowServer,
          createdAt: currentTx?.createdAt || nowServer,
          paidAt: isActualPayment ? (txData.paidAt || nowServer) : null,
          unsettledAt: isNP ? (txData.unsettledAt || nowServer) : null
        });

        transaction.set(rootTxRef, cleanedTxData, { merge: true });
        if (txData.docPath && txData.docPath !== rootTxRef.path) {
          transaction.set(doc(db, txData.docPath), cleanedTxData, { merge: true });
        }
      });
      return true;
    } catch (error: any) {
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        const batch = writeBatch(db);
        const rootCustomerRef = doc(db, 'customers', customer.id);
        const customerRef = customer.docPath ? doc(db, customer.docPath) : rootCustomerRef;
        const rootTxRef = doc(db, 'entries', txData.id);

        let paidDiff = 0;
        let pendingDiff = 0;
        if (oldTx && oldTx.status === 'paid' && oldTx.type !== 'NP' && oldTx.type !== 'unsettled') {
          paidDiff -= (oldTx.amount || 0);
          pendingDiff += (oldTx.amount || 0);
        }
        const isNP = txData.type === 'NP' || txData.type === 'unsettled' || txData.status === 'unsettled';
        const isActualPayment = (txData.status === 'paid' || !txData.status) && !isNP;
        if (isActualPayment) {
          paidDiff += (txData.amount || 0);
          pendingDiff -= (txData.amount || 0);
        }

        if (paidDiff !== 0 || pendingDiff !== 0) {
          const updateData = {
            paid: (customer.paid || 0) + paidDiff,
            pending: (customer.pending || 0) + pendingDiff,
            updatedAt: serverTimestamp()
          };
          batch.set(rootCustomerRef, updateData, { merge: true });
          if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
            batch.set(doc(db, customer.docPath), updateData, { merge: true });
          }
        }

        const cleanedTxData = cleanData({
          ...txData,
          customerId: customer.id,
          createdBy: 'agent',
          createdAt: txData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        batch.set(rootTxRef, cleanedTxData, { merge: true });
        if (txData.docPath && txData.docPath !== rootTxRef.path) {
          batch.set(doc(db, txData.docPath), cleanedTxData, { merge: true });
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
        const txRef = tx.docPath ? doc(db, tx.docPath) : rootTxRef;

        const customerSnap = await transaction.get(customerRef);
        
        if (customerSnap.exists() && tx.status === 'paid' && tx.type !== 'NP' && tx.type !== 'unsettled') {
          const currentCustomer = customerSnap.data() as Customer;
          const updateData = {
            paid: Math.max(0, (currentCustomer.paid || 0) - tx.amount),
            pending: (currentCustomer.pending || 0) + tx.amount,
            updatedAt: serverTimestamp()
          };
          transaction.set(rootCustomerRef, updateData, { merge: true });
          if (customer.docPath && customer.docPath !== rootCustomerRef.path) {
            transaction.set(doc(db, customer.docPath), updateData, { merge: true });
          }
        }
        
        transaction.delete(rootTxRef);
        if (tx.docPath && tx.docPath !== rootTxRef.path) {
          transaction.delete(doc(db, tx.docPath));
        }
      });
    } catch (error: any) {
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        const batch = writeBatch(db);
        const rootTxRef = doc(db, 'entries', tx.id);
        batch.delete(rootTxRef);
        if (tx.docPath && tx.docPath !== rootTxRef.path) {
          batch.delete(doc(db, tx.docPath));
        }
        if (tx.status === 'paid' && tx.type !== 'NP' && tx.type !== 'unsettled') {
          const rootCustomerRef = doc(db, 'customers', customer.id);
          const updateData = {
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

  async clearAll() {
    try {
      const batch = writeBatch(db);
      const customersSnap = await getDocs(query(collectionGroup(db, 'customers')));
      customersSnap.forEach(d => batch.delete(d.ref));
      
      const txSnap = await getDocs(query(collectionGroup(db, 'entries')));
      txSnap.forEach(d => batch.delete(d.ref));
      
      await batch.commit();
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
      const batch = writeBatch(db);
      
      if (data.customers && Array.isArray(data.customers)) {
        for (const c of data.customers) {
          if (c.id) {
            batch.set(doc(db, 'customers', c.id), { ...c, updatedAt: serverTimestamp() }, { merge: true });
          }
        }
      }
      if (data.transactions && Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          if (t.id) {
            batch.set(doc(db, 'entries', t.id), { ...t, updatedAt: serverTimestamp() }, { merge: true });
          }
        }
      }
      
      await batch.commit();
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
    
    const q = query(
      collection(db, 'notifications'), 
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationRecord));
      callback(data.slice(0, 50));
    }, (error: any) => {
      console.warn("Notification Sync (using offline/local):", error?.message || error);
      callback([]);
    });
  },

  async addNotification(notificationOrUserId: any, maybeNotification?: any) {
    const notification = maybeNotification || notificationOrUserId;
    try {
      const id = uuidv4();
      const notificationRef = doc(db, 'notifications', id);
      const data = cleanData({
        ...notification,
        id,
        isRead: false,
        createdAt: serverTimestamp(),
        timestamp: notification.timestamp || Date.now()
      });
      await setDoc(notificationRef, data);
      return id;
    } catch (error) {
      console.warn("Failed to add notification to Firestore:", error);
      return null;
    }
  },

  async markNotificationRead(notificationIdOrUserId: string, maybeNotificationId?: string) {
    const notificationId = maybeNotificationId || notificationIdOrUserId;
    try {
      const ref = doc(db, 'notifications', notificationId);
      await setDoc(ref, { isRead: true, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.warn("Failed to mark notification read:", error);
    }
  },

  async deleteNotification(notificationIdOrUserId: string, maybeNotificationId?: string) {
    const notificationId = maybeNotificationId || notificationIdOrUserId;
    try {
      const ref = doc(db, 'notifications', notificationId);
      await deleteDoc(ref);
    } catch (error) {
      console.warn("Failed to delete notification:", error);
    }
  },

  async clearNotifications() {
    try {
      const q = query(collection(db, 'notifications'));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      console.warn("Failed to clear notifications:", error);
    }
  },

  async getNotificationPreferences(userId?: string) {
    try {
      const docRef = userId 
        ? doc(db, 'users', userId, 'settings', 'notifications')
        : doc(db, 'settings', 'notifications');
      let snap = await getDoc(docRef);
      if (!snap.exists() && userId) {
        snap = await getDoc(doc(db, 'settings', 'notifications'));
      }
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (error) {
      console.warn("Could not read notification preferences from Firestore, using local:", error);
      return null;
    }
  },

  async saveNotificationPreferences(preferencesOrUserId: any, maybePreferences?: any) {
    const preferences = maybePreferences || preferencesOrUserId;
    try {
      const docRef = doc(db, 'settings', 'notifications');
      await setDoc(docRef, cleanData({
        ...preferences,
        updatedAt: serverTimestamp()
      }), { merge: true });
    } catch (error) {
      console.warn("Could not save notification preferences to Firestore:", error);
    }
  }
};
