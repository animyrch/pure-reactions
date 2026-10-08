<script>
  export let direction = "back";
  export let seconds = 15;
</script>

<svg viewBox="0 0 24 24" class="h-5 w-5 sm:h-6 sm:w-6" fill="none" aria-hidden="true">
  <g
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    transform={direction === "forward" ? "translate(24 0) scale(-1 1)" : undefined}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </g>
  <text
    x="12"
    y="15.35"
    text-anchor="middle"
    fill="currentColor"
    stroke="none"
    font-size="7.25"
    font-weight="700"
    font-family="ui-sans-serif, system-ui, sans-serif"
  >{seconds}</text>
</svg>
