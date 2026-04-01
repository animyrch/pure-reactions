let globalActiveInstanceId: string | null = null;

declare global {
  interface Window {
    __twinPlayersInstanceCounter?: number;
  }
}

const createNextTwinPlayersInstanceId = () => {
  if (typeof window === 'undefined') {
    return 'ssr';
  }

  window.__twinPlayersInstanceCounter = (Number(window.__twinPlayersInstanceCounter) || 0) + 1;
  return String(window.__twinPlayersInstanceCounter);
};

export function createTwinPlayersInstanceController() {
  const instanceId = createNextTwinPlayersInstanceId();
  let destroyed = false;

  globalActiveInstanceId = instanceId;

  const getActiveInstanceId = () => globalActiveInstanceId;

  const isCurrent = () => globalActiveInstanceId === instanceId;

  const isDestroyed = () => destroyed;

  const isAlive = () => !destroyed && isCurrent();

  const markDestroyed = () => {
    destroyed = true;
    if (globalActiveInstanceId === instanceId) {
      globalActiveInstanceId = null;
    }
  };

  return {
    instanceId,
    getActiveInstanceId,
    isCurrent,
    isDestroyed,
    isAlive,
    markDestroyed,
  };
}