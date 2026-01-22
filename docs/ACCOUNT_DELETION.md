# Account Deletion Feature

## Overview

This feature allows users to permanently delete their own account through a secure, self-service flow with email confirmation.

## Architecture

### Flow Diagram

```
User clicks "Delete my account"
    ↓
Opens confirmation modal
    ↓
User confirms → POST /api/account/delete/request
    ↓
Backend generates one-time token (expires in 1 hour)
    ↓
Token stored in Firestore deletionTokens collection
    ↓
[TODO: Send email with confirmation link]
    ↓
User clicks link → /account/delete/confirm?token=xxx
    ↓
Frontend → POST /api/account/delete/confirm
    ↓
Backend validates token (not used, not expired)
    ↓
Mark token as used
    ↓
Delete user data (atomic batch):
    - User profile document
    - All reactions (reactorId == userId)
    - Bookmarks and follows
    - Playlists and queues
    ↓
Revoke all refresh tokens
    ↓
Delete Firebase Auth user
    ↓
Delete token document
    ↓
Frontend logs out user
    ↓
Redirect to homepage
```

## Files

### Backend API Endpoints

- **`/src/routes/api/account/delete/request/+server.js`**
  - Handles POST requests to initiate account deletion
  - Verifies user authentication via Firebase ID token
  - Implements rate limiting (3 requests per hour per user)
  - Generates cryptographically secure one-time token
  - Stores token in Firestore with expiration timestamp
  - Returns success message (and URL in development mode)

- **`/src/routes/api/account/delete/confirm/+server.js`**
  - Handles POST requests to confirm and execute deletion
  - Validates token (exists, not used, not expired)
  - Marks token as used immediately
  - Performs atomic batch deletion of all user data
  - Revokes refresh tokens to invalidate all sessions
  - Deletes Firebase Auth user record
  - Cleans up token document

### Frontend Pages

- **`/src/routes/account/+page.svelte`**
  - Account settings page with "Danger Zone" section
  - "Delete my account" button
  - Confirmation modal with warnings
  - Calls `/api/account/delete/request` endpoint

- **`/src/routes/account/delete/confirm/+page.svelte`**
  - Handles email link clicks
  - Extracts token from URL query parameter
  - Calls `/api/account/delete/confirm` endpoint
  - Shows loading, success, or error states
  - Logs out user and redirects to homepage

### Updated Files

- **`/src/lib/constants/toasts.js`**
  - Added `ERROR` and `INFO` toast types

## Security Features

### 1. User Identity Verification
- User ID is derived **only** from Firebase ID token via `verifyIdToken()`
- Never accepts userId from client requests
- Any attempt to delete another user's account returns 403 Forbidden

### 2. Token Security
- Tokens are cryptographically random (32 bytes, hex-encoded)
- Stored in Firestore `deletionTokens` collection
- One-time use only (marked as `used: true` after first use)
- Time-limited (expires after 1 hour)
- Deleted after successful account deletion

### 3. Rate Limiting
- In-memory rate limiter (sufficient for Netlify functions)
- Max 3 deletion requests per user per hour
- Returns 429 Too Many Requests if exceeded

### 4. Authorization
- All endpoints require valid Firebase authentication
- ID token must be provided in Authorization header
- Expired or invalid tokens rejected with 401 Unauthorized

### 5. Atomic Operations
- Firestore batch writes ensure all-or-nothing deletion
- Critical error logging if token marked used but deletion fails

## Data Deletion

The following data is permanently deleted:

### Firestore Collections
1. User profile document (`COLLECTION_USER_DATA`)
2. All reactions where `reactorId == userId` (`COLLECTION_REACTION_BINOMES`)
3. User bookmarks (`userExtraData/{userId}`)
4. User follows (`userExtraData/{userId}/follows/*`)
5. User playlists (`COLLECTION_PLAYLISTS` where `reactorId == userId`)
6. User queues (`COLLECTION_QUEUES` where `reactorId == userId`)

### Firebase Authentication
- User authentication record deleted via `deleteUser(userId)`
- All refresh tokens revoked via `revokeRefreshTokens(userId)`

### Algolia Search Index
- Reaction deletion from Firestore triggers automatic removal from Algolia during next indexing cycle
- May take up to 5 business days to fully propagate
- Users are informed of this delay in the UI

## Configuration

### Required Environment Variables

#### Production (Netlify)
```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

#### Local Development
```bash
GOOGLE_APPLICATION_CREDENTIALS=./path-to-service-account.json
```

See [ACCOUNT_DELETION_SETUP.md](./ACCOUNT_DELETION_SETUP.md) for detailed setup instructions.

## Testing

### Manual Testing Checklist

- [ ] User can request account deletion
- [ ] Confirmation modal displays all warnings
- [ ] Deletion request generates token
- [ ] Token is stored in Firestore
- [ ] Token expires after 1 hour
- [ ] Token can only be used once
- [ ] Rate limiting works (max 3 requests/hour)
- [ ] Confirmation page loads successfully
- [ ] Account deletion removes all user data
- [ ] User is logged out after deletion
- [ ] User is redirected to homepage
- [ ] Deleted user cannot log in again
- [ ] Cannot delete other users' accounts

### Security Testing

```bash
# Test 1: Cannot use another user's token
# Generate token for User A, try to use as User B → should fail

# Test 2: Cannot reuse token
# Use token once → try to use again → should fail with "already used"

# Test 3: Expired token
# Generate token → wait 1+ hours → use token → should fail with "expired"

# Test 4: Rate limiting
# Request deletion 4 times quickly → 4th request should fail with 429
```

## Future Enhancements

### Email Service Integration

Currently, the confirmation URL is only logged to the console in development. To enable email sending:

1. Choose an email service provider
2. Install the SDK (e.g., `npm install @sendgrid/mail`)
3. Update `/src/routes/api/account/delete/request/+server.js`:

```javascript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: user.email,
  from: 'noreply@purereactions.com',
  subject: 'Confirm Account Deletion',
  text: `Click this link to confirm deletion: ${confirmationUrl}`,
  html: `<p>Click this link to confirm deletion: <a href="${confirmationUrl}">${confirmationUrl}</a></p>`
};

await sgMail.send(msg);
```

### Possible Future Features

- [ ] Grace period (e.g., 30 days to cancel deletion)
- [ ] Data export before deletion
- [ ] Email notification to confirm deletion completion
- [ ] Admin dashboard to view deletion requests
- [ ] Audit log for compliance

## Compliance

This feature helps comply with data protection regulations:

- **GDPR Article 17** - Right to erasure ("right to be forgotten")
- **CCPA** - Right to deletion
- **COPPA** - Parental deletion requests

Users can delete their account without contacting support, fulfilling self-service deletion requirements.
