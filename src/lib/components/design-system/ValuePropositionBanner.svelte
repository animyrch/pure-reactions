<script>
    import { page } from "$app/stores";
</script>

<div class="value-banner mx-auto max-w-5xl px-4 py-8 md:py-12">
    <div
        class="rounded-lg border border-accent-primary/30 bg-gradient-to-r from-accent-primary/5 to-accent-secondary/5 p-6 md:p-8"
    >
        <h2 class="mb-3 text-2xl font-bold text-text-primary md:text-3xl">
            Watch and Record Synchronized Content. <span class="text-accent-primary"
                >No Limits.</span
            > No Claims.
        </h2>
        <p class="mb-4 text-text-secondary md:text-lg">
            Experience reactions, translations, voiceovers, and commentary
            perfectly synchronized with original videos. Two streams, perfect
            timing, zero copyright risk.
        </p>
        <div class="flex flex-wrap gap-4">
            <!-- <a
                href="/how-it-works"
                class="inline-flex items-center gap-2 rounded-lg border border-accent-primary px-5 py-2.5 font-medium text-accent-primary transition-colors hover:bg-accent-primary/10"
            >
                How It Works
                <span aria-hidden="true">→</span>
            </a> -->
            <a
                href="/react"
                class="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-5 py-2.5 font-medium text-background transition-colors hover:bg-accent-primary/90"
            >
                Create Synced Content
            </a>
        </div>
    </div>
</div>

<style>
    .value-banner {
        padding-top: calc(72px + 1rem); /* Account for fixed nav */
    }
</style>
