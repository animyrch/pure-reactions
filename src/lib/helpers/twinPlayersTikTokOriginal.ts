import { getTikTokEmbedUrl } from '$lib/helpers/platform';

const TIKTOK_ORIGIN = 'https://www.tiktok.com';

type TikTokOriginalStateChangeEvent = {
  data: number;
  target: any;
};

type CreateTikTokOriginalPlayerAdapterOptions = {
  containerId?: string;
  markPlayerReady: () => void;
  onStateChange: (event: TikTokOriginalStateChangeEvent) => void;
};

export const restoreEmbeddedPlayerContainer = (containerId: string) => {
  const container = document.getElementById(containerId);
  if (container && container.tagName === 'IFRAME') {
    const parent = container.parentElement;
    if (parent) {
      const newDiv = document.createElement('div');
      newDiv.id = containerId;
      newDiv.className = container.className;
      parent.replaceChild(newDiv, container);
    }
  }
};

export function createTikTokOriginalPlayerAdapter({
  containerId = 'player-original',
  markPlayerReady,
  onStateChange
}: CreateTikTokOriginalPlayerAdapterOptions) {
  let iframe: HTMLIFrameElement | null = null;
  let unlisten: (() => void) | null = null;
  let playerState = -1;

  const destroyPlayer = () => {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
    if (iframe) {
      iframe.remove();
      iframe = null;
    }
    playerState = -1;
  };

  const createPlayer = (videoId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
      return null;
    }

    container.innerHTML = '';

    const nextIframe = document.createElement('iframe');
    nextIframe.src = getTikTokEmbedUrl(videoId);
    nextIframe.title = `TikTok video ${videoId}`;
    nextIframe.style.cssText = 'width:100%;height:100%;border:0;';
    nextIframe.allow = 'autoplay; encrypted-media; fullscreen';
    nextIframe.setAttribute('allowfullscreen', '');
    nextIframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    container.appendChild(nextIframe);
    iframe = nextIframe;
    playerState = -1;

    const postToTikTok = (type: string, value?: any) => {
      nextIframe.contentWindow?.postMessage(
        { type, value, 'x-tiktok-player': true },
        TIKTOK_ORIGIN,
      );
    };

    let mockPlayer: any;

    const forwardStateChange = (stateValue: number) => {
      if (!mockPlayer) {
        return;
      }

      onStateChange({
        data: stateValue,
        target: mockPlayer
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== TIKTOK_ORIGIN) {
        return;
      }

      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === 'onPlayerReady') {
        playerState = -1;
        markPlayerReady();
        postToTikTok('unMute');
        setTimeout(() => postToTikTok('unMute'), 250);
      }

      if (message.type === 'onStateChange') {
        if (message.value === 1) {
          playerState = 1;
          forwardStateChange(1);
        } else if (message.value === 2) {
          playerState = 2;
          forwardStateChange(2);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    unlisten = () => window.removeEventListener('message', handleMessage);

    mockPlayer = {
      getPlayerState: () => playerState,
      getCurrentTime: () => 0,
      getDuration: () => 0,
      isMuted: () => false,
      seekTo: () => {},
      setVolume: (value: number) => {
        if (value >= 100) {
          postToTikTok('unMute');
        } else {
          postToTikTok('mute');
        }
      },
      setPlaybackRate: () => {},
      playVideo: () => {
        postToTikTok('unMute');
        postToTikTok('play');
        playerState = 1;
      },
      pauseVideo: () => {
        postToTikTok('pause');
        playerState = 2;
      },
      stopVideo: () => {
        postToTikTok('pause');
        playerState = 2;
      },
      cueVideoById: () => {},
      loadVideoById: () => {},
      getIframe: () => nextIframe,
      destroy: () => {
        destroyPlayer();
      },
    };

    return mockPlayer;
  };

  return {
    createPlayer,
    destroyPlayer
  };
}