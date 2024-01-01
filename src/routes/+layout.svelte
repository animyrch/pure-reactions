<script>
	/** @type {import('./$types').PageData} */
  import { toasts } from '$lib/stores/toast';
  import Toast from '$lib/components/Toasts/Toast.svelte';
  import { isMobileDevice } from '$lib/helpers/system';
  import MobileMenu from '$lib/components/Navigation/MobileMenu.svelte';
  import { onNavigate } from '$app/navigation';
  $: currentToasts = $toasts; // Access the store value

  // let showModal = false;
  // let showSignInModal = false;


  onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<header>
  <h1><a href="/">Pure Reactions</a></h1>
</header>

{#each currentToasts as toast (toast.id)}
  <Toast {toast} key={toast.id} />
{/each}

<div class="app-container">  
  <nav>
    <a href="/">Home</a>
    <a class="hidden lg:inline" href="/backend">Create a reaction</a>
    <a href="/my-reactions">My reactions</a>
  </nav>
  
  <slot></slot>

  {#if isMobileDevice()}
    <MobileMenu />
  {/if}
</div>
<!-- 
<SignupModal {showModal} on:signup={(signupData => data.handleUserAction('signup', signupData))} />
<SignInModal {showSignInModal} on:signin={(signInData => data.handleUserAction('login', signInData))} /> -->

<footer class="mb-12">
  <p>&copy; 2023 Pure Reactions</p>
</footer>

<style>
  @import '../app.pcss';
  .app-container {
    padding-bottom: 2rem;
  }
  .account-status {
    padding: 10px;
    width: 100%;
    text-align: right;
  }
</style>