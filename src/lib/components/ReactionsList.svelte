<script>
    import ReactionsListElement from '$lib/components/ReactionsListElement.svelte';
    import PlaylistsListElement from "$lib/components/PlaylistsListElement.svelte";

    export let reactions = [];
    export let loading = false;
</script>
<div class="reactions-grid" role="list">
    {#if loading}
        {#each Array(6) as _, index}
            <div class="card-shell" role="listitem" aria-busy="true" aria-live="polite">
                <div class="skeleton" style={`--delay:${index * 60}ms`}>
                    <div class="skeleton-thumb" />
                    <div class="skeleton-lines">
                        <span class="line w-3/4" />
                        <span class="line w-1/2" />
                    </div>
                </div>
            </div>
        {/each}
    {:else}
        {#each reactions as reaction (reaction?.id)}
            <div class="card-shell" role="listitem">
                <ReactionsListElement {reaction} />
            </div>
        {/each}
    {/if}
</div>

<style>
    .reactions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1.5rem;
        padding-inline: 0.5rem;
    }

    .card-shell {
        position: relative;
        display: flex;
        flex-direction: column;
        transition: transform 320ms cubic-bezier(0.33, 1, 0.68, 1),
            box-shadow 320ms cubic-bezier(0.33, 1, 0.68, 1);
    }

    /* .card-shell:focus-within {
        transform: translateY(-2px);
        box-shadow: 0 16px 32px rgba(5, 8, 12, 0.28);
    } this breaks thumbnail context*/

    .skeleton {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-radius: 0.75rem;
        overflow: hidden;
        background: linear-gradient(135deg, rgba(20, 24, 32, 0.66), rgba(14, 16, 23, 0.88));
        border: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: 0 14px 30px rgba(5, 8, 12, 0.26);
        padding-bottom: 1rem;
        animation: fadeIn 360ms ease-out both;
        animation-delay: var(--delay, 0ms);
    }

    .skeleton-thumb {
        aspect-ratio: 16 / 9;
        background: linear-gradient(90deg, rgba(35, 41, 54, 0.9), rgba(45, 52, 66, 0.8));
        position: relative;
        overflow: hidden;
    }

    .skeleton-thumb::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%);
        animation: shimmer 1.6s infinite;
    }

    .skeleton-lines {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-inline: 1rem;
    }

    .line {
        display: block;
        height: 0.65rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        overflow: hidden;
        position: relative;
    }

    .line::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
        animation: shimmer 1.8s infinite;
    }

    @keyframes shimmer {
        from {
            transform: translateX(-100%);
        }
        to {
            transform: translateX(100%);
        }
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @media (min-width: 1200px) {
        .reactions-grid {
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        }
    }
</style>
