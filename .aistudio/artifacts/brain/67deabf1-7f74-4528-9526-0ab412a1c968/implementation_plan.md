# Implementation Plan - Contact Import Feature

Add a "Select from Phone Contacts" button at the top of the customer name field in `CustomerForm.tsx`, leveraging the browser's native `navigator.contacts` Contact Picker API with automatic fallback for unsupported browsers.

## Proposed Changes

### `src/components/CustomerForm.tsx`

- **Add "Select from Phone Contacts" Button**:
  - Place a button right at the top of the customer name field section.
  - Styled consistently with existing buttons (touch-friendly, responsive).
- **Contact Picker Integration (`navigator.contacts`)**:
  - Feature-detect `navigator.contacts` and supported properties (`['name', 'tel']`).
  - On button click, call `navigator.contacts.select(['name', 'tel'], { multiple: false })`.
  - Extract the first name and first phone number.
  - Automatically populate `formData.name` and `formData.phone` state setters.
- **Graceful Fallback**:
  - If `navigator.contacts` is not supported in the current browser/PWA environment, gracefully hide or disable the button or display a friendly toast/notice, allowing normal manual entry without disruption.

## Verification Plan

- **Automated Checks**:
  - Run `npm run lint` (`tsc --noEmit`).
  - Run `npm run build` (`vite build`).
- **Manual Verification**:
  - Verify UI rendering of the "Select from Phone Contacts" button at the top of the customer name field in `CustomerForm.tsx`.
  - Verify graceful behavior on unsupported browsers/desktop.
