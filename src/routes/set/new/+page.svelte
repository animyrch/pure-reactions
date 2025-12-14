<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    import { currentUser } from '$lib/stores/user';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { createSetDocument } from '$lib/helpers/firebase';
    import { showToast } from '$lib/stores/toast';
    import { TOASTS } from '$lib/constants/toasts';

    export let data;

    let isSubmitting = false;
    let errorMessage = '';

    let setForm = {
        slug: '',
        title: '',
        description: '',
        items: [{ type: 'reaction', id: '', label: '' }]
    };

    const requireAuth = () => {
        const userId = data?.userId || get(currentUser)?.uid;
        if (!userId) {
            handlePrivateRoute();
            return null;
        }
        return userId;
    };

    onMount(() => {
        requireAuth();
    });

    const updateItem = (index, key, value) => {
        setForm = {
            ...setForm,
            items: setForm.items.map((item, i) => (i === index ? { ...item, [key]: value } : item))
        };
    };

    const addItem = () => {
        setForm = {
            ...setForm,
            items: [...setForm.items, { type: 'reaction', id: '', label: '' }]
        };
    };

    const removeItem = (index) => {
        setForm = {
            ...setForm,
            items: setForm.items.filter((_, i) => i !== index)
        };
    };

    const handleSubmit = async () => {
        errorMessage = '';
        const userId = requireAuth();
        if (!userId) return;

        const slug = setForm.slug.trim();
        if (!slug) {
            errorMessage = 'Slug is required.';
            return;
        }

        if (!setForm.title.trim()) {
            errorMessage = 'Title is required.';
            return;
        }

        const filteredItems = setForm.items
            .map((item) => ({
                type: item.type,
                id: item.id?.trim?.() || '',
                label: item.label?.trim?.() || ''
            }))
            .filter((item) => item.id);

        if (!filteredItems.length) {
            errorMessage = 'Add at least one reaction or playlist id.';
            return;
        }

        isSubmitting = true;
        try {
            await createSetDocument({
                slug,
                title: setForm.title,
                description: setForm.description,
                items: filteredItems,
                userId
            });
            showToast('Set saved', TOASTS.SUCCESS);
            await goto(`/set/${slug}`);
        } catch (error) {
            console.error('Failed to create set', error);
            errorMessage = error?.message || 'Could not save the set.';
        } finally {
            isSubmitting = false;
        }
    };
</script>

<svelte:head>
    <title>Create set • Pure Reactions</title>
</svelte:head>

<main class="set-new-page bg-background text-text-primary">
    <div class="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div class="mb-8 space-y-2">
            <p class="text-xs uppercase tracking-[0.35em] text-text-muted">Create set</p>
            <h1 class="text-3xl font-semibold md:text-4xl">New set</h1>
            <p class="text-sm text-text-muted">Sets are user-owned collections of reaction binomes or playlists. Anyone can view them; only you can create or overwrite yours.</p>
        </div>

        <div class="space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-elevated">
            <div class="grid gap-4 md:grid-cols-2">
                <label class="field">
                    <span>Slug</span>
                    <input
                        class="input"
                        placeholder="holiday-drop"
                        bind:value={setForm.slug}
                        autocomplete="off"
                    />
                    <p class="hint">Used in the URL: /set/&lt;slug&gt;. Must be unique.</p>
                </label>
                <label class="field">
                    <span>Title</span>
                    <input
                        class="input"
                        placeholder="Holiday reactions"
                        bind:value={setForm.title}
                        autocomplete="off"
                    />
                </label>
            </div>

            <label class="field">
                <span>Description</span>
                <textarea
                    class="input resize-none"
                    rows="3"
                    placeholder="Short description"
                    bind:value={setForm.description}
                ></textarea>
            </label>

            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <p class="text-sm font-semibold text-text-primary">Items</p>
                    <button class="btn" type="button" on:click={addItem}>Add item</button>
                </div>
                <div class="space-y-3">
                    {#each setForm.items as item, index}
                        <div class="item-row">
                            <select class="input" bind:value={item.type} on:change={(e) => updateItem(index, 'type', e.target.value)}>
                                <option value="reaction">Reaction</option>
                                <option value="playlist">Playlist</option>
                            </select>
                            <input
                                class="input"
                                placeholder={item.type === 'playlist' ? 'Playlist doc id' : 'Reaction binome id'}
                                value={item.id}
                                on:input={(e) => updateItem(index, 'id', e.target.value)}
                            />
                            <input
                                class="input"
                                placeholder="Optional label"
                                value={item.label}
                                on:input={(e) => updateItem(index, 'label', e.target.value)}
                            />
                            {#if setForm.items.length > 1}
                                <button class="btn danger" type="button" on:click={() => removeItem(index)}>Remove</button>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>

            {#if errorMessage}
                <p class="text-sm text-warning">{errorMessage}</p>
            {/if}

            <div class="flex justify-end">
                <button class="btn primary" type="button" on:click={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : 'Save set'}
                </button>
            </div>
        </div>
    </div>
</main>

<style>
    .set-new-page {
        min-height: 100vh;
        background: radial-gradient(circle at 15% 20%, rgba(88, 112, 193, 0.08), transparent 35%),
            radial-gradient(circle at 80% 10%, rgba(117, 66, 223, 0.08), transparent 30%),
            radial-gradient(circle at 40% 70%, rgba(67, 217, 173, 0.06), transparent 32%),
            #0b1018;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.95rem;
        color: #d6dbe5;
    }
    .input {
        width: 100%;
        border-radius: 0.75rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        padding: 0.8rem 1rem;
        color: #f7f9fc;
        outline: none;
        transition: border-color 160ms ease, box-shadow 160ms ease;
    }
    .input:focus {
        border-color: rgba(255, 255, 255, 0.18);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
    }
    .hint {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.6);
    }
    .item-row {
        display: grid;
        grid-template-columns: 1.1fr 2fr 1.5fr auto;
        gap: 0.5rem;
        align-items: center;
    }
    .btn {
        padding: 0.65rem 1rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #e7ecf5;
        font-weight: 600;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 160ms ease, background 160ms ease;
    }
    .btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(5, 8, 12, 0.25);
    }
    .btn.primary {
        background: linear-gradient(135deg, #7c3aed, #ec4899);
        border-color: rgba(255, 255, 255, 0.14);
    }
    .btn.danger {
        background: rgba(255, 99, 132, 0.1);
        border-color: rgba(255, 99, 132, 0.3);
        color: #ffc1cf;
    }
    @media (max-width: 800px) {
        .item-row {
            grid-template-columns: 1fr;
        }
    }
</style>
