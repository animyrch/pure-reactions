<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/helpers/firebase';
  import { Button, Spinner } from 'flowbite-svelte';

  let status = 'processing'; // 'processing', 'success', 'error'
  let errorMessage = '';

  onMount(async () => {
    const token = $page.url.searchParams.get('token');

    if (!token) {
      status = 'error';
      errorMessage = 'Invalid confirmation link. No token provided.';
      return;
    }

    // Auto-confirm the deletion
    await confirmDeletion(token);
  });

  async function confirmDeletion(token) {
    try {
      const response = await fetch('/api/account/delete/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const result = await response.json();

      if (response.ok) {
        status = 'success';
        
        // Sign out the user
        if (auth.currentUser) {
          await auth.signOut();
        }

        // Redirect to homepage after 3 seconds
        setTimeout(() => {
          goto('/');
        }, 3000);
      } else {
        status = 'error';
        errorMessage = result.error || 'Failed to delete account';
      }
    } catch (error) {
      console.error('Error confirming deletion:', error);
      status = 'error';
      errorMessage = 'An unexpected error occurred. Please try again or contact support.';
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 bg-background">
  <div class="max-w-md w-full bg-surface rounded-lg shadow-lg p-8 text-center">
    {#if status === 'processing'}
      <Spinner size="12" class="mx-auto mb-4" />
      <h1 class="text-2xl font-bold text-text mb-4">Processing Account Deletion</h1>
      <p class="text-text-muted">
        Please wait while we permanently delete your account...
      </p>
    {:else if status === 'success'}
      <svg class="mx-auto mb-4 text-green-500 w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h1 class="text-2xl font-bold text-text mb-4">Account Deleted</h1>
      <p class="text-text-muted mb-6">
        Your account has been permanently deleted. You will be redirected to the homepage shortly.
      </p>
      <Button on:click={() => goto('/')}>Go to Homepage</Button>
    {:else if status === 'error'}
      <svg class="mx-auto mb-4 text-red-500 w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h1 class="text-2xl font-bold text-text mb-4">Deletion Failed</h1>
      <p class="text-text-muted mb-6">
        {errorMessage}
      </p>
      <div class="flex gap-4 justify-center">
        <Button color="alternative" on:click={() => goto('/')}>Go to Homepage</Button>
        <Button on:click={() => goto('/account')}>Back to Account Settings</Button>
      </div>
    {/if}
  </div>
</div>
