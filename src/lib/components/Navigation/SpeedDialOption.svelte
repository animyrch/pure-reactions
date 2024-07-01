<script>
    import { SpeedDialButton } from 'flowbite-svelte';

    export let name;
    export let href;
</script>

<SpeedDialButton
    btnDefaultClass="w-[65px] h-[45px] z-100"
    {href}
    {name}
>
    <slot></slot>
</SpeedDialButton>