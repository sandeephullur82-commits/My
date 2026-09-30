import React, { createContext, useContext, useState, useEffect } from 'react';
import { firestoreService, Customer, Transaction } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  
  // Try to load initial data from cache for instant loading experience
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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let custLoaded = false;
    let txLoaded = false;

    const checkDone = () => {
      if (custLoaded && txLoaded) {
        setLoading(false);
      }
    };

    const unsubCust = firestoreService.subscribeCustomers(
      user.uid, 
      (data) => {
        console.log(`[DataProvider] realtime sync customers active. Received count: ${data.length}`);
        setCustomers(data);
        localStorage.setItem('cache_customers', JSON.stringify(data));
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
      user.uid, 
      (data) => {
        console.log(`[DataProvider] realtime sync transactions active. Received count: ${data.length}`);
        setTransactions(data);
        localStorage.setItem('cache_transactions', JSON.stringify(data));
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
  }, [user, refreshKey]);

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
