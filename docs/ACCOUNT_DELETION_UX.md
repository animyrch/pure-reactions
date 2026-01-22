# Account Deletion Feature - UI/UX Guide

## User Journey

### Step 1: Navigate to Account Settings
**URL:** `/account`  
**Requirement:** User must be logged in

The account settings page displays:
- Grid of account management options (Edit Info, My Reactions, Bookmarks, Logout)
- **Danger Zone** section at the bottom (visually distinct with red border)

#### Danger Zone Section
```
┌─────────────────────────────────────────────────┐
│ 🔴 Danger Zone                                  │
│                                                 │
│ Once you delete your account, there is no      │
│ going back. Please be certain.                 │
│                                                 │
│ [Delete my account]  <-- Red button            │
└─────────────────────────────────────────────────┘
```

**Design Elements:**
- Red border (2px, `border-red-600`)
- Dark background (`bg-surface-dark`)
- Red heading text (`text-red-500`)
- Muted text for warning (`text-text-muted`)
- Red button (`bg-red-600 hover:bg-red-700`)

### Step 2: Intent Confirmation (Modal)
**Triggered by:** Clicking "Delete my account"

The modal presents:
- Warning icon (red circle with exclamation)
- Clear heading: "Delete your account permanently?"
- Comprehensive warning list
- Two action buttons (Cancel, Continue)

#### Modal Content (Step 1)
```
┌─────────────────────────────────────────────────┐
│               ⚠️ (red warning icon)             │
│                                                 │
│      Delete your account permanently?           │
│                                                 │
│  ⚠️ This action cannot be undone                │
│                                                 │
│  • All your reactions will be permanently       │
│    deleted                                      │
│  • Your bookmarks and follows will be removed   │
│  • Your account and profile will be deleted     │
│  • You will be immediately logged out           │
│  • Search results may take up to 5 business     │
│    days to fully disappear                      │
│                                                 │
│  You will confirm your identity in the next     │
│  step to complete deletion.                     │
│                                                 │
│          [Cancel]  [Continue] <-Red             │
└─────────────────────────────────────────────────┘
```

### Step 3: Identity Confirmation (Reauth)
**Triggered by:** Clicking "Continue"

The modal switches to identity confirmation based on provider:

#### Email/Password
- Password input field
- Primary action: "Delete account"

#### Google (future-ready)
- Provider button: "Continue with Google"
- Shows account chooser / reauth popup

#### Unsupported Providers
- Message explaining reauth is not supported for deletion yet
- Disable the primary action button

#### Modal Content (Step 2)
```
┌─────────────────────────────────────────────────┐
│               ⚠️ (red warning icon)             │
│                                                 │
│             Confirm your identity               │
│                                                 │
│  Signed in with {provider}. Reauthenticate to   │
│  proceed.                                       │
│                                                 │
│  [Password input] OR [Continue with Google]     │
│                                                 │
│        [Back]  [Delete account] <-Red           │
└─────────────────────────────────────────────────┘
```

### Step 4: Completion
**Success:**
- Account is deleted immediately
- User is logged out
- Redirect to homepage
- Toast or status feedback confirms deletion

**Failure:**
- Inline error message in modal
- User can retry reauth or go back

## Copy Guidelines

### Required Warnings
Per spec, these messages MUST appear:
1. "This action cannot be undone"
2. "All your reactions will be permanently deleted"
3. "Search results may take up to 5 business days to fully disappear"

### Error Messages (Examples)
- "Incorrect password. Please try again."
- "Reauthentication was canceled."
- "Recent sign-in required. Please reauthenticate and try again."
- "Failed to delete account. Please try again."

## UI Components Used

### From Flowbite-Svelte
- `Card` - Account settings options
- `Button` - All action buttons
- `Modal` - Confirmation dialog

## Accessibility Features

✅ **Keyboard Navigation**
- All buttons are keyboard accessible
- Modal can be closed via Cancel/Back
- Focus stays within modal while open

✅ **Screen Reader Support**
- Semantic HTML structure
- Clear button text (no icon-only actions)

✅ **Visual Indicators**
- Color-coded severity (red for danger)
- Icons reinforce message meaning
- Clear step separation

✅ **Mobile Responsive**
- Modal scales properly on small screens
- Touch-friendly button sizes
- Readable text at all viewport sizes

## User Experience Decisions

### Why In-App Reauthentication?
- Prevents accidental deletion
- Adds security layer (verifies identity in-session)
- Avoids dependency on email delivery
- Industry standard for sensitive actions

### Why Immediate Deletion?
- No grace period or cancellation window (per spec)
- Simpler implementation
- Clear user expectations
- Meets "immediate deletion" requirement
