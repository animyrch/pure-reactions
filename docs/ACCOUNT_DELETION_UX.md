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

### Step 2: Confirmation Modal
**Triggered by:** Clicking "Delete my account"

The modal presents:
- Warning icon (red circle with exclamation)
- Clear heading: "Delete your account permanently?"
- Comprehensive warning list
- Two action buttons

#### Modal Content
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
│  We will send a confirmation link to your       │
│  email. Click that link to complete the         │
│  deletion.                                      │
│                                                 │
│     [Cancel]  [Send confirmation email] <-Red   │
└─────────────────────────────────────────────────┘
```

**Copy Requirements (per spec):**
- ✅ "This action cannot be undone"
- ✅ "All your reactions will be permanently deleted"
- ✅ "Search results may take up to 5 business days to fully disappear"
- ✅ No dark patterns or guilt-based language

### Step 3: Email Sent Confirmation
**Triggered by:** Clicking "Send confirmation email"

User sees:
- Success toast notification
- Modal closes automatically
- Message: "A confirmation link has been sent to your email. Please check your inbox."

**Development Mode:**
- Additional info toast: "Development mode: Check console for confirmation link"
- Confirmation URL logged to browser console

**Rate Limiting:**
If user exceeds 3 requests in 1 hour:
- Error toast: "Too many deletion requests. Please try again later."
- Returns HTTP 429

### Step 4: Click Email Link
**URL:** `/account/delete/confirm?token={64-char-hex-token}`  
**Requirement:** Valid, unused, non-expired token

The confirmation page shows three possible states:

#### State 1: Processing (Initial)
```
┌─────────────────────────────────────────────────┐
│               🔄 (spinner)                      │
│                                                 │
│      Processing Account Deletion                │
│                                                 │
│  Please wait while we permanently delete        │
│  your account...                                │
└─────────────────────────────────────────────────┘
```

#### State 2: Success
```
┌─────────────────────────────────────────────────┐
│               ✅ (green checkmark)              │
│                                                 │
│            Account Deleted                      │
│                                                 │
│  Your account has been permanently deleted.     │
│  You will be redirected to the homepage         │
│  shortly.                                       │
│                                                 │
│           [Go to Homepage]                      │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- User is logged out automatically
- Redirects to homepage after 3 seconds
- Manual redirect button also available

#### State 3: Error
```
┌─────────────────────────────────────────────────┐
│               ❌ (red X icon)                   │
│                                                 │
│            Deletion Failed                      │
│                                                 │
│  {Error message explaining what went wrong}     │
│                                                 │
│  [Go to Homepage]  [Back to Account Settings]   │
└─────────────────────────────────────────────────┘
```

**Common Error Messages:**
- "Invalid confirmation link. No token provided."
- "Invalid or expired token"
- "This confirmation link has already been used"
- "This confirmation link has expired"
- "Failed to complete account deletion. Please try again or contact support."

## UI Components Used

### From Flowbite-Svelte
- `Card` - Account settings options
- `Button` - All action buttons
- `Modal` - Confirmation dialog
- `Spinner` - Loading state

### Custom Styling
- Cinematic Authentic design tokens
- Dark mode first approach
- Accessible contrast ratios (WCAG AA)
- Clear visual hierarchy

## Accessibility Features

✅ **Keyboard Navigation**
- All buttons are keyboard accessible
- Modal can be closed with Escape key
- Focus management in modal

✅ **Screen Reader Support**
- Semantic HTML structure
- ARIA labels where needed
- Clear button text (no icon-only buttons)

✅ **Visual Indicators**
- Color-coded severity (red for danger)
- Icons reinforce message meaning
- Loading states clearly indicated

✅ **Mobile Responsive**
- Modal scales properly on small screens
- Touch-friendly button sizes
- Readable text at all viewport sizes

## Copy Guidelines

### Tone
- Direct and clear (not euphemistic)
- Informative (lists what will happen)
- Honest about consequences
- No dark patterns or manipulation

### Required Warnings
Per spec, these messages MUST appear:
1. "This action cannot be undone"
2. "All your reactions will be permanently deleted"
3. "Search results may take up to 5 business days to fully disappear"

### Error Messages
- Explain what went wrong
- Provide actionable next steps
- Avoid technical jargon
- Include "contact support" for unrecoverable errors

## User Experience Decisions

### Why Email Confirmation?
- Prevents accidental deletion
- Provides time for user to reconsider
- Adds security layer (verifies email access)
- Industry standard pattern

### Why Immediate Deletion?
- No grace period or cancellation window (per spec)
- Simpler implementation
- Clear user expectations
- Meets "immediate deletion" requirement

### Why Auto-Redirect?
- Prevents confusion (account no longer exists)
- Smooth UX transition
- Clear completion signal
- 3-second delay allows reading success message

### Why Rate Limiting?
- Prevents abuse/automation
- Protects server resources
- Reasonable limit (3/hour) allows retries
- Security best practice

## Design Rationale

### Red as Danger Color
- Universal understanding of danger/warning
- High contrast against dark background
- Matches Flowbite design system
- Consistent with web conventions

### Comprehensive Warning List
- Meets transparency requirements
- No hidden consequences
- User makes informed decision
- Reduces support inquiries

### Two-Step Confirmation
- Industry standard (GitHub, Twitter, etc.)
- Balances security and usability
- Prevents accidental deletions
- Provides audit trail

## Testing the UI

### Visual Regression Tests
Not implemented, but recommended:
- Screenshot of Danger Zone section
- Screenshot of confirmation modal
- Screenshot of each confirmation page state

### Manual Testing Checklist
1. ✅ Danger Zone is visually distinct
2. ✅ All warning messages are present
3. ✅ Modal opens on button click
4. ✅ Modal can be cancelled
5. ✅ Success toast appears
6. ✅ Confirmation page shows loading state
7. ✅ Success state shows before redirect
8. ✅ Error states are clear and actionable
9. ✅ All buttons are clickable
10. ✅ Mobile layout is usable

### Accessibility Testing
- Run axe DevTools (should pass)
- Test keyboard-only navigation
- Test with screen reader (VoiceOver/NVDA)
- Verify color contrast ratios
- Check focus indicators

## Future UI Enhancements

### Possible Improvements
- [ ] Add countdown timer on confirmation page
- [ ] Show list of data to be deleted (with counts)
- [ ] Add "download my data" option before deletion
- [ ] Animated transitions between states
- [ ] Toast notification for email sent in production
- [ ] Confirmation email with branded design
- [ ] Re-authentication requirement (extra security)

### Not Recommended
- ❌ Adding friction (typing "DELETE" to confirm)
- ❌ Guilt-based messaging ("We'll miss you")
- ❌ Hidden deletion option
- ❌ Requiring customer support contact
- ❌ Multiple confirmation steps
