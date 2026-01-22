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

#### Option 1: Using GOOGLE_APPLICATION_CREDENTIALS (Recommended)

1. Download your Firebase Admin SDK service account JSON file
2. Place it in the project root (it's gitignored)
3. Set the path in your shell or .env:
   ```
   export GOOGLE_APPLICATION_CREDENTIALS=./path-to-your-key.json
   ```

#### Option 2: Using FIREBASE_SERVICE_ACCOUNT

Add to your `.env` file:
```
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

## Email Configuration (TODO)

The account deletion feature currently logs confirmation URLs to the console. To enable email sending in production:

1. Choose an email service (SendGrid, AWS SES, Mailgun, etc.)
2. Add API keys to environment variables
3. Update `/src/routes/api/account/delete/request/+server.js` to send actual emails
4. Replace the TODO comment with proper email sending logic

Example services:
- **SendGrid**: Add `SENDGRID_API_KEY`
- **AWS SES**: Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- **Mailgun**: Add `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`

## Testing the Feature

### Manual Testing Steps

1. **Request deletion**:
   - Log in to your account
   - Go to `/account`
   - Scroll to "Danger Zone"
   - Click "Delete my account"
   - Click "Send confirmation email"

2. **In development**: Check the console for the confirmation URL

3. **Confirm deletion**:
   - Click the confirmation link (or visit the URL manually)
   - The account will be deleted immediately
   - You'll be logged out and redirected to the homepage

4. **Verify deletion**:
   - Check Firebase Authentication - user should be removed
   - Check Firestore - user data, reactions, bookmarks should be removed
   - Try to log in with the same credentials - should fail

### Security Testing

1. **Cannot delete other users**:
   - Try to modify the request to include a different userId
   - Should fail (userId is derived from auth token only)

2. **Token expiration**:
   - Generate a deletion token
   - Wait 1 hour
   - Try to use it - should fail with "expired" error

3. **Token single-use**:
   - Generate a deletion token
   - Use it once (complete deletion)
   - Try to use the same token again - should fail

4. **Rate limiting**:
   - Try to request deletion more than 3 times in 1 hour
   - Should receive 429 Too Many Requests error

## Implementation Notes

- Deletion is **immediate and irreversible**
- All user data is hard-deleted (no soft delete or anonymization)
- Algolia search index cleanup happens during next indexing cycle (~5 business days)
- Firebase Admin SDK is required for secure deletion
- Tokens expire after 1 hour
- Rate limit: 3 deletion requests per user per hour
