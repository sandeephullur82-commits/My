# Security Specification - Pigmy Pro

## Data Invariants
1. A **Customer** cannot be created without a valid name, phone, and initial loan amount.
2. A **Transaction** must always reference a valid `customerId`.
3. **Transactions** can only be created as 'paid' or 'pending'.
4. **Notifications** are strictly private to the `userId`.
5. `createdAt` and `updatedAt` must be server-validated.

## The Dirty Dozen (Payloads)
1. **Identity Spoofing**: Attempt to create a customer with an `id` that doesn't match the path.
2. **Owner Hijack**: Attempt to update another user's profile.
3. **Empty Integrity**: Create a transaction with amount 0.
4. **Link Poisoning**: Create a transaction for a non-existent customer.
5. **State Skip**: Update a transaction status to 'paid' without using the designated update pattern.
6. **Denial of Wallet**: Inject 1MB of text into the `name` field of a customer.
7. **Timestamp Fraud**: Provide a client-side `createdAt` date in the past.
8. **PII Leak**: Read all user profiles without being authenticated.
9. **Ghost Fields**: Add an `isAdmin: true` field to a user profile.
10. **Orphan Write**: Delete a customer but leave its transactions.
11. **ID Injection**: Use `../` or special characters in document IDs.
12. **Cross-User Notification**: Attempt to list another user's notifications.

## Test Runner (Logic Check)
All payloads above must return `PERMISSION_DENIED`.
