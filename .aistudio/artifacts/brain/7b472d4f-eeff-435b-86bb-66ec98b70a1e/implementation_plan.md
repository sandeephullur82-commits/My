# Existing Customer Onboarding with Prior Loan Repayments

A streamlined onboarding flow allowing collection agents to register existing borrowers who already have an active loan and partial repayments, by entering their remaining pending balance directly and generating an opening balance ledger record.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters were confirmed through clarifying answers:
> - **Input Method**: Agents can enter the remaining pending balance directly (e.g., ₹14,000 on a ₹20,000 loan), with automatic bi-directional calculation of amount paid (₹6,000) and equivalent installment days (30 days @ ₹200/day).
> - **Ledger & Audit**: A single opening balance transaction record will be created in the ledger (`type: 'deposit'`, note: `'Opening Balance / Prior Collections'`) so customer statements and totals balance with zero discrepancy.
> - **Form Placement**: Standard optional fields integrated directly into the primary "Add Customer" form under the Loan Terms section, accessible without navigating to separate screens.

---

### 1. Overview & Core Concept

- **What It Does**: Enables agents transitioning paper ledgers or previous systems to onboard borrowers with active loans in-progress (e.g., ₹20,000 loan over 100 days where ₹6,000 has already been collected across 30 days, leaving ₹14,000 pending).
- **Target Audience / Persona**: Field agents, Pigmy collectors, and daily micro-finance operators onboarding pre-existing borrowers without losing historical payment progress or distorting current outstanding balances.
- **Key Value**: Eliminates manual recalculations and workarounds; prevents newly onboarded borrowers from showing 0% repayment; maintains an accurate audit trail for statements.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Opening Add Customer Form**:
   - The user opens the customer creation form from the bottom navigation or customer directory.
   - Enters borrower details (Name, Phone, Aadhaar/ID) and loan terms (Principal: ₹20,000, 100 Days, ₹200/day).

2. **Entering Prior Loan Progress**:
   - In the **Loan & Repayment Terms** section, the agent sees an optional toggle/card: *"Existing Customer with Prior Repayments?"*.
   - When enabled, an interactive field appears: **Remaining Pending Balance (₹)** with helper presets.
   - As the agent inputs `14000`:
     - Live indicator shows: **Already Paid: ₹6,000** (equivalent to ~30 days @ ₹200/day).
     - Live progress gauge updates dynamically to reflect 30% progress.
     - Completion date & remaining installments recalculate in real-time (70 days remaining).

3. **Submitting & Viewing Ledger**:
   - On submission, the customer is saved with `loan = 20000`, `paid = 6000`, `pending = 14000`.
   - An opening balance transaction record is written to the transactions collection with label `Opening Balance: 30 days collected prior to system registration`.
   - The customer card immediately displays accurate pending balance (`₹14,000`), paid progress bar, and collection button ready for installment 31 (`₹200`).

#### Visual Identity & Ergonomics
- **Design Tokens**: Matches app theme using deep emerald accents for active loan balances (`text-emerald-500`, `bg-emerald-500/10`) and warm amber for pending balances (`text-amber-500`, `bg-amber-500/10`).
- **Tabular Figures**: Formatted with `font-mono tracking-tight` for precise currency scanning (`₹14,000 / ₹20,000`).
- **Touch Ergonomics**: Minimum $48 \times 48\text{px}$ touch targets for quick preset buttons (`-1000`, `Half Paid`, `Custom`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Pending Balance Input with Bi-Directional Auto-Sync**
  - *Chosen Approach*: Primary input accepts "Remaining Pending Balance" (as selected by the user), with secondary quick-calc display for "Amount Already Paid" and "Days Paid". Agents can also adjust either field smoothly.
  - *Why*: Field agents usually have the latest paper book stating the borrower still owes ₹14,000, making pending balance entry the fastest and least error-prone method.
  - *Alternatives Considered*: Re-entering 30 individual daily ₹200 receipts (too tedious) or back-dating calendar dates without manual override (prone to missed-day errors).

- **Decision 2: Single Ledger Opening Balance Record**
  - *Chosen Approach*: Create a single initial transaction document with metadata tag `isOpeningBalance: true`, amount `₹6,000`, and timestamp matching loan start date.
  - *Why*: Ensures PDF account statements, total collection charts, and receipts reflect mathematically sound totals without cluttering the daily collection feed with 30 synthetic notifications.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       Add Customer Form                     │
│  [ Name & Phone ]   [ Loan Amount: ₹20,000 ]  [ 100 Days ]  │
│                                                             │
│  ▼ Existing Loan Adjustment (Optional Toggle)               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Remaining Pending Balance: [ ₹ 14,000 ]               │  │
│  │ Auto-computed: Paid ₹6,000  (30 installments)         │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Firestore / Client State                    │
│                                                             │
│ 1. customers collection:                                    │
│    - id: "PIG-042"                                          │
│    - loanAmount: 20000                                      │
│    - paid: 6000                                             │
│    - pending: 14000                                         │
│    - hasOpeningBalance: true                                │
│                                                             │
│ 2. transactions collection:                                 │
│    - customerId: "PIG-042"                                  │
│    - amount: 6000                                           │
│    - type: "opening_balance"                                │
│    - note: "Opening balance: 30 days collected"             │
│    - balanceAfter: 14000                                    │
└─────────────────────────────────────────────────────────────┘
```

#### Data Model Extensions

- **Customer Document**:
  - `paid`: Set to the opening collected amount (e.g. `6000`).
  - `pending`: Set to `loanAmount - paid` (e.g. `14000`).
  - `openingBalance`: Optional number tracking initial imported paid amount.
- **Transaction Document**:
  - `id`: Auto-generated or `open_${customerId}`.
  - `customerId`: Target customer ID.
  - `amount`: Calculated initial paid sum (`6000`).
  - `type`: `'deposit'` or `'opening_balance'`.
  - `note`: `'Opening Balance: Prior Repayments Recorded'`.
  - `date`: Customer `startDate` or registration timestamp.
