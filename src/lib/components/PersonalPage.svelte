<script>
  import { onMount } from "svelte";
  import { onAuthStateChanged } from "firebase/auth";
  import { auth } from "$lib/helpers/firebase";
  import { handlePrivateRoute } from "$lib/helpers/routing";
  import { isLoggedIn } from "$lib/stores/user";

  let authChecked = false;

  onMount(() => {
    if (!auth) {
      authChecked = true;
      handlePrivateRoute();
      return undefined;
    }

    return onAuthStateChanged(auth, (user) => {
      authChecked = true;
      if (!user?.emailVerified) handlePrivateRoute();
    });
  });
</script>

<div>
  {#if authChecked && $isLoggedIn}
    <slot />
  {/if}
</div>
