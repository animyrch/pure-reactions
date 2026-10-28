<script>
  /** @type {import('./$types').PageData} */
  import "../app.pcss";
  import { toasts } from "$lib/stores/toast";
  import Toast from "$lib/components/Toasts/Toast.svelte";
  import { onNavigate } from "$app/navigation";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import TopNavigation from "$lib/components/Navigation/TopNavigation.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import { prefersReducedMotion } from "$lib/stores/motion";
  import GoogleAnalytics from "$lib/components/Analytics/GoogleAnalytics.svelte";
  import AgeConfirmation from "$lib/components/AgeConfirmation.svelte";
  import ArticleHeadingAnchors from "$lib/components/ArticleHeadingAnchors.svelte";

  $: currentToasts = $toasts; // Access the store value

  let reduceMotion = false;
  const momentReactionPlaybackPathPattern = /^\/moments\/[^/]+\/reaction\/[^/]+$/;

  $: isMomentReactionPlaybackRoute = momentReactionPlaybackPathPattern.test(
    $page.url.pathname || "",
  );
  $: hideFooter = isMomentReactionPlaybackRoute;

  onMount(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
        console.error('Service worker registration failed:', err);
      });
    }

    const unsubscribe = prefersReducedMotion.subscribe((value) => {
      reduceMotion = value;
      document.documentElement.classList.toggle("motion-reduce", value);
    });

    return () => {
      unsubscribe?.();
    };
  });

  onNavigate((navigation) => {
    if (reduceMotion || !document.startViewTransition) return;

    // Skip view transitions for reaction routes to prevent DOM instability during YouTube player initialization
    const toPath = navigation.to?.url?.pathname ?? '';
    if (
      toPath.startsWith('/reaction/') ||
      momentReactionPlaybackPathPattern.test(toPath)
    ) {
      return;
    }

    // Skip view transitions for same-pathname navigations (e.g. search query param updates)
    // to prevent focus loss caused by startViewTransition capturing/replacing the DOM
    const fromPath = navigation.from?.url?.pathname ?? '';
    if (toPath === fromPath) {
      return;
    }

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<GoogleAnalytics />
<AgeConfirmation />

<header class="w-full safe-padding-x">
  <TopNavigation />
</header>

{#each currentToasts as toast (toast.id)}
  <Toast {toast} key={toast.id} />
{/each}

<div class="app-container w-full safe-padding-x safe-padding-top">
  {#key $page.url.pathname}
    <div
      transition:fade={{
        duration: reduceMotion ? 0 : 220,
        delay: reduceMotion ? 0 : 40,
      }}
    >
      <slot></slot>
      <ArticleHeadingAnchors />
    </div>
  {/key}
</div>

{#if !hideFooter}
  <Footer />
{/if}

<style>
  .app-container {
    padding-bottom: 2rem;
    min-height: 800px;
  }
</style>
