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

  const refreshData = () => {
    setLoading(true);
    setError(null);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <DataContext.Provider value={{ customers, transactions, loading, error, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useRealtimeData = () => useContext(DataContext);
