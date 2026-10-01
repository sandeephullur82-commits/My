# Implementation Plan: Any Day Pending NP Detection & Settlement [COMPLETED]

The NP (Not Paid / Unsettled) workflow in the Entry customer cards has been upgraded from "yesterday only" to detect any recorded NP across any past day, always prioritizing the **oldest pending NP day first**.

## Delivered Changes
1. **Multi-Day Pending NP Detection (`src/components/Entry/CustomerCard.tsx`)**:
   - Detects all explicitly recorded unsettled NP transactions across any past date (`t.type === 'NP' || t.type === 'unsettled' || t.status === 'unsettled'`).
   - Automatically sorts pending NP entries chronologically ascending so the oldest missed day is always resolved first.
   - Computes queue metrics (e.g. `1 of 3 pending NPs`, with date badge e.g. `27 Sep 2026`).

2. **Oldest-First Settlement (`handleClearPendingNP`)**:
   - Directly updates the specific target NP transaction in Firestore (`status: 'paid'`, `type: 'cash' | 'phonepe'`, with timestamp and notes).
   - Updates customer balance and produces instant receipt popup.
   - If more pending NPs remain for the customer, immediately transitions to the next oldest NP.
   - When all pending NPs are settled, displays a celebratory banner and unlocks today's regular installment inputs.
