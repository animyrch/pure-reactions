<script>
    import { onMount } from 'svelte';
    import {
        auth,
        updateDisplayNameHelper,
        updateEmailHelper,
        updatePasswordHelper,
        reauthenticateUserHelper
    } from '$lib/helpers/firebase';

    let user;
    let newName = '';
    let newEmail = '';
    let newPassword = '';
  
    onMount(async () => {
      // Ensure the user is signed in
      user = auth.currentUser;
      if (!user) {
        // Redirect or handle unauthenticated access as needed
        console.warn('User not signed in. Redirecting to login page.');
        window.location.href = '/'; // Redirect to your login page
      }
  
      // Fetch user details
      newName = user.displayName || '';
      newEmail = user.email || '';
    });
  
    const updateDisplayName = async () => {
      await updateDisplayNameHelper(user, newName);
      console.log('Profile updated successfully');
      location.reload();
    };
  
    const setNewEmail = async () => {
      await updateEmailHelper(user, newEmail);
      console.log('Email updated successfully');
      location.reload();
    };
  
    const setNewPassword = async () => {
      await updatePasswordHelper(user, newPassword);
      console.log('Password updated successfully');
      location.reload();
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

    const updatePassword = async () => {
      await performSensitiveOperation(setNewPassword);
    };

    const updateEmail = async () => {
      await performSensitiveOperation(setNewEmail);
    };
  </script>
  
  <main>
    <h1>My Account</h1>
  
    <section>
      <h2>Update Profile</h2>
      <label>
        New Name:
        <input bind:value={newName} />
      </label>
      <button on:click={updateDisplayName}>Update Profile</button>
    </section>
  
    <section>
      <h2>Update Email</h2>
      <label>
        New Email:
        <input type="email" bind:value={newEmail} />
      </label>
      <button on:click={updateEmail}>Update Email</button>
    </section>

    <section>
      <h2>Update Password</h2>
      <label>
        New Password:
        <input type="password" bind:value={newPassword} />
      </label>
      <button on:click={updatePassword}>Update Password</button>
    </section>
  </main>
  