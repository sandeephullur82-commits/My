import { openDB, IDBPDatabase } from 'idb';
import { Customer, Transaction } from '../services/firestoreService';

const DB_NAME = 'pigmy_pro_cache_db';
const DB_VERSION = 1;
const STORE_CUSTOMERS = 'customers';
const STORE_TRANSACTIONS = 'transactions';
const STORE_METADATA = 'metadata';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
          db.createObjectStore(STORE_CUSTOMERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
          db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA);
        }
      },
    }).catch(err => {
      console.warn('[CacheStorage] Failed to open IndexedDB, falling back to localStorage:', err);
      dbPromise = null;
      throw err;
    });
  }

  return dbPromise;
}

export const cacheStorage = {
  /**
   * Save customers array asynchronously to IndexedDB.
   * Handles large datasets (10,000+ items) without blocking the UI thread or 5MB quota errors.
   */
  async setCustomers(customers: Customer[]): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction([STORE_CUSTOMERS, STORE_METADATA], 'readwrite');
      const store = tx.objectStore(STORE_CUSTOMERS);
      await store.clear();
      
      // Bulk insert in chunks to avoid memory bottlenecks
      for (const customer of customers) {
        if (customer && customer.id) {
          store.put(customer);
        }
      }
      
      await tx.objectStore(STORE_METADATA).put(Date.now(), 'customers_last_updated');
      await tx.done;
    } catch {
      // Safe fallback to localStorage with slicing if needed
      try {
        localStorage.setItem('cache_customers', JSON.stringify(customers.slice(0, 500)));
      } catch {
        // Ignore quota error on fallback
      }
    }
  },

  /**
   * Get cached customers from IndexedDB with fallback to localStorage.
   */
  async getCustomers(): Promise<Customer[]> {
    try {
      const db = await getDb();
      const list = await db.getAll(STORE_CUSTOMERS);
      if (list && list.length > 0) {
        return list;
      }
    } catch {
      // Fallback
    }

    try {
      const fallback = localStorage.getItem('cache_customers');
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  },

  /**
   * Save transactions array asynchronously to IndexedDB.
   */
  async setTransactions(transactions: Transaction[]): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction([STORE_TRANSACTIONS, STORE_METADATA], 'readwrite');
      const store = tx.objectStore(STORE_TRANSACTIONS);
      await store.clear();
      
      for (const transaction of transactions) {
        if (transaction && transaction.id) {
          store.put(transaction);
        }
      }
      
      await tx.objectStore(STORE_METADATA).put(Date.now(), 'transactions_last_updated');
      await tx.done;
    } catch {
      // Safe fallback to localStorage with recent items
      try {
        localStorage.setItem('cache_transactions', JSON.stringify(transactions.slice(0, 500)));
      } catch {
        // Ignore quota error on fallback
      }
    }
  },

  /**
   * Get cached transactions from IndexedDB with fallback to localStorage.
   */
  async getTransactions(): Promise<Transaction[]> {
    try {
      const db = await getDb();
      const list = await db.getAll(STORE_TRANSACTIONS);
      if (list && list.length > 0) {
        return list;
      }
    } catch {
      // Fallback
    }

    try {
      const fallback = localStorage.getItem('cache_transactions');
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  },

  /**
   * Clears cached records
   */
  async clearCache(): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction([STORE_CUSTOMERS, STORE_TRANSACTIONS, STORE_METADATA], 'readwrite');
      await tx.objectStore(STORE_CUSTOMERS).clear();
      await tx.objectStore(STORE_TRANSACTIONS).clear();
      await tx.objectStore(STORE_METADATA).clear();
      await tx.done;
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('cache_customers');
      localStorage.removeItem('cache_transactions');
    } catch {
      // ignore
    }
  }
};
