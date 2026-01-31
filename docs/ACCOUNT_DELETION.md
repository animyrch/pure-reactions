# Account Deletion Feature

## Overview

This feature allows users to permanently delete their own account through a secure, self-service flow with in-app reauthentication.

## Architecture

### Flow Diagram

```
User clicks "Delete my account"
    ↓
Intent confirmation modal (step 1)
    ↓
Identity confirmation (reauth) (step 2)
    ↓
Client refreshes ID token
    ↓
Frontend → POST /api/account/delete (Authorization: Bearer <token>)
    ↓
Backend verifies token + recent sign-in (auth_time)
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
Frontend logs out user
    ↓
Redirect to homepage
```

## Files

### Backend API Endpoint

- **`/src/routes/api/account/delete/+server.js`**
  - Handles POST requests to delete account
  - Verifies user authentication via Firebase ID token
  - Enforces recent sign-in (auth_time threshold)
  - Performs data deletion, refresh token revocation, and Auth user deletion

### Frontend Page

- **`/src/routes/account/+page.svelte`**
  - Account settings page with "Danger Zone" section
  - Two-step modal:
    - Step 1: Intent confirmation
    - Step 2: Identity confirmation (password re-entry or provider reauth)
  - Calls `/api/account/delete` endpoint after reauth

## Security Features

### 1. User Identity Verification
- User ID is derived **only** from Firebase ID token via `verifyIdToken()`
- Never accepts userId from client requests
- Deletion is executed only for the authenticated caller

### 2. Recent Sign-In Enforcement
- Backend checks `auth_time` from the ID token
- Requires reauthentication within a short threshold (recommended: 5 minutes)

### 3. Authorization
- All endpoints require valid Firebase authentication
- Expired or invalid tokens rejected with 401 Unauthorized

### 4. Atomic Operations
- Firestore batch writes ensure all-or-nothing deletion
- Refresh tokens revoked to invalidate sessions

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
FIREBASE_SERVICE_ACCOUNT=./path-to-service-account.json
```

See [ACCOUNT_DELETION_SETUP.md](./ACCOUNT_DELETION_SETUP.md) for detailed setup instructions.

## Testing

### Manual Testing Checklist

- [ ] User can start account deletion
- [ ] Confirmation modal displays all warnings (step 1)
- [ ] Identity confirmation step appears (step 2)
- [ ] Reauthentication required for email/password users
- [ ] Reauthentication required for Google users (when enabled)
- [ ] Backend rejects deletion when auth is not recent
- [ ] Account deletion removes all user data
- [ ] User is logged out after deletion
- [ ] User is redirected to homepage
- [ ] Deleted user cannot log in again
- [ ] Cannot delete other users' accounts

### Security Testing

```bash
# Test 1: Recent sign-in required
# Log in, wait past threshold, attempt deletion -> should fail with "recent sign-in required"

# Test 2: Cannot delete other users
# Log in as User A and attempt deletion -> only User A is removed

# Test 3: Invalid token
# Use expired/malformed token -> should fail with 401 Unauthorized
```

## Future Enhancements

- Grace period (e.g., 30 days to cancel deletion)
- Optional pre-delete export reminder in the deletion flow
- Admin dashboard for monitoring deletion requests
- Audit log for compliance tracking

## Compliance

This feature helps comply with data protection regulations:

- **GDPR Article 17** - Right to erasure ("right to be forgotten")
- **CCPA** - Right to deletion
- **COPPA** - Parental deletion requests

Users can delete their account without contacting support, fulfilling self-service deletion requirements.
