# Account Deletion Feature - Environment Setup

## Required Environment Variables

### For Netlify/Production Deployment

Add the following environment variable to your Netlify site settings:

```
FIREBASE_SERVICE_ACCOUNT
```

This should contain the JSON content of your Firebase Admin SDK service account key. To obtain this:

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Copy the entire JSON content
4. In Netlify: Site settings → Environment variables → Add variable
5. Name: `FIREBASE_SERVICE_ACCOUNT`
6. Value: Paste the entire JSON content (as a single-line string or minified JSON)

### For Local Development

For local development, you have two options:

#### Option 1: Using FIREBASE_SERVICE_ACCOUNT (Recommended)

1. Download your Firebase Admin SDK service account JSON file
2. Place it in the project root (it's gitignored)
3. Set the path in your shell or .env:
   ```
   export FIREBASE_SERVICE_ACCOUNT=./path-to-your-key.json
   ```

#### Option 2: Using inline JSON in FIREBASE_SERVICE_ACCOUNT

Add to your `.env` file:
```
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

## Testing the Feature

### Manual Testing Steps

1. **Request deletion**:
   - Log in to your account
   - Go to `/account`
   - Scroll to "Danger Zone"
   - Click "Delete my account"
   - Review the warnings
   - Click "Continue"

2. **Confirm deletion**:
   - Reauthenticate (password entry or Google popup)
   - Click "Delete account" or "Continue with Google"
   - The account will be deleted immediately
   - You'll be logged out and redirected to the homepage

3. **Verify deletion**:
   - Check Firebase Authentication - user should be removed
   - Check Firestore - user data, reactions, bookmarks should be removed
   - Try to log in with the same credentials - should fail

### Security Testing

1. **Cannot delete other users**:
   - Try to modify the request to include a different userId
   - Should fail (userId is derived from auth token only)

2. **Recent sign-in required**:
   - Log in and wait past the recency threshold
   - Attempt deletion without reauth
   - Should fail with "recent sign-in required"

## Implementation Notes

- Deletion is **immediate and irreversible**
- All user data is hard-deleted (no soft delete or anonymization)
- Algolia search index cleanup happens during next indexing cycle (~5 business days)
- Firebase Admin SDK is required for secure deletion
- Backend enforces recent sign-in before deletion
