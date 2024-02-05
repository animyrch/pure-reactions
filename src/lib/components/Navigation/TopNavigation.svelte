<script>
    import { goToRoute } from "$lib/helpers/routing";
    import { GradientButton } from 'flowbite-svelte';
</script>

<nav class="bg-white border-gray-200 dark:bg-gray-900">
  <div class="flex flex-wrap items-center justify-between mx-auto py-4">
  <a href="/" class="flex items-center space-x-3 rtl:space-x-reverse">
    <enhanced:img src='$lib/public/pure-reactions.svg' class="h-8" alt="Pure Reactions" />
  </a>
  <div class="md:order-2 gap-4 items-center hidden md:block">
    <GradientButton
      on:click={() => goToRoute('/react')}
      color="pinkToOrange"
    >
      React
    </GradientButton>
  </div>
</nav>
