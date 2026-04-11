const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

let youtubeApiReadyPromise: Promise<void> | null = null;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const injectYoutubeIframeApiScript = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const existingScript = document.querySelector(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`);
  if (existingScript) {
    return;
  }

  const tag = document.createElement('script');
  tag.src = YOUTUBE_IFRAME_API_SRC;
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if (firstScriptTag?.parentNode) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.head.appendChild(tag);
  }
};

export const waitForYoutubeIframeApiReady = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve();
  }

  if (youtubeApiReadyPromise) {
    return youtubeApiReadyPromise;
  }

  youtubeApiReadyPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (window.onYouTubeIframeAPIReady === handleReady) {
        window.onYouTubeIframeAPIReady = previousCallback;
      }
    };

    const resolveReady = () => {
      cleanup();
      resolve();
    };

    const handleReady = () => {
      if (typeof previousCallback === 'function') {
        previousCallback();
      }
      resolveReady();
    };

    window.onYouTubeIframeAPIReady = handleReady;

    intervalId = setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') {
        resolveReady();
      }
    }, 50);

    timeoutId = setTimeout(() => {
      cleanup();
      youtubeApiReadyPromise = null;
      reject(new Error('YouTube Iframe API failed to load.'));
    }, 10000);
  });

  return youtubeApiReadyPromise;
};

export const waitForTwinPlayerElements = async (maxAttempts = 10, delayMs = 100): Promise<boolean> => {
  if (typeof document === 'undefined') {
    return false;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (document.getElementById('player-original') && document.getElementById('player-reaction')) {
      return true;
    }
    if (document.getElementById('player-original')) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return document.getElementById('player-original') !== null;
};