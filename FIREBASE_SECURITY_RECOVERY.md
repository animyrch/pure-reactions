# Firebase Security Recovery Guide

## ⚠️ Critical: Exposed Firebase Admin SDK Key

The Firebase Admin SDK private key was previously committed to this repository and exists in the git history. This is a **critical security vulnerability** that must be addressed immediately.

## Required Actions (Do These ASAP)

### 1. Revoke the Compromised Service Account Key

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **pure-reactions**
3. Click the gear icon ⚙️ and select **Project settings**
4. Go to the **Service accounts** tab
5. Find the service account: `firebase-adminsdk-tki7b@pure-reactions.iam.gserviceaccount.com`
6. Click **Manage service account permissions** (this will open Google Cloud Console)
7. In Google Cloud Console:
   - Click on the service account email
   - Go to the **KEYS** tab
   - Find the key with ID: `04e5ffe316d8c97bbc6b2cd7b075c2e99e3e08ab`
   - Click the three dots menu ⋮ and select **Delete**
   - Confirm the deletion

### 2. Generate a New Service Account Key

1. While still in the Google Cloud Console service account page:
   - Click **ADD KEY** → **Create new key**
   - Select **JSON** format
   - Click **Create**
   - The key will download automatically
2. Save this file securely on your local machine
3. **DO NOT** commit this file to git
4. Rename it to match the pattern: `pure-reactions-firebase-adminsdk-[new-key-id].json`
5. Place it in the root directory of your local project (it's now ignored by `.gitignore`)

### 3. Update Environment Configuration

Update any deployment environments (Netlify, etc.) with the new credentials:

1. For local development:
   - Update the `GOOGLE_APPLICATION_CREDENTIALS` path in your local `.env` file (if you have one)
   - Or ensure the JSON file is in the root directory for the scripts to pick it up

2. For CI/CD (if applicable):
   - Update any environment variables or secrets that reference the old credentials
   - Check GitHub Actions secrets, Netlify environment variables, etc.

### 4. Update package.json Scripts (if needed)

The following scripts reference the Firebase Admin SDK file:
```json
"seed:firestore": "GOOGLE_APPLICATION_CREDENTIALS=./pure-reactions-firebase-adminsdk-tki7b-04e5ffe316.json ...",
"seed:twin-fixtures": "GOOGLE_APPLICATION_CREDENTIALS=./pure-reactions-firebase-adminsdk-tki7b-04e5ffe316.json ...",
"migrate:delete-legacy-timelines": "GOOGLE_APPLICATION_CREDENTIALS=./pure-reactions-firebase-adminsdk-tki7b-04e5ffe316.json ..."
```

Update these to use an environment variable instead:
```json
"seed:firestore": "node scripts/seed-firestore-fixtures.mjs",
"seed:twin-fixtures": "node scripts/seed-twin-player-fixtures.mjs",
"migrate:delete-legacy-timelines": "node scripts/migrate-delete-legacy-timelines.mjs"
```

Then set the environment variable in your shell:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./pure-reactions-firebase-adminsdk-[new-key-id].json"
```

Or add it to your `.env` file (which is gitignored).

### 5. Clean Git History (Optional but Recommended)

**Warning**: This is a destructive operation that rewrites git history. Only do this if you understand the implications.

Since the private key exists in git history, anyone who has cloned the repository can still access it. To fully remove it:

**Option A: Use git-filter-repo (Recommended)**
```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove the file from all history
git filter-repo --path pure-reactions-firebase-adminsdk-tki7b-04e5ffe316.json --invert-paths

# Force push (⚠️ coordinate with all contributors first!)
git push origin --force --all
```

**Option B: Use BFG Repo-Cleaner**
```bash
# Download BFG from https://rtyley.github.io/bfg-repo-cleaner/
# Run BFG to remove the file
bfg --delete-files pure-reactions-firebase-adminsdk-tki7b-04e5ffe316.json

# Clean up
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

**Note**: After rewriting history, all contributors must re-clone the repository or reset their local copies.

## Verification Checklist

- [ ] Old Firebase Admin SDK key has been deleted from Google Cloud Console
- [ ] New Firebase Admin SDK key has been generated and saved securely
- [ ] New key file is placed in the root directory locally
- [ ] New key file is NOT committed to git (verify with `git status`)
- [ ] `.gitignore` includes patterns to prevent future commits of credential files
- [ ] `package.json` scripts have been updated to use environment variables
- [ ] All deployment environments have been updated with new credentials
- [ ] (Optional) Git history has been cleaned to remove the exposed key

## Monitoring

After revoking the old key:
- Monitor your Firebase project for any unusual activity
- Check Firebase Authentication logs
- Review Firestore database access logs
- Consider rotating other credentials if you suspect broader compromise

## Questions?

If you have questions about this process, refer to:
- [Firebase Service Account Documentation](https://firebase.google.com/docs/admin/setup#initialize-sdk)
- [Google Cloud IAM Documentation](https://cloud.google.com/iam/docs/creating-managing-service-account-keys)
