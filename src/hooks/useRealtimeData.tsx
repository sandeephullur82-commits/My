import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { firestoreService, Customer, Transaction } from '../services/firestoreService';
import { cacheStorage } from '../lib/storage';

interface DataContextType {
  customers: Customer[];
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType>({ 
  customers: [], 
  transactions: [], 
  loading: true,
  error: null,
  refreshData: () => {}
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  // Load initial data from fast synchronous fallback or empty
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const cached = localStorage.getItem('cache_customers');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const cached = localStorage.getItem('cache_transactions');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  
  const [loading, setLoading] = useState(customers.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Async IndexedDB hydration on mount
  useEffect(() => {
    let isMounted = true;
    async function hydrateFromIndexedDB() {
      try {
        const [cachedCust, cachedTx] = await Promise.all([
          cacheStorage.getCustomers(),
          cacheStorage.getTransactions()
        ]);
        if (isMounted) {
          if (cachedCust.length > 0) setCustomers(cachedCust);
          if (cachedTx.length > 0) setTransactions(cachedTx);
          if (cachedCust.length > 0 && cachedTx.length > 0) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('[DataProvider] IndexedDB hydration note:', err);
      }
    }
    hydrateFromIndexedDB();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let custLoaded = false;
    let txLoaded = false;

    const checkDone = () => {
      if (custLoaded && txLoaded) {
        setLoading(false);
      }
    };

    const unsubCust = firestoreService.subscribeCustomers(
      (data) => {
        console.log(`[DataProvider] realtime sync customers active. Count: ${data.length}`);
        setCustomers(data);
        cacheStorage.setCustomers(data).catch(() => {});
        custLoaded = true;
        setError(null);
        checkDone();
      },
      (err) => {
        console.error(`[DataProvider] Error syncing customers:`, err);
        setError(err?.message || 'Failed to sync customers from Firestore.');
        setLoading(false);
      }
    );

    const unsubTx = firestoreService.subscribeTransactions(
      (data) => {
        console.log(`[DataProvider] realtime sync transactions active. Count: ${data.length}`);
        setTransactions(data);
        cacheStorage.setTransactions(data).catch(() => {});
        txLoaded = true;
        setError(null);
        checkDone();
      },
      (err) => {
        console.error(`[DataProvider] Error syncing transactions:`, err);
        setError(err?.message || 'Failed to sync transactions from Firestore.');
        setLoading(false);
      }
    );

    return () => {
      unsubCust();
      unsubTx();
    };
  }, [refreshKey]);

  // Run one-time background cleanup of orphaned entries for deleted customers
  useEffect(() => {
    firestoreService.cleanupOrphanedEntries().catch(() => {});
  }, []);

  const refreshData = () => {
    setLoading(true);
    setError(null);
    setRefreshKey(prev => prev + 1);
  };

  // Set of non-deleted active customer IDs
  const activeCustomerIds = React.useMemo(() => {
    return new Set(customers.filter(c => !c.isDeleted).map(c => c.id));
  }, [customers]);

  // Strictly filter transactions: exclude soft-deleted transactions AND entries belonging to deleted customers
  const activeTransactions = React.useMemo(() => {
    if (customers.length === 0) {
      return transactions.filter(t => !t.isDeleted);
    }
    return transactions.filter(t => !t.isDeleted && activeCustomerIds.has(t.customerId));
  }, [transactions, activeCustomerIds, customers.length]);

  return (
    <DataContext.Provider value={{ customers, transactions: activeTransactions, loading, error, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useRealtimeData = () => useContext(DataContext);
