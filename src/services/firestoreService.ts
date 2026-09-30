import { db, auth } from '../lib/firebase';
export { db, auth };
import { toast } from 'sonner';
import { 
  collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, 
  writeBatch, query, orderBy, getDocs, runTransaction, serverTimestamp, where 
} from 'firebase/firestore';

export interface Customer {
  id: string;
  displayId?: string;
  name: string;
  phone: string;
  loan: number;
  loanAmount?: number;
  paid: number;
  pending: number;
  startDate: number;
  endDate: number;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
  frequencyDays?: number;
  durationDays?: number;
  notes?: string;
  uniqueKey?: string; // name_phone
  isOverdue?: boolean;
  overdueAmount?: number;
  expectedPaid?: number;
  daysMissing?: number;
  createdBy: string;
  createdAt: any;
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

    const totalLoan = customer.loanAmount || customer.loan || 0;
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
  customerId: string;
  amount: number;
  type: 'cash' | 'phonepe' | 'unsettled';
  status: 'paid' | 'pending' | 'unsettled';
  entryStatus?: 'active' | 'modified';
  parentId?: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  createdAt?: any;
  updatedAt?: any;
  paidAt?: any;
  unsettledAt?: any;
  createdBy?: string;
  isDeleted?: boolean;
  history?: AuditRecord[];
}

export interface NotificationAction {
  label: string;
  actionKey: 'NAVIGATE' | 'UNDO_TRANSACTION' | 'MARK_READ' | 'SNOOZE' | 'COLLECT';
  payload?: any;
}

export interface NotificationRecord {
  id: string;
  userId: string;
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
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: auth.currentUser?.uid },
    operationType,
    path
  };
  
  const errorObj = error as any;
  if (errorObj?.code === 'permission-denied') {
    toast.error('Permission Denied: Please update your Firestore Security Rules.', { duration: 10000 });
  } else {
    toast.error(`Database Error: ${errInfo.error}`);
  }
  
  throw new Error(JSON.stringify(errInfo));
}

import { v4 as uuidv4 } from 'uuid';

const TEN_MINUTES = 10 * 60 * 1000;

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
    if (!auth.currentUser) return 'CUST-001';
    const uid = auth.currentUser.uid;
    const q = query(
      collection(db, 'users', uid, 'customers')
    );
    const snap = await getDocs(q);
    if (snap.empty) return 'CUST-001';
    
    // Find the highest numeric ID among CUST-XXX format
    const ids = snap.docs
      .map(doc => doc.id)
      .filter(id => typeof id === 'string' && /^CUST-\d{3}$/.test(id))
      .map(id => parseInt(String(id).replace('CUST-', '')))
      .sort((a, b) => b - a);
      
    if (ids.length === 0) return 'CUST-001';
    
    const nextId = ids[0] + 1;
    return `CUST-${nextId.toString().padStart(3, '0')}`;
  },

  async checkIdUnique(id: string): Promise<boolean> {
    if (!auth.currentUser) return true;
    const uid = auth.currentUser.uid;
    const snap = await getDocs(query(
      collection(db, 'users', uid, 'customers'), 
      where('id', '==', id)
    ));
    return snap.empty;
  },

  async checkDuplicateCustomer(name: string, phone: string): Promise<boolean> {
    if (!auth.currentUser) return true;
    const uid = auth.currentUser.uid;
    const uniqueKey = `${name.trim().toLowerCase()}_${phone.trim()}`;
    const q = query(
      collection(db, 'users', uid, 'customers'), 
      where('uniqueKey', '==', uniqueKey), 
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    return snap.empty;
  },

  async checkPhoneExists(phone: string): Promise<{ exists: boolean; name: string | null }> {
    if (!auth.currentUser) return { exists: false, name: null };
    const uid = auth.currentUser.uid;
    const q = query(
      collection(db, 'users', uid, 'customers'), 
      where('phone', '==', phone.trim()), 
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return { exists: false, name: null };
    return { exists: true, name: (snap.docs[0].data() as Customer).name };
  },

  subscribeCustomers(userId: string, callback: (data: Customer[]) => void, onError?: (error: any) => void) {
    if (!userId) return () => {};
    const q = query(
      collection(db, 'users', userId, 'customers')
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Customer))
        .filter(c => !c.isDeleted)
        .sort((a, b) => a.id.localeCompare(b.id));
      console.log(`[Firestore Realtime] user customers snapshot matched - count: ${data.length}`, data);
      callback(data);
    }, (error: any) => {
      console.error("Firestore Error in customers subscription:", error);
      if (onError) onError(error);
      if (error.code === 'permission-denied' && !auth.currentUser) return;
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/customers`);
      callback([]);
    });
  },

  subscribeTransactions(userId: string, callback: (data: Transaction[]) => void, onError?: (error: any) => void) {
    if (!userId) return () => {};
    const q = query(
      collection(db, 'users', userId, 'entries')
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Transaction))
        .filter(t => !t.isDeleted)
        .sort((a, b) => b.timestamp - a.timestamp);
      console.log(`[Firestore Realtime] user entries snapshot matched - count: ${data.length}`, data);
      callback(data);
    }, (error: any) => {
      console.error("Firestore Error in transactions subscription:", error);
      if (onError) onError(error);
      if (error.code === 'permission-denied' && !auth.currentUser) return;
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/entries`);
      callback([]);
    });
  },

  async saveCustomer(customer: Partial<Customer> & { id: string }) {
    if (!auth.currentUser) throw new Error('Auth required');
    const uid = auth.currentUser.uid;
    const customerRef = doc(db, 'users', uid, 'customers', customer.id);
    const data = cleanData({ ...customer, createdBy: uid });
    const now = serverTimestamp();

    try {
      // Offline-friendly fetch from cache or server
      let snap;
      try {
        snap = await getDoc(customerRef);
      } catch (err) {
        console.warn(`[Firestore Offline] Failed to get doc for existing customer check (acceptable offline):`, err);
      }

      if (snap && snap.exists()) {
        const existingData = snap.data();
        await setDoc(customerRef, {
          ...data,
          createdAt: existingData?.createdAt || now,
          updatedAt: now
        }, { merge: true });
        console.log(`[Firestore Write] Successfully updated customer: ${customer.id}`);
      } else {
        await setDoc(customerRef, {
          ...data,
          createdAt: now,
          updatedAt: now
        });
        console.log(`[Firestore Write] Successfully registered new customer: ${customer.id}`);
      }
    } catch (error: any) {
      console.error(`[Firestore Error - saveCustomer]:`, error);
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/customers/${customer.id}`);
      throw error;
    }
  },

  async deleteCustomer(id: string) {
    if (!auth.currentUser) throw new Error('Auth required');
    const uid = auth.currentUser.uid;
    try {
      const customerRef = doc(db, 'users', uid, 'customers', id);
      const entriesQuery = query(
        collection(db, 'users', uid, 'entries'), 
        where('customerId', '==', id)
      );
      const entriesSnap = await getDocs(entriesQuery);

      const batch = writeBatch(db);
      batch.update(customerRef, { isDeleted: true, updatedAt: serverTimestamp(), deletedAt: serverTimestamp() });
      
      entriesSnap.docs.forEach(d => {
        batch.update(d.ref, { isDeleted: true, updatedAt: serverTimestamp() });
      });

      await batch.commit();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/customers/${id}`);
    }
  },

  async togglePinCustomer(id: string, isPinned: boolean) {
    if (!auth.currentUser) throw new Error('Auth required');
    const uid = auth.currentUser.uid;
    try {
      const customerRef = doc(db, 'users', uid, 'customers', id);
      await setDoc(customerRef, { isPinned, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/customers/${id}`);
    }
  },

  async undoDeleteCustomer(id: string) {
    if (!auth.currentUser) throw new Error('Auth required');
    const uid = auth.currentUser.uid;
    try {
      const customerRef = doc(db, 'users', uid, 'customers', id);
      const entriesQuery = query(
        collection(db, 'users', uid, 'entries'), 
        where('customerId', '==', id)
      );
      const entriesSnap = await getDocs(entriesQuery);

      const batch = writeBatch(db);
      batch.update(customerRef, { isDeleted: false, updatedAt: serverTimestamp(), deletedAt: null });
      
      entriesSnap.docs.forEach(d => {
        batch.update(d.ref, { isDeleted: false, updatedAt: serverTimestamp() });
      });

      await batch.commit();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/customers/${id}`);
    }
  },

  async updateTransaction(txId: string, updates: Partial<Transaction>, oldTx: Transaction, customer: Customer, actionName: string) {
    if (!txId) throw new Error('Invalid entry ID');
    if (!customer?.id) throw new Error('Invalid customer ID');
    if (!auth.currentUser) throw new Error('Auth required');
    const uid = auth.currentUser.uid;

    try {
      await runTransaction(db, async (transaction) => {
        const customerRef = doc(db, 'users', uid, 'customers', customer.id);
        const txRef = doc(db, 'users', uid, 'entries', txId);
        
        const [customerSnap, txSnap] = await Promise.all([
          transaction.get(customerRef),
          transaction.get(txRef)
        ]);

        if (!txSnap.exists()) throw new Error('Transaction not found');
        
        const currentCustomer = customerSnap.exists() ? (customerSnap.data() as Customer) : customer;
        const currentTx = txSnap.data() as Transaction;
        
        // Ensure new status is derived correctly
        const newType = updates.type !== undefined ? updates.type : currentTx.type;
        const newAmount = updates.amount !== undefined ? updates.amount : currentTx.amount;
        
        let newStatus: Transaction['status'] = currentTx.status;
        if (updates.status) {
          newStatus = updates.status;
        } else if (updates.type) {
          if (updates.type === 'unsettled') newStatus = 'unsettled';
          else if (updates.type === 'cash' || updates.type === 'phonepe') newStatus = 'paid';
          else newStatus = 'pending';
        } else if (newType === 'unsettled') {
          newStatus = 'unsettled';
        } else if (newType === 'cash' || newType === 'phonepe') {
          newStatus = 'paid';
        }
        
        // Calculate effective contribution to paid bal (unsettled/pending/not_paid contributes 0)
        const oldEffectiveAmt = (currentTx.status === 'paid') ? currentTx.amount : 0;
        const newEffectiveAmt = newStatus === 'paid' ? newAmount : 0;
        
        const paidDiff = newEffectiveAmt - oldEffectiveAmt;
        const pendingDiff = -paidDiff;

        // Create audit record
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

        // Date fields handling
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

        // Update Customer Balances
        transaction.update(customerRef, updatedCustomerData);

        // Pre-clean updates
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
          createdBy: uid
        });

        // Direct Patch the Transaction
        transaction.update(txRef, cleanedUpdates);

        // Also write standalone audit record to a dedicated subcollection to satisfy strict history logging
        const historyRef = doc(collection(txRef, 'history'));
        transaction.set(historyRef, {
          ...auditRecord,
          createdAt: serverTimestamp()
        });
      });
      return true;
    } catch (error) {
      console.error('Update Transaction failed:', error);
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/entries/${txId}`);
      throw error;
    }
  },

  async saveTransaction(txData: Partial<Transaction> & { id: string }, customer: Customer, oldTx?: Transaction): Promise<boolean> {
    if (!auth.currentUser) throw new Error('Auth required');
    const uid = auth.currentUser.uid;
    try {
      await runTransaction(db, async (transaction) => {
        const customerRef = doc(db, 'users', uid, 'customers', customer.id);
        const txRef = doc(db, 'users', uid, 'entries', txData.id);
        
        // Execute all reads first
        const [customerSnap, txSnap] = await Promise.all([
          transaction.get(customerRef),
          transaction.get(txRef)
        ]);

        const currentCustomer = customerSnap.exists() ? (customerSnap.data() as Customer) : customer;
        
        let paidDiff = 0;
        let pendingDiff = 0;
        
        // Old transaction was a payment, subtract it
        if (oldTx && oldTx.status === 'paid') {
          paidDiff -= (oldTx.amount || 0);
          pendingDiff += (oldTx.amount || 0);
        }
        
        // New transaction is a payment, add it
        const isPaid = txData.status === 'paid';
        if (isPaid) {
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

        if (isPaid) {
          updatedCustomerData.lastPayment = nowServer;
        }

        if (Object.keys(updatedCustomerData).length > 0) {
          transaction.update(customerRef, updatedCustomerData);
        }
        
        // Handle timestamps
        if (isPaid && !txData.paidAt) {
          txData.paidAt = Date.now();
        }
        if (txData.status === 'unsettled' && !txData.unsettledAt) {
          txData.unsettledAt = Date.now();
        }

        const cleanedTxData = cleanData({ ...txData, createdBy: uid });
        if (txSnap.exists()) {
          transaction.update(txRef, { ...cleanedTxData, updatedAt: nowServer });
        } else {
          transaction.set(txRef, { 
            ...cleanedTxData, 
            customerId: customer.id, 
            createdAt: nowServer, 
            updatedAt: nowServer,
            paidAt: isPaid ? nowServer : null,
            unsettledAt: txData.status === 'unsettled' ? nowServer : null
          });
        }
      });
      return true;
    } catch (error: any) {
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        const batch = writeBatch(db);
        const customerRef = doc(db, 'users', uid, 'customers', customer.id);
        const txRef = doc(db, 'users', uid, 'entries', txData.id);
        
        let paidDiff = 0;
        let pendingDiff = 0;
        if (oldTx && oldTx.status === 'paid' && oldTx.type !== 'unsettled' && (oldTx.type as string) !== 'not_paid') {
          paidDiff -= (oldTx.amount || 0);
          pendingDiff += (oldTx.amount || 0);
        }
        if (txData.status === 'paid' && txData.type !== 'unsettled' && (txData.type as string) !== 'not_paid') {
          paidDiff += (txData.amount || 0);
          pendingDiff -= (txData.amount || 0);
        }
        
        if (paidDiff !== 0 || pendingDiff !== 0) {
          batch.update(customerRef, {
            paid: (customer.paid || 0) + paidDiff,
            pending: (customer.pending || 0) + pendingDiff,
            updatedAt: serverTimestamp()
          });
        }
        
        const cleanedTxData = cleanData({ ...txData, createdBy: uid });
        batch.set(txRef, { ...cleanedTxData, customerId: customer.id, createdAt: txData.createdAt || serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        await batch.commit();
        return true;
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/entries/${txData.id}`);
      return false;
    }
  },

  async settleTransaction(tx: Transaction, paymentType: 'cash' | 'phonepe') {
    if (tx.type !== 'unsettled' && (tx.type as string) !== 'not_paid') return;
    const uid = auth.currentUser?.uid;
    try {
      // Actually redirect to updateTransaction so it balances correctly!
      toast.success('Redirecting to full update pipeline...');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/entries/${tx.id}`);
    }
  },

  async deleteTransaction(tx: Transaction, customer: Customer) {
    if (!auth.currentUser) throw new Error('Auth required');
    const uid = auth.currentUser.uid;
    try {
      await runTransaction(db, async (transaction) => {
        const customerRef = doc(db, 'users', uid, 'customers', customer.id);
        const customerSnap = await transaction.get(customerRef);
        
        if (customerSnap.exists() && tx.status === 'paid') {
          const currentCustomer = customerSnap.data() as Customer;
          transaction.update(customerRef, {
            paid: currentCustomer.paid - tx.amount,
            pending: currentCustomer.pending + tx.amount,
            updatedAt: serverTimestamp()
          });
        }
        
        transaction.delete(doc(db, 'users', uid, 'entries', tx.id));
      });
    } catch (error: any) {
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', uid, 'entries', tx.id));
        if (tx.status === 'paid') {
          batch.update(doc(db, 'users', uid, 'customers', customer.id), {
            paid: customer.paid - tx.amount,
            pending: customer.pending + tx.amount,
            updatedAt: serverTimestamp()
          });
        }
        await batch.commit();
      } else {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/entries/${tx.id}`);
      }
    }
  },

  async clearAll() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
      const batch = writeBatch(db);
      const customersSnap = await getDocs(query(collection(db, 'users', uid, 'customers')));
      customersSnap.forEach(d => batch.delete(d.ref));
      
      const txSnap = await getDocs(query(collection(db, 'users', uid, 'entries')));
      txSnap.forEach(d => batch.delete(d.ref));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'clearAll');
    }
  },

  async exportData() {
    if (!auth.currentUser) return JSON.stringify({ customers: [], transactions: [] });
    const uid = auth.currentUser.uid;
    try {
      const customersSnap = await getDocs(query(collection(db, 'users', uid, 'customers')));
      const txSnap = await getDocs(query(collection(db, 'users', uid, 'entries')));
      
      const customers = customersSnap.docs.map(d => d.data());
      const transactions = txSnap.docs.map(d => d.data());
      
      return JSON.stringify({ customers, transactions });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'exportData');
      return JSON.stringify({ customers: [], transactions: [] });
    }
  },

  async importData(json: string) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
      const data = JSON.parse(json);
      const batch = writeBatch(db);
      
      const customersSnap = await getDocs(query(collection(db, 'users', uid, 'customers')));
      customersSnap.forEach(d => batch.delete(d.ref));
      const txSnap = await getDocs(query(collection(db, 'users', uid, 'entries')));
      txSnap.forEach(d => batch.delete(d.ref));
      
      if (data.customers) {
        for (const c of data.customers) {
          batch.set(doc(db, 'users', uid, 'customers', c.id), { ...c, createdBy: uid, updatedAt: serverTimestamp() });
        }
      }
      if (data.transactions) {
        for (const t of data.transactions) {
          batch.set(doc(db, 'users', uid, 'entries', t.id), { ...t, createdBy: uid, updatedAt: serverTimestamp() });
        }
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'importData');
    }
  },

  subscribeNotifications(userId: string, callback: (data: NotificationRecord[]) => void) {
    if (!userId) return () => {};
    const q = query(
      collection(db, 'users', userId, 'notifications'), 
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationRecord));
      callback(data.slice(0, 50)); // Limit to most recent 50
    }, (error: any) => {
      if (error.code === 'permission-denied' && !auth.currentUser) return;
      console.error("Notification Sync Error:", error);
      callback([]);
    });
  },

  async addNotification(userId: string, notification: Omit<NotificationRecord, 'id' | 'userId' | 'isRead'>) {
    try {
      const id = uuidv4();
      const notificationRef = doc(db, 'users', userId, 'notifications', id);
      const data = cleanData({
        ...notification,
        id,
        userId,
        isRead: false,
        createdAt: serverTimestamp()
      });
      await setDoc(notificationRef, data);
      return id;
    } catch (error) {
      console.error("Failed to add notification:", error);
      return null;
    }
  },

  async markNotificationRead(userId: string, notificationId: string) {
    try {
      const ref = doc(db, 'users', userId, 'notifications', notificationId);
      await setDoc(ref, { isRead: true, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Failed to mark notification read:", error);
    }
  },

  async deleteNotification(userId: string, notificationId: string) {
    try {
      const ref = doc(db, 'users', userId, 'notifications', notificationId);
      await deleteDoc(ref);
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  },

  async clearNotifications(userId: string) {
    try {
      const q = query(collection(db, 'users', userId, 'notifications'));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  },

  async getNotificationPreferences(userId: string) {
    if (!userId) return null;
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'notifications');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (error) {
      console.warn("Could not read notification preferences from Firestore, using local:", error);
      return null;
    }
  },

  async saveNotificationPreferences(userId: string, preferences: any) {
    if (!userId) return;
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'notifications');
      await setDoc(docRef, cleanData({
        ...preferences,
        updatedAt: serverTimestamp()
      }), { merge: true });
    } catch (error) {
      console.warn("Could not save notification preferences to Firestore:", error);
    }
  }
};
