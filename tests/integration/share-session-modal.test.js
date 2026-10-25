import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ShareSessionModal from '../../src/lib/components/session/ShareSessionModal.svelte';

const baseProps = {
    open: true,
    shareUrl: 'https://example.test/shared/session-1',
    twitchChannelDraft: '',
    twitchChannelError: '',
    isSavingTwitchChannel: false,
    isCopyingShareUrl: false,
    viewerCount: 2,
    originalVideoTitle: 'Example original',
    onSaveChannel: () => {},
    onCopy: () => {},
};

describe('share session modal contrast', () => {
    it('uses dark-surface text tokens when no Twitch channel is set', () => {
        const { body } = render(ShareSessionModal, {
            props: {
                ...baseProps,
                savedTwitchChannel: '',
            },
        });

        expect(body).toContain('data-testid="share-session-modal"');
        expect(body).toContain('Share Your Reaction Session');
        expect(body).toContain('p-6');
        expect(body).toContain('sm:p-8');
        expect(body).toContain('pe-8');
        expect(body).toContain('text-text-primary');
        expect(body).toContain('text-text-muted');
        expect(body).toContain('bg-surface');
        expect(body).toContain('bg-background');
        expect(body).toContain('text-accent-primary');
        expect(body).toContain('bg-accent-primary');
        expect(body).toContain('text-background');
        expect(body).not.toContain('text-slate-200');
        expect(body).not.toContain('text-slate-400');
        expect(body).not.toContain('text-slate-800');
        expect(body).not.toContain('text-slate-950');
        expect(body).toContain('Twitch channel');
        expect(body).toContain('data-testid="share-copy"');
    });

    it('keeps the saved-channel note on readable dark-surface tokens', () => {
        const { body } = render(ShareSessionModal, {
            props: {
                ...baseProps,
                savedTwitchChannel: 'animy_tr',
            },
        });

        expect(body).toContain('data-testid="share-twitch-channel-note"');
        expect(body).toContain('twitch.tv/animy_tr');
        expect(body).toContain('text-text-secondary');
        expect(body).toContain('text-text-primary');
        expect(body).not.toContain('text-slate-800');
        expect(body).not.toContain('text-slate-950');
        expect(body).not.toContain('id="share-twitch-channel"');
    });
});
