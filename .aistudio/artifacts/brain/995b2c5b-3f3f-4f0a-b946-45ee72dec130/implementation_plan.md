# Matured Loan Renewal & Interest Restructuring Engine

This plan redesigns the Loan Renewal engine in Pigmy Pro. Rather than issuing a separate new loan, Renewal is now an **overdue loan maturity restructuring workflow** located **exclusively on the Dashboard**. When a customer's loan reaches its end date with an outstanding balance, the account converts into the Dashboard Renewal Section where the agent can either renew the remaining balance with custom interest and a new term duration, or reject the renewal to retain standard overdue collection.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product specifications were confirmed during the interactive interview:
> - **Core Definition**: Renewal is **not** a new loan; it is the restructuring of an expired loan's remaining balance when the loan target end date has passed (`endDate <= today`) and an unpaid balance remains (`pending > 0`).
> - **Exclusive Placement**: The Renewal section is located **on the Dashboard only** as a prominent top-level alert banner and action card list.
> - **Interest & Duration Input**: The agent can add interest to the remaining balance either as a **flat percentage (%)** or **rupee amount (₹)**, and configure the new repayment duration (days).
> - **Rejection Workflow**: The agent can explicitly **Reject** renewal. A rejected account is dismissed from the Dashboard renewal section and remains active as an **Overdue** borrower in standard daily collection lists.
> - **Full Historical Audit**: Every completed cycle is archived into `customer.cycles` on the customer profile, documenting the original principal, amount repaid, balance rolled over, interest assessed, and term dates.

---

## 1. Overview & Core Concept

### What It Does
When daily microfinance borrowers reach the end of their agreed loan term without having settled their total balance, field agents need a standard protocol to refinance or extend that debt with interest. This system automatically identifies matured accounts with unpaid balances, surfaces them on the Dashboard in a dedicated **"Matured Loan Renewals"** panel, allows the agent to apply renewal interest + new repayment schedule, and updates the customer's ledger while archiving the completed cycle.

### Target Audience & Persona
Field collection agents and branch supervisors who need instant clarity on matured loans at the start of each morning route, with full flexibility to negotiate extension terms or flag accounts as delinquent.

### Key Value Delivered
- **Dashboard-First Visibility**: Zero hunting through customer lists—matured accounts with pending balances appear front-and-center on the Dashboard.
- **Accurate Debt Restructuring**: Automatically calculates:
  $$\text{New Principal} = \text{Remaining Balance} + \text{Renewal Interest}$$
  and determines the daily installment rate based on the new duration.
- **Rejection Safety**: Explicit "Reject" action marks the loan as non-renewable and keeps it in the regular overdue list without cluttering the renewal feed.
- **Unbroken Historical Chain**: Lifetime borrower records retain every cycle's performance, repayment rate, and added charges.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DASHBOARD MATURED RENEWAL FLOW                       │
└────────────────────────────────────────────────────────────────────────┘

  1. DASHBOARD RECOGNITION
     Agent opens Dashboard ──► Dedicated Top Renewal Banner
     Displays: "3 Matured Loans with Unpaid Balance (₹14,200 total)"
     │
     ▼
  2. RENEWAL CARDS
     Each card displays:
     ├── Customer Name, ID, Phone
     ├── Matured Date & Days Past Maturity
     ├── Original Principal vs. Remaining Balance Due
     └── Two Action Buttons: [Reject] and [Renew Loan]
     │
     ├───────────────────────────────────┐
     │                                   │
     ▼ (Tap "Reject")                    ▼ (Tap "Renew Loan")
  3A. REJECT FLOW                    3B. RENEW MODAL
     Prompt confirmation:                Interactive Calculator:
     "Dismiss renewal and keep           ├── Remaining Balance (Base)
      as Overdue?"                       ├── Interest Mode (Toggle % or ₹)
     │                                   ├── Interest Amount Input
     ▼                                   ├── New Total Debt (Base + Interest)
     Removed from Dashboard feed.        ├── Duration (Days) & Daily Installment
     Marked as Overdue in regular        └── New Maturity End Date
     collection route.                   │
                                         ▼
                                     4. ACTIVATION
                                         ├── Archives previous cycle
                                         ├── Resets active loan & pending
                                         ├── Generates optional WhatsApp alert
                                         └── Returns customer to active cards
```

### Visual Identity & Theme
- **Dominant Neutral Field**: Slate/zinc dark and crisp card surfaces matching Pigmy Pro's existing aesthetic.
- **Renewal Alert Styling**: Deep amber/gold accent palette (`#D97706` / `#F59E0B`) with subtle warning border indicating matured debt.
- **Typography**: Strict tabular numerals (`font-mono tabular-nums`) for all monetary values, percentages, and daily installment ratios.
- **Anti-Slop Discipline**: Clean unboxed metadata separated by typographic dots (`Matured 4d ago · ₹4,200 due · Cycle #1`). No decorative pill capsules.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Trigger Condition for Dashboard Renewal Section
- **Chosen Approach**: A customer is converted into the Dashboard Renewal Section if:
  1. `customer.endDate <= Date.now()` (maturity date reached or passed)
  2. `customer.pending > 0` (unpaid balance remains)
  3. `customer.renewalStatus !== 'rejected'` (has not been dismissed by agent)
- **Why**: Eliminates manual tagging; the system automatically detects expired terms and presents them to the agent for action.

### Decision 2: Interest Addition Math
- **Chosen Approach**: 
  - Base Amount = `customer.pending`
  - Interest = User enters either Rupee amount ($I_₹$) or Percentage ($P_\% \times \text{Base}$)
  - New Loan Principal = $\text{Base} + \text{Interest}$
  - Daily Installment = $\lceil \text{New Principal} / \text{New Duration Days} \rceil$
- **Why**: Standard daily collection accounting; compensates the lender for term extension while giving borrowers an affordable daily installment.

### Decision 3: Rejection State & Recovery
- **Chosen Approach**: When an agent rejects renewal, `renewalStatus` is set to `'rejected'` with `rejectedAt` timestamp. The account is removed from the Dashboard renewal section and stays in the regular collection/customer list with standard `overdue` badges.
- **Reconsideration Option**: In the Customer Details page, if an account has a rejected renewal, a quiet action button allows the agent to "Reopen Renewal" if the borrower later agrees to terms.

---

## 4. Technical Architecture & Data Strategy

### System Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURAL BLUEPRINT                         │
└────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────┐
  │                            DASHBOARD                               │
  │                                                                    │
  │   [Dashboard.tsx]                                                  │
  │   └── [DashboardRenewalSection.tsx]                                │
  │       ├── Alert Header & Matured Count                             │
  │       ├── Matured Customer Cards                                   │
  │       ├── Quick "Reject" Handler                                   │
  │       └── "Renew" Button ──► Opens [MaturedRenewalModal.tsx]       │
  └─────────────────────────────────┬──────────────────────────────────┘
                                    │
                                    ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                           MODAL LAYER                              │
  │                                                                    │
  │   [MaturedRenewalModal.tsx]                                        │
  │   ├── Base Balance Display (Remaining Unpaid)                      │
  │   ├── Interest Mode Toggle (% / ₹) & Input Calculator              │
  │   ├── Duration (Days) & Auto Daily Installment Schedule            │
  │   ├── New Target End Date Calculation                              │
  │   └── Submit Action ──► Calls firestoreService                     │
  └─────────────────────────────────┬──────────────────────────────────┘
                                    │
                                    ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                         SERVICE LAYER                              │
  │                                                                    │
  │   firestoreService.renewMaturedLoan(customerId, renewalPayload)    │
  │   ├── 1. Snapshot previous cycle into customer.cycles[]            │
  │   ├── 2. Set loan = remaining + interest, pending = loan, paid = 0 │
  │   ├── 3. Update startDate = today, endDate = today + duration      │
  │   ├── 4. Set currentCycle = currentCycle + 1                       │
  │   └── 5. Clear renewalStatus / reset state                         │
  │                                                                    │
  │   firestoreService.rejectMaturedRenewal(customerId, reason)        │
  │   └── Sets renewalStatus = 'rejected', rejectedAt = now            │
  └─────────────────────────────────┬──────────────────────────────────┘
                                    │
                                    ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                        CUSTOMER PROFILE                            │
  │                                                                    │
  │   [CustomerDetails.tsx]                                            │
  │   ├── Active Restructured Loan Details (Cycle #X)                  │
  │   └── [LoanCycleHistory.tsx] Accordion                             │
  │       └── Displays previous cycle principal, repaid, remaining     │
  │           balance rolled over, and added renewal interest          │
  └────────────────────────────────────────────────────────────────────┘
```

### Data Model Specifications

```typescript
export interface LoanCycle {
  cycleNumber: number;          // 1, 2, 3...
  originalLoanAmount: number;   // Original principal
  paidAmount: number;           // Total repaid during term
  remainingAtMaturity: number;  // Unpaid balance when term ended
  renewalInterestAdded?: number;// Interest added on renewal
  newRenewedPrincipal?: number; // Base + Interest
  startDate: number;            // Cycle start timestamp
  endDate: number;              // Expired end timestamp
  renewedAt: number;            // Timestamp when renewal was executed
  durationDays: number;         // Original duration in days
  status: 'matured_renewed' | 'completed' | 'rejected_overdue';
  notes?: string;
}

export interface Customer {
  // Existing core fields...
  renewalStatus?: 'pending_review' | 'rejected' | 'renewed' | null;
  renewalRejectedAt?: number;
  currentCycle?: number;
  cycles?: LoanCycle[];
  lastRenewalDate?: number;
}
```

### Verification & Validation Plan
1. **Compilation Check**: Run `compile_applet` and `lint_applet` to verify clean TypeScript builds with zero syntax errors.
2. **Dashboard Rendering Test**: Verify matured accounts (`endDate < now` and `pending > 0`) appear in the Dashboard renewal banner.
3. **Interest Math Validation**: Verify % interest calculation and flat ₹ interest both accurately update total debt and daily installment.
4. **Rejection Flow Test**: Verify pressing "Reject" removes the card from Dashboard renewal feed and preserves customer in the overdue collection list.
5. **Cycle Ledger Verification**: Check Customer Details to confirm historical cycle records show previous amounts, dates, and renewal charges accurately.
