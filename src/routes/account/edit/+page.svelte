<script>
    import { onMount } from 'svelte';
    import { onAuthStateChanged } from 'firebase/auth';
    import { env } from '$env/dynamic/public';
    import {
        auth,
        updateDisplayNameHelper,
        updateReactorDisplayNameForUser,
        updateEmailHelper,
        updatePasswordHelper,
        reauthenticateUserHelper,
        getUserExtraData,
        updateTwitchChannelForUser
    } from '$lib/helpers/firebase';
    import { showToast } from '$lib/stores/toast';
    import { TOASTS } from '$lib/constants/toasts';
    import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
    import { handlePrivateRoute } from '$lib/helpers/routing';

    let user;
    let accountReady = false;
    let newName = '';
    let newEmail = '';
    let newPassword = '';
    let pendingEmail = '';
    let twitchChannel = '';
    let twitchChannelReady = false;
    let savingField = '';

    const isUsingFirebaseEmulators = env.PUBLIC_FIREBASE_USE_EMULATORS === 'true';

    const pendingEmailStorageKey = (uid) => `pure-reactions:pending-email:${uid}`;

    const readPendingEmail = (uid) => {
      if (!uid || typeof sessionStorage === 'undefined') {
        return '';
      }
      try {
        return sessionStorage.getItem(pendingEmailStorageKey(uid)) || '';
      } catch (error) {
        return '';
      }
    };

    const writePendingEmail = (uid, email) => {
      if (!uid || typeof sessionStorage === 'undefined') {
        return;
      }
      try {
        if (!email) {
          sessionStorage.removeItem(pendingEmailStorageKey(uid));
          return;
        }
        sessionStorage.setItem(pendingEmailStorageKey(uid), email);
      } catch (error) {
        console.error('Could not remember the pending email change:', error);
      }
    };

    const normalizeEmail = (value) => (typeof value === 'string' ? value.trim() : '');

    const emailsMatch = (left, right) => normalizeEmail(left).toLowerCase() === normalizeEmail(right).toLowerCase();

    const isPlausibleEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

    const syncPendingEmail = (account) => {
      const stored = readPendingEmail(account?.uid);
      if (stored && emailsMatch(stored, account?.email)) {
        writePendingEmail(account.uid, '');
        pendingEmail = '';
        return;
      }
      pendingEmail = stored;
    };

    const emailChangeErrorMessage = (error) => {
      const code = error?.code || '';
      if (code === 'auth/user-cancelled') {
        return 'Enter your current password to send the confirmation.';
      }
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        return 'Incorrect password. Your sign-in email is unchanged.';
      }
      if (code === 'auth/invalid-email') {
        return 'Enter a valid email address.';
      }
      if (code === 'auth/email-already-in-use') {
        return 'That email already belongs to another account.';
      }
      if (code === 'auth/requires-recent-login') {
        return 'Enter your current password again to send the confirmation.';
      }
      if (code === 'auth/too-many-requests') {
        return 'Too many attempts. Wait a moment and try again.';
      }
      if (code === 'auth/network-request-failed') {
        return 'Network error. Your sign-in email is unchanged.';
      }
      return 'Could not send the confirmation email. Your sign-in email is unchanged.';
    };

    onMount(() => {
      let started = false;
      const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
        if (!nextUser) {
          user = null;
          accountReady = false;
          handlePrivateRoute();
          return;
        }

        if (started) {
          user = auth.currentUser || nextUser;
          syncPendingEmail(user);
          return;
        }

        started = true;
        try {
          await nextUser.reload();
        } catch (error) {
          console.error('Could not refresh the signed-in account:', error);
        }

        user = auth.currentUser || nextUser;
        newName = user?.displayName || '';
        syncPendingEmail(user);
        newEmail = pendingEmail || user?.email || '';
        accountReady = true;

        const extra = await getUserExtraData(user.uid);
        twitchChannel = typeof extra?.twitchChannel === 'string' ? extra.twitchChannel : '';
        twitchChannelReady = true;
      });

      return unsubscribe;
    });

    const updateDisplayName = async () => {
      savingField = 'name';
      try {
        await updateDisplayNameHelper(user, newName);
        await updateReactorDisplayNameForUser({ userId: user?.uid, displayName: newName });
        showToast('Profile updated successfully', TOASTS.SUCCESS);
      } finally {
        savingField = '';
      }
    };

    const performSensitiveOperation = async (operation) => {
        try {
            await reauthenticateUserHelper(user);
            await operation();
            location.reload();
        } catch (error) {
            console.error('Error performing sensitive operation:', error.message);
        }
    };

    const setNewPassword = async () => {
        if (newPassword) {
            await updatePasswordHelper(user, newPassword);
            showToast('Password updated successfully', TOASTS.SUCCESS);
        }
    };

    const updateEmail = async () => {
      const nextEmail = normalizeEmail(newEmail);
      const signedInEmail = normalizeEmail(user?.email);

      if (!isPlausibleEmail(nextEmail)) {
        showToast('Enter a valid email address.', TOASTS.WARNING);
        return;
      }
      if (emailsMatch(nextEmail, signedInEmail)) {
        showToast('That is already your sign-in email.', TOASTS.WARNING);
        return;
      }

      savingField = 'email';
      try {
        await reauthenticateUserHelper(
          user,
          'Enter your current password to email a confirmation link to the new address.'
        );
        const replacedPending = Boolean(pendingEmail) && !emailsMatch(pendingEmail, nextEmail);
        await updateEmailHelper(user, nextEmail);
        writePendingEmail(user?.uid, nextEmail);
        pendingEmail = nextEmail;
        newEmail = nextEmail;
        user = auth.currentUser || user;
        showToast(
          replacedPending
            ? `Confirmation sent to ${nextEmail}. An earlier link can still switch this account if it is opened.`
            : 'Confirmation email sent. Your sign-in email stays the same until you open that link.',
          TOASTS.SUCCESS,
          8000
        );
      } catch (error) {
        console.error('Error sending email confirmation:', error);
        showToast(emailChangeErrorMessage(error), TOASTS.WARNING);
      } finally {
        savingField = '';
      }
    };

    const cancelEmailChange = () => {
      const signedInEmail = normalizeEmail(user?.email);
      writePendingEmail(user?.uid, '');
      pendingEmail = '';
      newEmail = signedInEmail;
      showToast(
        `Email change canceled. You still sign in as ${signedInEmail}. Ignore the link already sent. Opening it can still switch this account.`,
        TOASTS.SUCCESS,
        8000
      );
    };

    $: emailUnchanged = emailsMatch(newEmail, user?.email);
    $: emailActionLabel = pendingEmail && emailsMatch(newEmail, pendingEmail)
      ? 'Resend confirmation'
      : 'Send confirmation';

    const updatePassword = async () => {
      savingField = 'password';
      try {
        await performSensitiveOperation(setNewPassword);
      } finally {
        savingField = '';
      }
    };

    const updateTwitchChannel = async () => {
      savingField = 'twitch';
      try {
        const saved = await updateTwitchChannelForUser({
          userId: user?.uid,
          twitchChannel,
        });
        twitchChannel = saved;
        showToast(
          saved ? 'Twitch channel updated' : 'Twitch channel cleared',
          TOASTS.SUCCESS
        );
      } catch (error) {
        const message = error?.message || '';
        showToast(
          message.includes('Twitch') ? message : 'Could not update your Twitch channel.',
          TOASTS.WARNING
        );
      } finally {
        savingField = '';
      }
    };

    const fieldClass = 'w-full rounded-xl border border-border-strong/40 bg-background px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 disabled:opacity-60';
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
  <a
    href="/account"
    class="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text-primary"
  >
    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    Account settings
  </a>

  <header class="mt-6 border-b border-border-subtle pb-6">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Personal information</p>
    <h1 class="mt-2 text-3xl font-semibold tracking-tight text-text-primary">Edit your account</h1>
    <p class="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
      The name on your reactions, the email and password you sign in with, and the Twitch channel shared sessions open.
    </p>
    {#if user?.email}
      <p class="mt-4 text-sm text-text-muted">Signed in as <span class="text-text-primary">{user.email}</span></p>
    {/if}
  </header>

  <div class="mt-8 space-y-6">
    <section class="rounded-2xl border border-border-subtle bg-surface/70 p-5 sm:p-6" aria-labelledby="profile-heading">
      <div class="mb-5">
        <h2 id="profile-heading" class="text-lg font-semibold text-text-primary">Profile</h2>
        <p class="mt-1 text-sm leading-6 text-text-secondary">This name is shown on the reactions you publish.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div class="space-y-2">
          <label for="new-name-input" class="text-sm font-medium text-text-primary">Display name</label>
          <input
            id="new-name-input"
            class={fieldClass}
            type="text"
            autocomplete="nickname"
            bind:value={newName}
            placeholder="How you appear on reactions"
          />
        </div>
        <CinematicButton
          type="button"
          size="sm"
          loading={savingField === 'name'}
          disabled={savingField !== '' && savingField !== 'name'}
          on:click={updateDisplayName}
        >
          Save name
        </CinematicButton>
      </div>
    </section>

    <section class="rounded-2xl border border-border-subtle bg-surface/70 p-5 sm:p-6" aria-labelledby="signin-heading">
      <div class="mb-5">
        <h2 id="signin-heading" class="text-lg font-semibold text-text-primary">Sign-in</h2>
        <p class="mt-1 text-sm leading-6 text-text-secondary">
          A new email is not saved until you open its confirmation link. You can correct that address or cancel before you open it. Password changes ask for your current password.
        </p>
      </div>
      <div class="space-y-5">
        <div class="space-y-3">
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div class="space-y-2">
              <label for="new-email-input" class="text-sm font-medium text-text-primary">New email</label>
              <input
                id="new-email-input"
                class={fieldClass}
                type="email"
                autocomplete="email"
                bind:value={newEmail}
                disabled={!accountReady || savingField === 'email'}
                aria-describedby="email-change-help"
                placeholder={accountReady ? 'name@example.com' : 'Loading your email…'}
              />
            </div>
            <CinematicButton
              type="button"
              size="sm"
              variant="secondary"
              loading={savingField === 'email'}
              disabled={!accountReady || emailUnchanged || (savingField !== '' && savingField !== 'email')}
              on:click={updateEmail}
            >
              {emailActionLabel}
            </CinematicButton>
          </div>
          <p id="email-change-help" class="text-sm leading-6 text-text-muted">
            Enter the address you want to switch to. We email a confirmation link there. You keep signing in with the current email until you open the newest link.
          </p>
          {#if pendingEmail}
            <div class="rounded-xl border border-accent-primary/40 bg-accent-primary/10 px-4 py-3 text-sm leading-6 text-text-primary" role="status">
              <p>
                Confirmation sent to <span class="font-medium">{pendingEmail}</span>.
                {#if isUsingFirebaseEmulators}
                  Open the link printed by the Firebase Auth emulator.
                {:else}
                  Open the link in that inbox.
                {/if}
                You still sign in as <span class="font-medium">{user?.email}</span> until you do.
                Change the address above to send the link somewhere else.
              </p>
              <div class="mt-3">
                <CinematicButton
                  type="button"
                  size="sm"
                  variant="muted"
                  disabled={savingField !== ''}
                  on:click={cancelEmailChange}
                >
                  Cancel change
                </CinematicButton>
              </div>
            </div>
          {/if}
        </div>

        <div class="border-t border-border-subtle"></div>

        <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div class="space-y-2">
            <label for="new-password-input" class="text-sm font-medium text-text-primary">Password</label>
            <input
              id="new-password-input"
              class={fieldClass}
              type="password"
              autocomplete="new-password"
              bind:value={newPassword}
              placeholder="New password"
            />
          </div>
          <CinematicButton
            type="button"
            size="sm"
            variant="secondary"
            loading={savingField === 'password'}
            disabled={!newPassword || (savingField !== '' && savingField !== 'password')}
            on:click={updatePassword}
          >
            Save password
          </CinematicButton>
        </div>
      </div>
    </section>

    <section id="twitch-channel" class="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface/70 p-5 sm:p-6" aria-labelledby="streaming-heading">
      <div class="mb-5">
        <h2 id="streaming-heading" class="text-lg font-semibold text-text-primary">Streaming</h2>
        <p class="mt-1 text-sm leading-6 text-text-secondary">
          Shared sessions open this channel when someone copies a share link. Leave it blank to share without a stream.
        </p>
      </div>
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div class="space-y-2">
          <label for="twitch-channel-input" class="text-sm font-medium text-text-primary">Twitch channel</label>
          <input
            id="twitch-channel-input"
            class={fieldClass}
            type="text"
            autocomplete="off"
            spellcheck="false"
            bind:value={twitchChannel}
            disabled={!twitchChannelReady}
            placeholder={twitchChannelReady ? 'channel or twitch.tv/channel' : 'Loading your channel…'}
          />
          <p class="text-sm text-text-muted">A channel name or a twitch.tv link both work.</p>
        </div>
        <CinematicButton
          type="button"
          size="sm"
          variant="secondary"
          loading={savingField === 'twitch'}
          disabled={!twitchChannelReady || (savingField !== '' && savingField !== 'twitch')}
          on:click={updateTwitchChannel}
        >
          Save channel
        </CinematicButton>
      </div>
    </section>
  </div>
</div>
