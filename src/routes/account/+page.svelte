<script>
    import { onMount } from 'svelte';
    import { auth } from '$lib/helpers/firebase';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { Card, Button, Modal } from 'flowbite-svelte';
    import { showToast } from '$lib/stores/toast';
    import { TOASTS } from '$lib/constants/toasts';

    export let data;

    let user;
    let showDeleteModal = false;
    let isDeleting = false;
  
    onMount(async () => {
      // Ensure the user is signed in
      user = auth.currentUser;
      if (!user) {
        handlePrivateRoute();
      }
    });

    async function requestAccountDeletion() {
      isDeleting = true;
      try {
        const idToken = await auth.currentUser.getIdToken();
        
        const response = await fetch('/api/account/delete/request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();

        if (response.ok) {
          showToast(result.message, TOASTS.SUCCESS, 10000);
          showDeleteModal = false;
          
          // In development, show the confirmation URL
          if (result.confirmationUrl) {
            showToast('Development mode: Check console for confirmation link', TOASTS.INFO, 15000);
            console.log('Confirmation URL:', result.confirmationUrl);
          }
        } else {
          showToast(result.error || 'Failed to request account deletion', TOASTS.ERROR);
        }
      } catch (error) {
        console.error('Error requesting deletion:', error);
        showToast('An error occurred. Please try again.', TOASTS.ERROR);
      } finally {
        isDeleting = false;
      }
    }
  
  </script>
  
  <div class="m-auto max-w-5xl px-4">
    <h1 class="text-3xl font-bold mb-8 text-text">Account Settings</h1>
    
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-12">
      <Card class="m-auto" href="/account/edit">
        <p>Edit Personal Information</p>
      </Card>
      <Card class="m-auto" href="/my-reactions">
        See Your Pure Reactions
      </Card>
      <Card class="m-auto" href="/bookmark">
        See Your Bookmarks
      </Card>
      <Card class="m-auto" href="/" on:click={() => data.handleUserAction('logout')}>
        Logout
      </Card>
    </div>

    <!-- Danger Zone -->
    <div class="border-2 border-red-600 rounded-lg p-6 bg-surface-dark">
      <h2 class="text-2xl font-bold text-red-500 mb-4">Danger Zone</h2>
      <div class="space-y-4">
        <p class="text-text-muted">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button 
          color="red" 
          on:click={() => showDeleteModal = true}
          class="bg-red-600 hover:bg-red-700"
        >
          Delete my account
        </Button>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <Modal bind:open={showDeleteModal} size="md" autoclose={false}>
    <div class="text-center">
      <svg class="mx-auto mb-4 text-red-500 w-12 h-12" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 11V6m0 8h.01M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
      </svg>
      <h3 class="mb-5 text-lg font-normal text-text">
        Delete your account permanently?
      </h3>
      <div class="text-left mb-6 space-y-3 text-text-muted text-sm">
        <p class="font-semibold text-red-400">⚠️ This action cannot be undone</p>
        <ul class="list-disc list-inside space-y-2">
          <li>All your reactions will be permanently deleted</li>
          <li>Your bookmarks and follows will be removed</li>
          <li>Your account and profile will be deleted</li>
          <li>You will be immediately logged out</li>
          <li>Search results may take up to 5 business days to fully disappear</li>
        </ul>
        <p class="mt-4 font-medium">
          We will send a confirmation link to your email. Click that link to complete the deletion.
        </p>
      </div>
      <div class="flex justify-center gap-4">
        <Button color="alternative" on:click={() => showDeleteModal = false}>
          Cancel
        </Button>
        <Button 
          color="red" 
          on:click={requestAccountDeletion}
          disabled={isDeleting}
        >
          {isDeleting ? 'Processing...' : 'Send confirmation email'}
        </Button>
      </div>
    </div>
  </Modal>
  