<script>
	/** @type {import('./$types').PageData} */
  import { toasts } from '$lib/stores/toast';
  import Toast from '$lib/components/Toasts/Toast.svelte';
  import { isMobileDevice } from '$lib/helpers/system';
  import MobileMenu from '$lib/components/Navigation/MobileMenu.svelte';
  import { onNavigate } from '$app/navigation';
  import TopNavigation from '$lib/components/Navigation/TopNavigation.svelte';

  $: currentToasts = $toasts; // Access the store value

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

<header class="w-full">
  <TopNavigation />
</header>

{#each currentToasts as toast (toast.id)}
  <Toast {toast} key={toast.id} />
{/each}

<div class="app-container">
  
  <slot></slot>

  {#if isMobileDevice()}
    <MobileMenu />
  {/if}
</div>

<footer class="mb-12">
  <p>&copy; 2023 Pure Reactions</p>
</footer>

<style>
  @import '../app.pcss';
  .app-container {
    padding-bottom: 2rem;
    min-height: 800px;
  }
  .account-status {
    padding: 10px;
    width: 100%;
    text-align: right;
  }
</style>