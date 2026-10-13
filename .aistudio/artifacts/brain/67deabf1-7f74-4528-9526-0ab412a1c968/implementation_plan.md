# Customer ID Reuse & Auto-Recycling

Enable immediate reuse of deleted borrower IDs (e.g., reusing `CUST-001` when a previous `CUST-001` borrower has been deleted), with automatic suggestion of the smallest available deleted ID and clean record reset.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during the interactive clarification phase:
> - **Auto-Suggestion Strategy**: The app will automatically find and suggest the lowest available/recycled ID (gap-filling). For example, if `CUST-001` is deleted, the next new customer form defaults to `CUST-001`.
> - **Data Reset Strategy**: When a recycled ID is used, the previous soft-deleted customer record and any historical links are cleanly overwritten and reset to start fresh with the new customer.

---

## 1. Overview & Core Concept

Currently, borrower IDs follow a sequential prefix pattern (`CUST-001`, `CUST-002`, etc.). When a customer is deleted, their document remains marked as `isDeleted: true` in Firestore, which previously caused two issues:
1. `checkIdUnique` saw the existing soft-deleted document and blocked reuse of that ID, showing an "ID already taken" validation error.
2. `getNextCustomerId` took `max(existing_ids) + 1`, continually incrementing upwards without filling in gaps left by deleted accounts.

This feature updates the ID allocation and uniqueness verification logic so that:
- Any ID whose existing record is marked `isDeleted: true` (or has no active record) is considered available for reuse.
- The new customer registration modal automatically calculates the lowest unused ID (re-assigning `CUST-001` first).
- Registering a new customer with a recycled ID cleanly initializes the document with brand new borrower data (`isDeleted: false`).

---

## 2. User Experience & Visual Design

### Registration Flow
```
┌────────────────────────────────────────────────────────┐
│ New Customer Modal                                     │
├────────────────────────────────────────────────────────┤
│ Borrower ID:                                           │
│ [ CUST- ] [ 001 ]  ✓ Available (Recycled ID)          │
│                                                        │
│ Name: [ Rahul Sharma                       ]           │
│ Phone: [ 9876543210                        ]           │
│ Loan Amount: [ ₹10,000                     ]           │
├────────────────────────────────────────────────────────┤
│ [ Cancel ]                      [ Save Customer ]      │
└────────────────────────────────────────────────────────┘
```

1. **Auto-Fill Lowest Gap**: Clicking "+ Add Borrower" automatically loads the lowest available ID (`CUST-001` if freed up).
2. **Instant Validation**: Typing or modifying the ID suffix (e.g., changing to `001`) performs an instant uniqueness check that checks only active (non-deleted) accounts. If only deleted accounts held that ID, it displays a green "✓ ID Available" badge.
3. **Manual Override Support**: Users can either accept the auto-suggested recycled ID or type any other available ID.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Lowest-Integer Gap Detection**:
  - *Chosen Approach*: Scan all active customer numbers (`1, 2, 3...`) and find the smallest positive integer `n >= 1` that is not currently assigned to any active customer.
  - *Why*: Ensures ID sequences remain compact, clean, and predictable without gaps in accounting numbers.

- **Decision 2: Clean Document Overwrite on Save**:
  - *Chosen Approach*: When saving a customer with an existing recycled ID, overwrite the customer document with fresh borrower payload, clearing `isDeleted: false`, new creation timestamp, and zeroed collections/balances.
  - *Why*: Guarantees the new customer starts with a completely pristine ledger and has no phantom data from the previous account.

---

## 4. Technical Architecture & Data Strategy

### System Workflow Diagram
```
┌─────────────────────────────────┐
│     Customer Registration       │
│      (CustomerForm.tsx)         │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     getNextCustomerId()         │
│   • Fetches active customers    │
│   • Extracts used numeric IDs   │
│   • Finds lowest free integer   │
│     (e.g., gap at #1 -> CUST-001)│
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     checkIdUnique(fullId)       │
│   • Checks active customers     │
│   • Ignores isDeleted: true     │
│   • Returns true for recycled   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│      saveCustomer(data)         │
│   • Overwrites doc with clean   │
│     payload                     │
│   • Updates cacheStorage        │
└─────────────────────────────────┘
```

### File-Level Implementation Plan

1. **`src/services/firestoreService.ts`**:
   - Update `getNextCustomerId()`:
     - Query active customers (where `isDeleted == false`) or scan customer set.
     - Collect all numeric suffixes into a set.
     - Find the lowest positive integer `i = 1, 2, 3...` not in the set.
     - Format as `CUST-${String(i).padStart(3, '0')}`.
   - Update `checkIdUnique(id: string)`:
     - Query `customers` where `id == id` and `isDeleted == false`.
     - Return `true` if no active customer holds this ID (allowing reuse of deleted IDs).
   - Update `saveCustomer` & `saveCustomerWithOpeningBalance`:
     - Overwrite existing soft-deleted document with clean customer properties.

2. **`src/components/CustomerForm.tsx`**:
   - Ensure the uniqueness check indicator correctly reflects that recycled IDs are valid and allowed.
   - Show helpful feedback if an ID is being recycled.

3. **Verification**:
   - Test `getNextCustomerId` when `CUST-001` is deleted.
   - Test saving a new customer with `CUST-001`.
   - Run `lint_applet` and `compile_applet`.
