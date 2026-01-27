<script>
  export let isVerifiedCreator = false;
</script>

{#if isVerifiedCreator}
  <span
    class="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-200"
    aria-label="Verified creator"
  >
    <svg
      class="h-3 w-3"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.5 11.2L3.8 8.5L2.8 9.5L6.5 13.2L13.2 6.5L12.2 5.5L6.5 11.2Z"
        fill="currentColor"
      />
    </svg>
    Verified
  </span>
{:else}
  <span
    class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-text-muted"
    aria-label="Third-party sync"
  >
    Third-party
  </span>
{/if}
