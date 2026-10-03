import React, { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshotsInSync, onSnapshot, query, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export type SyncStatusType = 'synced' | 'pending' | 'offline';

interface SyncContextType {
  status: SyncStatusType;
  setStatus: (status: SyncStatusType) => void;
  lastSynced: number | null;
  setLastSynced: (time: number) => void;
  isSyncing: boolean;
  setIsSyncing: (isSyncing: boolean) => void;
  pendingCount: number;
}

const SyncContext = createContext<SyncContextType>({
  status: 'synced',
  setStatus: () => {},
  lastSynced: null,
  setLastSynced: () => {},
  isSyncing: false,
  setIsSyncing: () => {},
  pendingCount: 0,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState<SyncStatusType>(navigator.onLine ? 'synced' : 'offline');
  const [lastSynced, setLastSynced] = useState<number | null>(Date.now());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCustomers, setPendingCustomers] = useState(0);
  const [pendingEntries, setPendingEntries] = useState(0);
  const [prevPending, setPrevPending] = useState(0);

  const pendingCount = pendingCustomers + pendingEntries;

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatus(pendingCount > 0 ? 'pending' : 'synced');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Monitor snapshots in sync
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      if (navigator.onLine && pendingCount === 0) {
        setStatus('synced');
        setLastSynced(Date.now());
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSync();
    };
  }, [pendingCount]);

  // Track Firestore metadata changes for pending writes across collections
  useEffect(() => {
    const qCust = query(collection(db, 'customers'));
    const unsubCust = onSnapshot(qCust, { includeMetadataChanges: true }, (snap) => {
      const pending = snap.docs.filter(doc => doc.metadata.hasPendingWrites).length;
      setPendingCustomers(pending);
    }, (err) => {
      console.warn('[SyncProvider] Error listening to customers metadata:', err);
    });

    const qEntries = query(collection(db, 'entries'));
    const unsubEntries = onSnapshot(qEntries, { includeMetadataChanges: true }, (snap) => {
      const pending = snap.docs.filter(doc => doc.metadata.hasPendingWrites).length;
      setPendingEntries(pending);
    }, (err) => {
      console.warn('[SyncProvider] Error listening to entries metadata:', err);
    });

    return () => {
      unsubCust();
      unsubEntries();
    };
  }, []);

  // Handle status update and sync toast transitions
  useEffect(() => {
    if (!isOnline) {
      setStatus('offline');
    } else if (pendingCount > 0) {
      setStatus('pending');
      setIsSyncing(true);
    } else {
      setStatus('synced');
      setIsSyncing(false);
    }

    if (prevPending > 0 && pendingCount === 0 && isOnline) {
      toast.success('Synced Successfully');
      setLastSynced(Date.now());
    }

    setPrevPending(pendingCount);
  }, [pendingCount, isOnline, prevPending]);

  return (
    <SyncContext.Provider 
      value={{ 
        status, 
        setStatus, 
        lastSynced, 
        setLastSynced, 
        isSyncing, 
        setIsSyncing, 
        pendingCount 
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
