<script>
    import { onMount } from 'svelte';
    import {
        auth,
        updateDisplayNameHelper,
        updateEmailHelper,
        updatePasswordHelper,
        reauthenticateUserHelper
    } from '$lib/helpers/firebase';
    import { showToast } from '$lib/stores/toast';
    import { TOASTS } from '$lib/constants/toasts';
    import GenericInput from '../../../lib/components/GenericInput.svelte';

    let user;
    let newName;
    let newEmail;
    let newPassword;

    onMount(async () => {
      // Ensure the user is signed in
      user = auth.currentUser;
      if (!user) {
        handlePrivateRoute();
      }
  
      // Fetch user details
      newName = user?.displayName || '';
      newEmail = user?.email || '';
    });
  
    const updateDisplayName = async () => {
      await updateDisplayNameHelper(user, newName);
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
</div>