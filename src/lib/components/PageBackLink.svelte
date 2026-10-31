<script>
  import { afterNavigate } from "$app/navigation";
  import { ArrowLeftOutline } from "flowbite-svelte-icons";
  import { isLoggedIn } from "$lib/stores/user";

  /** Pathname this link belongs to, such as `/bookmark`. */
  export let path;
  export let fallback = "/account";

  let backHref = fallback;

  afterNavigate(({ from, to, type }) => {
    if (type === "popstate") return;

    const toPath = to?.url?.pathname || "";
    if (toPath !== path) return;

    const fromPath = from?.url?.pathname || "";
    if (!fromPath || fromPath === toPath) return;

    backHref = `${from.url.pathname}${from.url.search}${from.url.hash}`;
  });
</script>

{#if $isLoggedIn}
  <div class="mb-3">
    <a
      href={backHref}
      class="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeftOutline class="h-4 w-4" aria-hidden="true" />
      Back
    </a>
  </div>
{/if}
