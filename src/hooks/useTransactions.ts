import { firestoreService, Transaction, Customer } from '../services/firestoreService';
import { toast } from 'sonner';
import { useSync } from '../context/SyncContext';

export function useTransactions() {
  const { setIsSyncing } = useSync();

  const addOrUpdateTransaction = async (txData: Partial<Transaction> & { id: string }, customer: Customer, oldTx?: Transaction, retryCount = 0) => {
    if (!txData.amount || txData.amount <= 0) {
      toast.error('Amount must be greater than 0');
      throw new Error('Invalid amount');
    }
    if (!customer || !customer.id) {
      toast.error('Invalid customer selection');
      throw new Error('Invalid customer ID');
    }

    setIsSyncing(true);
    try {
      await firestoreService.saveTransaction(txData, customer, oldTx);
      toast.success(oldTx ? 'Entry updated' : 'Entry added');
    } catch (error) {
      if (retryCount === 0) {
        toast.error('Entry failed, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return addOrUpdateTransaction(txData, customer, oldTx, 1);
      }
      toast.error('Failed to save entry');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const removeTransaction = async (tx: Transaction, customer: Customer) => {
    setIsSyncing(true);
    try {
      await firestoreService.deleteTransaction(tx, customer);
      toast.success('Entry deleted');
    } catch (error) {
      toast.error('Failed to delete entry');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  return { addOrUpdateTransaction, removeTransaction };
}
