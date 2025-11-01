<script>
	/** @type {import('./$types').PageData} */
  import { toasts } from '$lib/stores/toast';
  import Toast from '$lib/components/Toasts/Toast.svelte';
  import { onNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';
  import TopNavigation from '$lib/components/Navigation/TopNavigation.svelte';
  import SpeedDialNavigation from '$lib/components/Navigation/SpeedDialNavigation.svelte';
  import { prefersReducedMotion } from '$lib/stores/motion';

  $: currentToasts = $toasts; // Access the store value

  let reduceMotion = false;

  onMount(() => {
    const unsubscribe = prefersReducedMotion.subscribe((value) => {
      reduceMotion = value;
      document.documentElement.classList.toggle('motion-reduce', value);
    });

    return () => {
      unsubscribe?.();
    };
  });

  onNavigate((navigation) => {
    if (reduceMotion || !document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<header class="w-full px-4">
  <TopNavigation />
</header>

{#each currentToasts as toast (toast.id)}
  <Toast {toast} key={toast.id} />
{/each}

<div class="app-container w-full px-4 pt-[5rem] sm:pt-[5.5rem]">
  {#key $page.url.pathname}
    <div transition:fade={{ duration: reduceMotion ? 0 : 220, delay: reduceMotion ? 0 : 40 }}>
      <slot></slot>
    </div>
  {/key}
</div>

<SpeedDialNavigation />

<footer class="mb-12">
  <p>&copy; 2023 Pure Reactions</p>
</footer>

<style>
  @import '../app.pcss';
  .app-container {
    padding-bottom: 2rem;
    min-height: 800px;
  }
</style>