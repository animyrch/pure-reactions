<script>
    import { onMount } from 'svelte';
    import { auth } from '$lib/helpers/firebase';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { TOASTS } from '$lib/constants/toasts';
    import { showToast } from '$lib/stores/toast';
    import { GradientButton, Card } from 'flowbite-svelte';
    import { goToRoute } from "$lib/helpers/routing";

    export let data;

    let user;
    let newName = '';
    let newEmail = '';
  
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
  
  </script>
  
  <div class="m-auto">
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card class="m-auto" href="/account/edit">
        <p>Edit Personal Information</p>
      </Card>
      <Card class="m-auto" href="/my-reactions">
        See Your Pure Reactions
      </Card>
      <Card class="m-auto" href="/" on:click={() => data.handleUserAction('logout')}>
        Logout
      </Card>
    </div>
  </div>
  