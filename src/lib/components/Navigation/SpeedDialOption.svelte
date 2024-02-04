<script>
    import { SpeedDialButton } from 'flowbite-svelte';

    export let name;
    export let href;
</script>

<SpeedDialButton
    btnDefaultClass="w-[65px]"
    {href}
    {name}
>
    <slot></slot>
</SpeedDialButton>