<script>
  /** @type {import('./$types').PageData} */
  import { toasts } from "$lib/stores/toast";
  import Toast from "$lib/components/Toasts/Toast.svelte";
  import { onNavigate } from "$app/navigation";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import TopNavigation from "$lib/components/Navigation/TopNavigation.svelte";
  import SpeedDialNavigation from "$lib/components/Navigation/SpeedDialNavigation.svelte";
  import { reactionDial } from "$lib/stores/reactionDial";
  import { prefersReducedMotion } from "$lib/stores/motion";
  import GoogleAnalytics from "$lib/components/Analytics/GoogleAnalytics.svelte";

  $: currentToasts = $toasts; // Access the store value

  let reduceMotion = false;
  let isMobileLandscapeTheater = false;

  $: isReactionRoute = $page.url.pathname?.startsWith("/reaction/");
  $: isPlaylistRoute = $page.url.pathname?.startsWith("/playlist/");
  $: isPlaybackRoute = isReactionRoute || isPlaylistRoute;
  $: hideSpeedDial =
    isPlaybackRoute && ($reactionDial.isFullscreen || isMobileLandscapeTheater);

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

    const mediaQuery =
      "(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px)";
    const media = window.matchMedia(mediaQuery);

    const updateMobileLandscapeTheater = () => {
      isMobileLandscapeTheater = Boolean(media?.matches);
    };

    updateMobileLandscapeTheater();

    if (typeof media?.addEventListener === "function") {
      media.addEventListener("change", updateMobileLandscapeTheater);
    } else if (typeof media?.addListener === "function") {
      media.addListener(updateMobileLandscapeTheater);
    }

    return () => {
      unsubscribe?.();

      if (typeof media?.removeEventListener === "function") {
        media.removeEventListener("change", updateMobileLandscapeTheater);
      } else if (typeof media?.removeListener === "function") {
        media.removeListener(updateMobileLandscapeTheater);
      }
    };
  });

  onNavigate((navigation) => {
    if (reduceMotion || !document.startViewTransition) return;

    // Skip view transitions for reaction routes to prevent DOM instability during YouTube player initialization
    const toPath = navigation.to?.url?.pathname ?? '';
    if (toPath.startsWith('/reaction/')) {
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
    </div>
  {/key}
</div>

{#if !hideSpeedDial}
  <SpeedDialNavigation />
{/if}

<footer class="safe-padding-bottom">
  <p>&copy; 2023 Pure Reactions</p>
</footer>

<style>
  @import "../app.pcss";
  .app-container {
    padding-bottom: 2rem;
    min-height: 800px;
  }
</style>
