import {
    DEFAULT_FULLSCREEN_OVERLAY_CORNER,
    DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
    DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
    normalizeFullscreenOverlayCorner,
    normalizeFullscreenOverlayWidthPercent,
    normalizeFullscreenPrimaryVideo,
} from '$lib/helpers/twinPlayersReactionData.ts';

export const SESSION_LAYOUT_STORAGE_KEY = 'pure-reactions.sessionLayout';

export const defaultSessionLayout = () => ({
    fullscreenPrimaryVideo: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
    fullscreenOverlayWidthPercent: DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
    fullscreenOverlayCorner: DEFAULT_FULLSCREEN_OVERLAY_CORNER,
    fullscreenOverlayVisible: true,
    showCinematicBars: false,
});

export const normalizeSessionLayout = (value) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
        fullscreenPrimaryVideo: normalizeFullscreenPrimaryVideo(source.fullscreenPrimaryVideo),
        fullscreenOverlayWidthPercent: normalizeFullscreenOverlayWidthPercent(
            source.fullscreenOverlayWidthPercent,
        ),
        fullscreenOverlayCorner: normalizeFullscreenOverlayCorner(source.fullscreenOverlayCorner),
        fullscreenOverlayVisible: source.fullscreenOverlayVisible !== false,
        showCinematicBars: source.showCinematicBars === true,
    };
};

export const readSessionLayout = (storage) => {
    if (!storage || typeof storage.getItem !== 'function') {
        return defaultSessionLayout();
    }

    try {
        const raw = storage.getItem(SESSION_LAYOUT_STORAGE_KEY);
        if (!raw) {
            return defaultSessionLayout();
        }
        return normalizeSessionLayout(JSON.parse(raw));
    } catch {
        return defaultSessionLayout();
    }
};

export const writeSessionLayout = (storage, layout) => {
    if (!storage || typeof storage.setItem !== 'function') {
        return;
    }
    storage.setItem(SESSION_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeSessionLayout(layout)));
};
