<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import {
        getPlaylist,
        getReactionsByIds,
        updateFirebaseDocument,
    } from "$lib/helpers/firebase";
    import {
        extractYouTubeVideoId,
        downloadBasicVideoDetails,
    } from "$lib/helpers/youtube";
    import { showToast } from "$lib/stores/toast";
    import { TOASTS } from "$lib/constants/toasts";
    import {
        CheckCircleSolid,
        ExclamationCircleSolid,
        ArrowRightAltSolid,
        FilePenSolid,
    } from "flowbite-svelte-icons";
    import SubtleLoader from "$lib/components/design-system/SubtleLoader.svelte";

    let isLoading = true;
    let playlistId = "";
    let playlist = null;
    let reactions = [];
    let selectedReactionIds = new Set();
    let batchReactionInput = "";
    let isApplying = false;
    let isPublishingBatch = false;
    let publishingReactionIds = new Set();

    // Load data on mount
    onMount(async () => {
        playlistId = $page.url.searchParams.get("playlistDocumentId");
        if (!playlistId) {
            showToast("Missing playlist ID", TOASTS.ERROR);
            goto("/");
            return;
        }

        try {
            playlist = await getPlaylist(playlistId);
            if (!playlist || !playlist.reactionBinomeIds) {
                throw new Error("Invalid playlist data");
            }

            const reactionDocs = await getReactionsByIds(
                playlist.reactionBinomeIds,
            );
            reactions = reactionDocs.map((doc) => ({
                id: doc.id,
                ...doc.data,
                // Local state for UI
                isSelected: true, // Default to all selected
            }));

            // Initialize selection set
            reactions.forEach((r) => selectedReactionIds.add(r.id));
        } catch (error) {
            console.error("Failed to load batch config:", error);
            showToast("Failed to load playlist data", TOASTS.ERROR);
        } finally {
            isLoading = false;
        }
    });

    function toggleSelection(reactionId) {
        if (selectedReactionIds.has(reactionId)) {
            selectedReactionIds.delete(reactionId);
        } else {
            selectedReactionIds.add(reactionId);
        }
        selectedReactionIds = selectedReactionIds; // Trigger reactivity

        // precise UI sync
        reactions = reactions.map((r) =>
            r.id === reactionId
                ? { ...r, isSelected: selectedReactionIds.has(reactionId) }
                : r,
        );
    }

    function toggleAll() {
        if (selectedReactionIds.size === reactions.length) {
            selectedReactionIds.clear();
            reactions = reactions.map((r) => ({ ...r, isSelected: false }));
        } else {
            reactions.forEach((r) => selectedReactionIds.add(r.id));
            reactions = reactions.map((r) => ({ ...r, isSelected: true }));
        }
        selectedReactionIds = selectedReactionIds;
    }

    async function applyBatchReaction() {
        if (!batchReactionInput.trim()) {
            showToast("Please enter a valid Video ID or URL", TOASTS.WARNING);
            return;
        }

        if (selectedReactionIds.size === 0) {
            showToast("Please select at least one item", TOASTS.WARNING);
            return;
        }

        isApplying = true;
        try {
            const videoId = extractYouTubeVideoId(batchReactionInput);
            if (!videoId) throw new Error("Invalid YouTube ID");

            // Optional: Fetch details to ensure it exists and get title/author
            // This is good UX to verify the video before saving
            const details = await downloadBasicVideoDetails(videoId);

            if (!details || !details.videoTitle) {
                throw new Error(
                    "Could not fetch video details. Please check the ID.",
                );
            }

            const updates = {
                reactionVideoId: videoId,
                reactionVideoAuthor: details.videoAuthor || "",
                reactionVideoTitle: details.videoTitle || "",
                isPublished: false, // Reset published state maybe? Or keep as is. usually editing resets it.
            };

            const updateResults = await Promise.all(
                Array.from(selectedReactionIds).map((id) =>
                    updateFirebaseDocument(updates, id),
                ),
            );

            const allSucceeded = updateResults.every(Boolean);
            if (!allSucceeded) {
                throw new Error('One or more updates failed');
            }

            // Update local state
            reactions = reactions.map((r) => {
                if (selectedReactionIds.has(r.id)) {
                    return { ...r, ...updates };
                }
                return r;
            });

            showToast("Updated selected reactions", TOASTS.SUCCESS);
            batchReactionInput = ""; // Clear input after success
        } catch (error) {
            console.error("Batch update failed:", error);
            showToast(
                "Failed to update reactions. Check the ID.",
                TOASTS.ERROR,
            );
        } finally {
            isApplying = false;
        }
    }

    function handleFinish() {
        // Navigate to the first reaction in the playlist to start reviewing/refining
        if (reactions.length > 0) {
            goto(
                `/reaction/${reactions[0].id}?playlistId=${playlistId}`,
            );
        } else {
            goto("/");
        }
    }

    const canPublishReaction = (reaction) => Boolean(reaction?.reactionVideoId);

    async function setReactionPublishState(reactionId, nextIsPublished) {
        if (publishingReactionIds.has(reactionId)) return;
        const target = reactions.find((r) => r.id === reactionId);
        if (!target) return;

        if (nextIsPublished && !canPublishReaction(target)) {
            showToast(
                "Can't publish: missing reaction video",
                TOASTS.WARNING,
            );
            return;
        }

        publishingReactionIds.add(reactionId);
        publishingReactionIds = publishingReactionIds;

        try {
            const ok = await updateFirebaseDocument(
                { isPublished: nextIsPublished },
                reactionId,
            );
            if (!ok) {
                showToast(
                    "Failed to update publish status",
                    TOASTS.ERROR,
                );
                return;
            }
            reactions = reactions.map((r) =>
                r.id === reactionId ? { ...r, isPublished: nextIsPublished } : r,
            );
            showToast(
                nextIsPublished ? "Published" : "Unpublished",
                TOASTS.SUCCESS,
            );
        } finally {
            publishingReactionIds.delete(reactionId);
            publishingReactionIds = publishingReactionIds;
        }
    }

    async function applyPublishStateToSelected(nextIsPublished) {
        if (selectedReactionIds.size === 0) {
            showToast("Please select at least one item", TOASTS.WARNING);
            return;
        }

        isPublishingBatch = true;
        try {
            const selectedIds = Array.from(selectedReactionIds);

            let skipped = 0;
            const eligibleIds = selectedIds.filter((id) => {
                if (!nextIsPublished) return true;
                const reaction = reactions.find((r) => r.id === id);
                if (reaction && canPublishReaction(reaction)) return true;
                skipped += 1;
                return false;
            });

            const results = await Promise.all(
                eligibleIds.map((id) =>
                    updateFirebaseDocument({ isPublished: nextIsPublished }, id),
                ),
            );

            const succeededIds = eligibleIds.filter((_, index) => results[index]);
            const failedCount = eligibleIds.length - succeededIds.length;

            if (succeededIds.length) {
                const succeededSet = new Set(succeededIds);
                reactions = reactions.map((r) =>
                    succeededSet.has(r.id)
                        ? { ...r, isPublished: nextIsPublished }
                        : r,
                );
            }

            if (failedCount > 0) {
                showToast(
                    `Some updates failed (${failedCount})`,
                    TOASTS.ERROR,
                );
            } else {
                const suffix = skipped ? ` (skipped ${skipped} missing)` : "";
                showToast(
                    `${nextIsPublished ? "Published" : "Unpublished"} ${
                        succeededIds.length
                    }${suffix}`,
                    TOASTS.SUCCESS,
                );
            }
        } finally {
            isPublishingBatch = false;
        }
    }
</script>

<div class="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
    <div class="mx-auto max-w-5xl space-y-8">
        <!-- Header -->
        <header
            class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
            <div class="space-y-2">
                <p
                    class="text-xs font-bold uppercase tracking-[0.2em] text-blue-500"
                >
                    Workflow
                </p>
                <h1
                    class="text-3xl font-bold tracking-tight text-white sm:text-4xl"
                >
                    Batch Configuration
                </h1>
                <p class="text-slate-400">
                    Assign a reaction video to multiple playlist items at once.
                </p>
            </div>
            <button
                on:click={handleFinish}
                class="flex items-center gap-2 rounded-full bg-emerald-500/10 px-6 py-3 font-semibold text-emerald-400 transition hover:bg-emerald-500/20 active:scale-95"
            >
                <span>Done</span>
                <ArrowRightAltSolid class="h-4 w-4" />
            </button>
        </header>

        {#if isLoading}
            <div class="flex h-64 items-center justify-center">
                <SubtleLoader label="Loading playlist items..." />
            </div>
        {:else}
            <!-- Batch Controls -->
            <section
                class="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-sm"
            >
                <label
                    for="batch-input"
                    class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                    Apply Reaction Source
                </label>
                <div class="flex flex-col gap-4 sm:flex-row">
                    <input
                        id="batch-input"
                        type="text"
                        bind:value={batchReactionInput}
                        placeholder="Paste YouTube Link or ID (e.g. dQw4w9WgXcQ)"
                        class="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                        on:click={applyBatchReaction}
                        disabled={isApplying || selectedReactionIds.size === 0}
                        class="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
                    >
                        {#if isApplying}
                            <SubtleLoader size="sm" />
                        {:else}
                            <FilePenSolid class="h-4 w-4" />
                            <span
                                >Apply to {selectedReactionIds.size} Selected</span
                            >
                        {/if}
                    </button>
                </div>
                <p class="mt-3 text-xs text-slate-500">
                    This will update the reaction video for all selected items
                    below. Use this if you recorded one long video for the
                    entire playlist.
                </p>

                <div class="mt-5 flex flex-wrap gap-3">
                    <button
                        on:click={() => applyPublishStateToSelected(true)}
                        disabled={isApplying || isPublishingBatch || selectedReactionIds.size === 0}
                        class="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50 disabled:hover:bg-emerald-500/10"
                    >
                        {#if isPublishingBatch}
                            <SubtleLoader size="sm" />
                        {:else}
                            <span>Publish {selectedReactionIds.size} Selected</span>
                        {/if}
                    </button>
                    <button
                        on:click={() => applyPublishStateToSelected(false)}
                        disabled={isApplying || isPublishingBatch || selectedReactionIds.size === 0}
                        class="flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800"
                    >
                        {#if isPublishingBatch}
                            <SubtleLoader size="sm" />
                        {:else}
                            <span>Unpublish {selectedReactionIds.size} Selected</span>
                        {/if}
                    </button>
                </div>
            </section>

            <!-- Table -->
            <div
                class="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 shadow-xl"
            >
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-950/50 uppercase text-slate-500">
                            <tr>
                                <th class="w-12 px-6 py-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedReactionIds.size ===
                                            reactions.length &&
                                            reactions.length > 0}
                                        on:change={toggleAll}
                                        class="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-offset-slate-950"
                                    />
                                </th>
                                <th class="px-6 py-4 tracking-wider"
                                    >Original Video</th
                                >
                                <th class="px-6 py-4 tracking-wider"
                                    >Reaction Video</th
                                >
                                <th class="px-6 py-4 tracking-wider">Status</th>
                                <th class="px-6 py-4 tracking-wider">Publish</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800/50">
                            {#each reactions as reaction (reaction.id)}
                                <tr
                                    class={`transition hover:bg-slate-800/30 ${
                                        selectedReactionIds.has(reaction.id)
                                            ? "bg-blue-500/5"
                                            : ""
                                    }`}
                                >
                                    <td class="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedReactionIds.has(
                                                reaction.id,
                                            )}
                                            on:change={() =>
                                                toggleSelection(reaction.id)}
                                            class="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-offset-slate-950"
                                        />
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="font-medium text-slate-200">
                                            {reaction.originalVideoTitle ||
                                                "Untitled"}
                                        </div>
                                        <div class="text-xs text-slate-500">
                                            {reaction.originalVideoAuthor ||
                                                "Unknown Author"}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4">
                                        {#if reaction.reactionVideoId}
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span
                                                    class="font-mono text-emerald-400"
                                                >
                                                    {reaction.reactionVideoId}
                                                </span>
                                            </div>
                                            {#if reaction.reactionVideoTitle}
                                                <div
                                                    class="mt-1 line-clamp-1 text-xs text-slate-500"
                                                >
                                                    {reaction.reactionVideoTitle}
                                                </div>
                                            {/if}
                                        {:else}
                                            <span class="text-slate-600 italic"
                                                >Not set</span
                                            >
                                        {/if}
                                    </td>
                                    <td class="px-6 py-4">
                                        {#if reaction.reactionVideoId}
                                            <div
                                                class="flex items-center gap-1.5 text-emerald-400"
                                            >
                                                <CheckCircleSolid
                                                    class="h-4 w-4"
                                                />
                                                <span>Ready</span>
                                            </div>
                                        {:else}
                                            <div
                                                class="flex items-center gap-1.5 text-amber-500"
                                            >
                                                <ExclamationCircleSolid
                                                    class="h-4 w-4"
                                                />
                                                <span>Missing</span>
                                            </div>
                                        {/if}
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-3">
                                            {#if reaction.isPublished}
                                                <span
                                                    class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
                                                >
                                                    Published
                                                </span>
                                            {:else}
                                                <span
                                                    class="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300"
                                                >
                                                    Unpublished
                                                </span>
                                            {/if}

                                            {#if publishingReactionIds.has(reaction.id)}
                                                <SubtleLoader size="sm" />
                                            {:else if reaction.isPublished}
                                                <button
                                                    on:click={() =>
                                                        setReactionPublishState(
                                                            reaction.id,
                                                            false,
                                                        )}
                                                    class="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                                                >
                                                    Unpublish
                                                </button>
                                            {:else}
                                                <button
                                                    on:click={() =>
                                                        setReactionPublishState(
                                                            reaction.id,
                                                            true,
                                                        )}
                                                    disabled={!reaction.reactionVideoId}
                                                    class="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50 disabled:hover:bg-emerald-500/10"
                                                >
                                                    Publish
                                                </button>
                                            {/if}
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}
    </div>
</div>
