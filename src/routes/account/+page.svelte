<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import {
      EmailAuthProvider,
      GoogleAuthProvider,
      reauthenticateWithCredential,
      reauthenticateWithPopup
    } from 'firebase/auth';
    import { auth } from '$lib/helpers/firebase';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { Button, Modal } from 'flowbite-svelte';
    import { showToast } from '$lib/stores/toast';
    import { TOASTS } from '$lib/constants/toasts';

    export let data;

    let user;
    let showDeleteModal = false;
    let isDeleting = false;
    let deleteStep = 'confirm';
    let deletePassword = '';
    let deleteError = '';

    const providerLabels = {
      password: 'Email and password',
      'google.com': 'Google'
    };

    const getPrimaryProviderId = (currentUser) => {
      if (!currentUser?.providerData?.length) {
        return 'password';
      }

      const passwordProvider = currentUser.providerData.find(
        provider => provider.providerId === 'password'
      );

      return passwordProvider ? 'password' : currentUser.providerData[0].providerId;
    };

    $: providerId = getPrimaryProviderId(user);
    $: providerLabel = providerLabels[providerId] || 'your sign-in provider';
    $: isPasswordProvider = providerId === 'password';
    $: isGoogleProvider = providerId === 'google.com';

    const resetDeleteState = () => {
      deleteStep = 'confirm';
      deletePassword = '';
      deleteError = '';
      isDeleting = false;
    };

    const openDeleteModal = () => {
      resetDeleteState();
      showDeleteModal = true;
    };

    const closeDeleteModal = () => {
      showDeleteModal = false;
      resetDeleteState();
    };

    const goToReauthStep = () => {
      deleteStep = 'reauth';
      deleteError = '';
    };

    const goToConfirmStep = () => {
      deleteStep = 'confirm';
      deletePassword = '';
      deleteError = '';
    };

    const getReauthErrorMessage = (error) => {
      const code = error?.code;

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        return 'Incorrect password. Please try again.';
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return 'Reauthentication was canceled.';
      }
      if (code === 'auth/popup-blocked') {
        return 'Popup was blocked. Please allow popups and try again.';
      }
      if (code === 'auth/network-request-failed') {
        return 'Network error. Please try again.';
      }

      return error?.message || 'Failed to reauthenticate. Please try again.';
    };

    const deleteAccount = async () => {
      deleteError = '';
      isDeleting = true;

      try {
        if (!auth.currentUser) {
          showToast('You must be logged in to delete your account', TOASTS.ERROR);
          return;
        }

        const currentUser = auth.currentUser;
        const currentProviderId = getPrimaryProviderId(currentUser);

        if (currentProviderId === 'password') {
          if (!deletePassword) {
            deleteError = 'Please enter your password.';
            return;
          }

          const email = currentUser.email;
          if (!email) {
            deleteError = 'Email address is unavailable. Please contact support.';
            return;
          }

          const credential = EmailAuthProvider.credential(email, deletePassword);
          await reauthenticateWithCredential(currentUser, credential);
        } else if (currentProviderId === 'google.com') {
          const provider = new GoogleAuthProvider();
          await reauthenticateWithPopup(currentUser, provider);
        } else {
          deleteError = 'This sign-in method is not supported for deletion yet.';
          return;
        }

        const idToken = await currentUser.getIdToken(true);
        const response = await fetch('/api/account/delete', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });

        const result = await response.json();

        if (!response.ok) {
          deleteError = result.error || 'Failed to delete account. Please try again.';
          return;
        }

        showToast(result.message || 'Your account has been permanently deleted.', TOASTS.SUCCESS, 10000);
        await auth.signOut();
        closeDeleteModal();
        goto('/');
      } catch (error) {
        console.error('Error deleting account:', error);
        if (error?.code?.startsWith?.('auth/')) {
          deleteError = getReauthErrorMessage(error);
        } else {
          deleteError = 'An unexpected error occurred. Please try again.';
        }
      } finally {
        isDeleting = false;
      }
    };

    onMount(async () => {
      // Ensure the user is signed in
      user = auth.currentUser;
      if (!user) {
        handlePrivateRoute();
      }
    });
  
  </script>
  
  <div class="m-auto max-w-5xl px-4">
    <h1 class="text-3xl font-bold mb-8 text-text">Account Settings</h1>

    <div class="divide-y divide-gray-700/40">
      <section class="py-6">
        <p class="text-xs font-semibold tracking-[0.2em] uppercase text-text-muted mb-4">
          Account
        </p>
        <div class="grid gap-3 md:grid-cols-2">
          <Button
            href="/account/edit"
            color="alternative"
            class="w-full h-12 rounded-lg justify-start text-left border border-gray-500 bg-surface text-text font-semibold text-sm tracking-wide hover:bg-surface-dark hover:border-gray-300"
          >
            <span>Edit Personal Information</span>
          </Button>
        </div>
      </section>

      <section class="py-6">
        <p class="text-xs font-semibold tracking-[0.2em] uppercase text-text-muted mb-4">
          Activity
        </p>
        <div class="grid gap-3 md:grid-cols-2">
          <Button
            href="/my-reactions"
            color="alternative"
            class="w-full h-12 rounded-lg justify-start text-left border border-gray-500 bg-surface text-text font-semibold text-sm tracking-wide hover:bg-surface-dark hover:border-gray-300"
          >
            <span>See Your Pure Reactions</span>
          </Button>
          <Button
            href="/bookmark"
            color="alternative"
            class="w-full h-12 rounded-lg justify-start text-left border border-gray-500 bg-surface text-text font-semibold text-sm tracking-wide hover:bg-surface-dark hover:border-gray-300"
          >
            <span>See Your Bookmarks</span>
          </Button>
        </div>
      </section>

      <section class="py-6">
        <p class="text-xs font-semibold tracking-[0.2em] uppercase text-text-muted mb-4">
          Security
        </p>
        <div class="grid gap-3 md:grid-cols-2">
          <Button
            color="alternative"
            on:click={() => data.handleUserAction('logout')}
            class="w-full h-12 rounded-lg justify-start text-left border border-gray-600 bg-transparent font-medium text-sm text-text-muted tracking-wide hover:bg-surface-dark hover:border-gray-400"
          >
            <span>Logout</span>
          </Button>
        </div>
      </section>

      <section class="py-6">
        <p class="text-xs font-semibold tracking-[0.2em] uppercase text-text-muted mb-4">
          Danger Zone
        </p>
        <div class="border border-red-600/60 rounded-lg p-5 bg-surface-dark">
          <h2 class="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            <span>Delete my account</span>
          </h2>
          <div class="space-y-3">
            <p class="text-sm text-text-muted">
              Deleting your account will permanently remove:
            </p>
            <ul class="list-disc list-inside text-sm text-text-muted space-y-1">
              <li>Your reactions</li>
              <li>Your bookmarks</li>
              <li>Your profile</li>
            </ul>
            <p class="text-sm text-text-muted font-medium">
              This action cannot be undone.
            </p>
            <Button
              color="red"
              on:click={openDeleteModal}
              class="w-full h-12 rounded-lg bg-red-600 hover:bg-red-700"
            >
              <span class="inline-flex items-center gap-2">
                <span aria-hidden="true">🗑</span>
                <span>Delete my account</span>
              </span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <Modal bind:open={showDeleteModal} size="md" autoclose={false}>
    {#if deleteStep === 'confirm'}
      <div class="text-center">
        <svg class="mx-auto mb-4 text-red-500 w-12 h-12" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 11V6m0 8h.01M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
        </svg>
        <h3 class="mb-4 text-lg font-normal text-text">
          Delete your account permanently?
        </h3>
        <div class="text-left mb-6 space-y-3 text-text-muted text-sm">
          <p class="font-semibold text-red-400">⚠️ This action cannot be undone</p>
          <p>Deleting your account will permanently remove:</p>
          <ul class="list-disc list-inside space-y-2">
            <li>Your reactions</li>
            <li>Your bookmarks</li>
            <li>Your profile</li>
          </ul>
          <p class="mt-4 font-medium">
            You will confirm your identity in the next step to complete deletion.
          </p>
        </div>
        <div class="flex justify-center gap-4">
          <Button color="alternative" on:click={closeDeleteModal}>
            Cancel
          </Button>
          <Button color="red" on:click={goToReauthStep}>
            Continue
          </Button>
        </div>
      </div>
    {:else if deleteStep === 'reauth'}
      <div class="text-center">
        <svg class="mx-auto mb-4 text-red-500 w-12 h-12" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 11V6m0 8h.01M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
        </svg>
        <h3 class="mb-2 text-lg font-normal text-text">
          Confirm your identity
        </h3>
        <p class="text-sm text-text-muted mb-6">
          Signed in with {providerLabel}. Reauthenticate to proceed.
        </p>
        {#if isPasswordProvider}
          <div class="text-left mb-6 space-y-2">
            <label class="block text-sm font-medium text-text" for="delete-password">
              Password
            </label>
            <input
              id="delete-password"
              type="password"
              class="w-full p-3 border border-gray-300 rounded bg-surface text-text"
              placeholder="Enter your password"
              bind:value={deletePassword}
            />
          </div>
        {:else if isGoogleProvider}
          <div class="mb-6">
            <p class="text-sm text-text-muted">
              Continue with Google to confirm deletion.
            </p>
          </div>
        {:else}
          <div class="mb-6">
            <p class="text-sm text-text-muted">
              This sign-in method is not supported for account deletion yet.
            </p>
          </div>
        {/if}
        {#if deleteError}
          <p class="text-sm text-red-400 mb-4">{deleteError}</p>
        {/if}
        <div class="flex justify-center gap-4">
          <Button color="alternative" on:click={goToConfirmStep} disabled={isDeleting}>
            Back
          </Button>
          <Button
            color="red"
            on:click={deleteAccount}
            disabled={isDeleting || (isPasswordProvider && !deletePassword) || (!isPasswordProvider && !isGoogleProvider)}
          >
            {#if isDeleting}
              Processing...
            {:else if isGoogleProvider}
              Continue with Google
            {:else}
              Delete account
            {/if}
          </Button>
        </div>
      </div>
    {/if}
  </Modal>
  
