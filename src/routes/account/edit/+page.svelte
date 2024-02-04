<script>
    import { Input, Button, Label } from 'flowbite-svelte';
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

<div class="flex flex-col gap-4">
    <div class="flex gap-4">
      <Label for="new-name-input" class="flex-none block mb-2 self-center">Your Display Name:</Label>
      <Input class="shrink" bind:value={newName} id="new-name-input" />
      <Button class="submit-button flex-none" on:click={updateDisplayName}>Update Display Name</Button>
    </div>
    <div class="flex gap-4">
      <Label for="new-email-input" class="flex-none block mb-2 self-center">Your Email:</Label>
      <Input type="email" class="shrink" bind:value={newEmail} id="new-email-input" />
      <Button class="submit-button flex-none" on:click={updateEmail}>Update Email</Button>
    </div>
    <div class="flex gap-4">
      <Label for="new-password-input" class="flex-none block mb-2 self-center">Your Password:</Label>
      <Input type="email" class="shrink" bind:value={newPassword} id="new-password-input" />
      <Button class="submit-button flex-none" on:click={updatePassword}>Update Password</Button>
    </div>
</div>