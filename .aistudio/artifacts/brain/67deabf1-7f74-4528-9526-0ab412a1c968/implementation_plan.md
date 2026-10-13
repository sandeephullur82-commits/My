# Customer ID Range Support (CUST-001 to CUST-999)

## User Problem & Goal
Users want to be able to create and assign customer IDs within the range `CUST-001` to `CUST-999`, including IDs that do not currently exist in Firestore, without restrictions or blocking errors.

## Proposed Changes

### 1. Customer Form & ID Generation (`CustomerForm.tsx`)
- Allow entering or generating any sequential or custom ID in the range `CUST-001` to `CUST-999`.
- Ensure non-existing IDs within this range are accepted and allowed for new customer creation.

### 2. Firestore Service (`firestoreService.ts`)
- Ensure `getNextCustomerId` and `checkIdAvailability` support creating and validating IDs in the range `CUST-001` to `CUST-999`.

## Verification Plan
- Compile and lint code successfully.
- Test creating a customer with IDs between `CUST-001` and `CUST-999`.
