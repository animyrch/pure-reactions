<script>
    import { onMount } from 'svelte';
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
    let newName = '';
    let newEmail = '';
    let newPassword = '';
    let twitchChannel = '';
    let twitchChannelReady = false;
    let savingField = '';

    onMount(async () => {
      user = auth.currentUser;
      if (!user) {
        handlePrivateRoute();
        return;
      }

      newName = user?.displayName || '';
      newEmail = user?.email || '';
      const extra = await getUserExtraData(user.uid);
      twitchChannel = typeof extra?.twitchChannel === 'string' ? extra.twitchChannel : '';
      twitchChannelReady = true;
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

    const setNewEmail = async () => {
      await updateEmailHelper(user, newEmail);
      showToast('Email updated successfully', TOASTS.SUCCESS);
      location.reload();
    };

    const setNewPassword = async () => {
        if (newPassword) {
            await updatePasswordHelper(user, newPassword);
            showToast('Password updated successfully', TOASTS.SUCCESS);
        }
    };

    const updateEmail = async () => {
      savingField = 'email';
      try {
        await performSensitiveOperation(setNewEmail);
      } finally {
        savingField = '';
      }
    };

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
          Email and password changes ask for your current password before they are saved.
        </p>
      </div>
      <div class="space-y-5">
        <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div class="space-y-2">
            <label for="new-email-input" class="text-sm font-medium text-text-primary">Email</label>
            <input
              id="new-email-input"
              class={fieldClass}
              type="email"
              autocomplete="email"
              bind:value={newEmail}
            />
          </div>
          <CinematicButton
            type="button"
            size="sm"
            variant="secondary"
            loading={savingField === 'email'}
            disabled={savingField !== '' && savingField !== 'email'}
            on:click={updateEmail}
          >
            Save email
          </CinematicButton>
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
