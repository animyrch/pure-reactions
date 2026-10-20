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
    import GenericInput from '$lib/components/GenericInput.svelte';
    import { handlePrivateRoute } from '$lib/helpers/routing';

    let user;
    let newName;
    let newEmail;
    let newPassword;
    let twitchChannel = '';
    let twitchChannelReady = false;

    onMount(async () => {
      // Ensure the user is signed in
      user = auth.currentUser;
      if (!user) {
        handlePrivateRoute();
        return;
      }
  
      // Fetch user details
      newName = user?.displayName || '';
      newEmail = user?.email || '';
      const extra = await getUserExtraData(user.uid);
      twitchChannel = typeof extra?.twitchChannel === 'string' ? extra.twitchChannel : '';
      twitchChannelReady = true;
    });
  
    const updateDisplayName = async () => {
      await updateDisplayNameHelper(user, newName);
      await updateReactorDisplayNameForUser({ userId: user?.uid, displayName: newName });
      showToast('Profile updated successfully', TOASTS.SUCCESS);
    //   location.reload();
    };

    const performSensitiveOperation = async (operation) => {
        try {
            // Reauthenticate the user before performing the sensitive operation
            await reauthenticateUserHelper(user);

            // Perform the sensitive operation (e.g., update email or password)
            // Your code for the sensitive operation goes here
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
      await performSensitiveOperation(setNewEmail);
    };

    const updatePassword = async () => {
      await performSensitiveOperation(setNewPassword);
    };

    const updateTwitchChannel = async () => {
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
      }
    };
</script>

<div class="flex flex-col gap-8">
  <GenericInput
    bind:value={newName}
    inputLabel="Your Display Name:"
    validateAction={updateDisplayName}
    validateCallToAction="Update Display Name"
    inputId="new-name-input"
  />
  <GenericInput
    bind:value={newEmail}
    inputLabel="Your Email:"
    validateAction={updateEmail}
    validateCallToAction="Update Email"
    inputId="new-email-input"
  />
  <GenericInput
    bind:value={newPassword}
    inputLabel="Your Password:"
    validateAction={updatePassword}
    validateCallToAction="Update Password"
    inputId="new-password-input"
  />
  {#if twitchChannelReady}
    <div id="twitch-channel" class="flex flex-col gap-2">
      <GenericInput
        bind:value={twitchChannel}
        inputLabel="Your Twitch channel:"
        validateAction={updateTwitchChannel}
        validateCallToAction="Update Twitch Channel"
        inputId="twitch-channel-input"
      />
      <p class="text-sm text-text-muted">
        Shared sessions open this channel when you copy a share link. Leave it blank to share without a stream. A channel name or a twitch.tv link both work.
      </p>
    </div>
  {/if}
</div>
