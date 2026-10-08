# Implementation Plan: Automated Daily 6:00 AM WhatsApp PDF Delivery

## 1. Executive Summary & User Requirements
- **Goal**: Automatically deliver a daily structured PDF report containing all Firestore data (customers, loans, balances, payment history, and daily collection totals) directly to a custom WhatsApp phone number every morning at 6:00 AM without requiring any manual interaction or button clicks.
- **Delivery Time**: 6:00 AM IST (`0 6 * * *` Asia/Kolkata timezone) daily via backend cron job.
- **Recipient**: Custom WhatsApp phone number configured in settings.
- **Data Scope**: Complete, structured audit export of all Firestore data (all customer profiles, cycle histories, active and overdue loan balances, payment ledgers, and transactions).
- **Delivery Channel**: Free channel options (Twilio WhatsApp Free Sandbox, Meta WhatsApp Cloud API free tier of 1,000 monthly conversations, or direct webhook gateway) with zero per-message cost for owner reporting.

---

## 2. System Architecture & Automation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 Node.js / Express Server                    │
│                        (server.ts)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────┐      ┌───────────────────────┐  │
│  │   node-cron Scheduler  │ ───► │  Data Aggregator &    │  │
│  │   Daily 6:00 AM IST    │      │  Firestore Fetcher    │  │
│  └────────────────────────┘      └──────────┬────────────┘  │
│                                             │               │
│                                             ▼               │
│                                  ┌───────────────────────┐  │
│                                  │ Structured PDF Engine │  │
│                                  │ (Multi-page Ledger)   │  │
│                                  └──────────┬────────────┘  │
│                                             │               │
│                                             ▼               │
│  ┌────────────────────────┐      ┌───────────────────────┐  │
│  │ User Settings Storage  │ ───► │ WhatsApp Delivery     │  │
│  │ (Phone & Credentials)  │      │ Service (Free Tier)   │  │
│  └────────────────────────┘      └──────────┬────────────┘  │
│                                             │               │
└─────────────────────────────────────────────┼───────────────┘
                                              │
                                              ▼
                             ┌─────────────────────────────────┐
                             │ Recipient WhatsApp Application  │
                             │ (Automated PDF Document Sent!)  │
                             └─────────────────────────────────┘
```

---

## 3. Key Components & Implementation Strategy

### A. Structured Backend PDF Generation (`server/pdfGenerator.ts`)
- Programmatically aggregates all records from Firestore:
  1. **Executive Overview**: Total active borrowers, total disbursed loans, total collected repayments, outstanding balance, and advance savings pool.
  2. **Comprehensive Borrower Directory**: Table of all customers, display IDs, phone numbers, cycle counts, maturity dates, and overdue status.
  3. **Recent Transaction Journal**: Date-by-date breakdown of cash, PhonePe, advance credits, and withdrawals.
- Formats the data into a professional, high-density, multi-page vector PDF with clear table formatting, running page numbers, and timestamped security headers.

### B. Automated 6:00 AM Scheduler (`server.ts`)
- Utilizes `node-cron` with India Standard Time (`Asia/Kolkata`):
  ```typescript
  cron.schedule("0 6 * * *", async () => {
    console.log("6:00 AM Daily WhatsApp PDF Automation triggered");
    await generateAndSendDailyReport();
  }, { timezone: "Asia/Kolkata" });
  ```
- Handles idempotency and error logging so that failures are automatically retried and recorded in the audit trail.

### C. Free-Tier WhatsApp Delivery Adapter (`server/whatsappService.ts`)
- Implements a flexible delivery engine supporting zero-cost channels:
  1. **Twilio WhatsApp Sandbox (Free)**: Zero-cost sandbox environment allowing automated message and PDF media delivery to your designated phone number.
  2. **Meta WhatsApp Cloud API (Free Tier)**: Direct Meta Graph API supporting up to 1,000 free business-initiated or service conversations per month.
  3. **Direct Webhook Gateway / Green-API / CallMeBot**: Simple API endpoint integration for sending documents to an owner's WhatsApp.
- If credentials are not yet entered, the server safely stores the generated PDF in the local media directory and logs a direct download URL.

### D. Settings & Management UI (`src/pages/Settings.tsx` & New Automation Modal)
- Adds a **"Daily WhatsApp PDF Automation"** card in the Settings view:
  - Input field for **Custom WhatsApp Phone Number** (with country code validation).
  - Time display showing scheduled dispatch at **6:00 AM IST**.
  - Provider selector (Twilio Sandbox / Meta Cloud / Webhook).
  - **"Send Test Report Now"** button: Generates the structured PDF immediately and triggers a test delivery so you can verify the output on your WhatsApp within seconds.
  - Quick download button to preview the exact PDF generated for today.

---

## 4. Verification & Testing Plan
1. **Compilation & Linting**: Verify that the entire TypeScript codebase builds cleanly.
2. **Immediate Test Trigger**: Test via `/api/automation/send-report` to generate the PDF from live Firestore data and deliver it immediately.
3. **PDF Content Validation**: Confirm that all borrower accounts, cycle numbers, pending balances, and transaction history appear in a well-structured layout.
4. **Schedule Verification**: Confirm that the 6:00 AM cron rule is registered and running in the server lifecycle.
