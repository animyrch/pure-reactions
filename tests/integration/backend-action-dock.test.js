import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import BackendActionDock from '../../src/lib/components/Video/BackendActionDock.svelte';
import BackendScrubber from '../../src/lib/components/Video/BackendScrubber.svelte';

describe('backend fullscreen action dock scrubber', () => {
    it('renders the existing scrubber on its own row above the action grid', () => {
        const { body } = render(BackendActionDock, {
            props: {
                visible: true,
                scrubCurrentTime: 65,
                scrubDuration: 180,
                scrubSeekMin: 0,
                scrubSeekMax: 180,
                scrubDisabled: false,
                actions: [
                    {
                        id: 'start-video',
                        label: 'Start Video',
                        description: 'Kick off playback for everyone in the session.',
                        onClick: () => {},
                    },
                ],
            },
        });

        expect(body).toContain('data-testid="fullscreen-dock-scrubber"');
        expect(body).toContain('data-testid="backend-scrubber"');
        expect(body).toContain('aria-label="Seek original video"');
        expect(body).toContain('>1:05 / 3:00<');
        expect(body.indexOf('fullscreen-dock-scrubber')).toBeLessThan(
            body.indexOf('Start Video'),
        );
        expect(body.indexOf('Session Controls')).toBeLessThan(
            body.indexOf('fullscreen-dock-scrubber'),
        );
    });

    it('disables the dock scrubber when seeking is unavailable', () => {
        const { body } = render(BackendActionDock, {
            props: {
                visible: true,
                scrubCurrentTime: 0,
                scrubDuration: 0,
                scrubSeekMin: 0,
                scrubSeekMax: 0,
                scrubDisabled: true,
                actions: [],
            },
        });

        const input =
            body.match(
                /<input[^>]*aria-label="Seek original video"[^>]*>/,
            )?.[0] ?? '';
        expect(input).toMatch(/(?:^|\s)disabled(?:[=/\s>]|$)/);
    });
});

describe('backend scrubber', () => {
    it('formats the current time and duration for the workspace scrubber', () => {
        const { body } = render(BackendScrubber, {
            props: {
                currentTime: 12,
                duration: 90,
                seekMin: 0,
                seekMax: 90,
                disabled: false,
            },
        });

        expect(body).toContain('data-testid="backend-scrubber"');
        expect(body).toContain('>0:12 / 1:30<');
        expect(body).toContain('Scrub');
    });
});
