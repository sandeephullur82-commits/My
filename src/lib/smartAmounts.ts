import { Transaction, Customer } from '../services/firestoreService';

/**
 * Calculates the smart default amount for a customer based on history.
 * 1. Default fallback: loanAmount / 100
 * 2. Auto-learning: If last 3 entries are the same, use that amount.
 */
export function getSmartDefaultAmount(customer: Customer, allTransactions: Transaction[]): number {
  const customerHistory = allTransactions
    .filter(tx => tx.customerId === customer.id && tx.status === 'paid')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5); // Take last 5 for better frequency calculation

  if (customerHistory.length > 0) {
    const amounts = customerHistory.map(tx => tx.amount);
    
    // 1. Check for Most Frequent in last 5
    const freq: Record<number, number> = {};
    amounts.forEach(a => freq[a] = (freq[a] || 0) + 1);
    const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    
    if (sortedFreq[0][1] >= 2) {
      return Number(sortedFreq[0][0]);
    }

    // 2. Fallback to Average of last 3 if not frequent
    const last3 = amounts.slice(0, 3);
    const avg = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length);
    return Math.max(1, avg);
  }

  // 3. Ultimate Fallback: loanAmount / 100 (rounded)
  const loan = customer.loanAmount || customer.loan || 0;
  return Math.max(1, Math.round(loan / 100));
}
