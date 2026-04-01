type TwinPlayersDebugClickGate = (
  label: string,
  details?: Record<string, any>,
  includeStack?: boolean
) => void;

type TwinPlayersLog = (message: string, data?: any) => void;

type RunTwinPlayersBootstrapSequenceOptions = {
  seq: number;
  log: TwinPlayersLog;
  debugClickGate: TwinPlayersDebugClickGate;
  isCurrentInstance: () => boolean;
  getActiveInstanceId: () => string | null;
  waitForDomTick: () => Promise<void>;
  injectYoutubeIframeApiScript: () => void;
  waitForYoutubeIframeApiReady: () => Promise<void>;
  waitForTwinPlayerElements: () => Promise<boolean>;
  getPageSlug: () => string;
};

type TwinPlayersBootstrapSupersededPhase =
  | 'before-start'
  | 'after-tick'
  | 'after-yt-api-ready'
  | 'before-build-interface';

type TwinPlayersBootstrapSequenceResult =
  | { status: 'ready'; slug: string }
  | { status: 'elements-not-ready' }
  | { status: 'missing-slug' }
  | {
      status: 'superseded';
      phase: TwinPlayersBootstrapSupersededPhase;
      activeInstanceId: string | null;
    };

const supersededPhaseLabels: Record<TwinPlayersBootstrapSupersededPhase, string> = {
  'before-start': '[TwinPlayers] init aborted (instance superseded before start)',
  'after-tick': '[TwinPlayers] init aborted (instance superseded after tick)',
  'after-yt-api-ready': '[TwinPlayers] init aborted (instance superseded after YT API ready)',
  'before-build-interface': '[TwinPlayers] init aborted (instance superseded before buildInterface)'
};

const buildSupersededResult = (
  phase: TwinPlayersBootstrapSupersededPhase,
  seq: number,
  getActiveInstanceId: () => string | null,
  debugClickGate: TwinPlayersDebugClickGate
): TwinPlayersBootstrapSequenceResult => {
  const activeInstanceId = getActiveInstanceId();
  debugClickGate(supersededPhaseLabels[phase], {
    seq,
    globalActiveInstanceId: activeInstanceId
  });

  return {
    status: 'superseded',
    phase,
    activeInstanceId
  };
};

export async function runTwinPlayersBootstrapSequence({
  seq,
  log,
  debugClickGate,
  isCurrentInstance,
  getActiveInstanceId,
  waitForDomTick,
  injectYoutubeIframeApiScript,
  waitForYoutubeIframeApiReady,
  waitForTwinPlayerElements,
  getPageSlug
}: RunTwinPlayersBootstrapSequenceOptions): Promise<TwinPlayersBootstrapSequenceResult> {
  if (!isCurrentInstance()) {
    return buildSupersededResult('before-start', seq, getActiveInstanceId, debugClickGate);
  }

  await waitForDomTick();

  if (!isCurrentInstance()) {
    return buildSupersededResult('after-tick', seq, getActiveInstanceId, debugClickGate);
  }

  injectYoutubeIframeApiScript();
  log('waiting for YT API');
  await waitForYoutubeIframeApiReady();
  log('YT API ready');

  if (!isCurrentInstance()) {
    return buildSupersededResult('after-yt-api-ready', seq, getActiveInstanceId, debugClickGate);
  }

  log('waiting for DOM elements');
  const elementsReady = await waitForTwinPlayerElements();
  log('DOM elements ready result', { elementsReady });

  if (!elementsReady) {
    return { status: 'elements-not-ready' };
  }

  const slug = getPageSlug();
  if (!slug) {
    debugClickGate('[TwinPlayers] init aborted (missing slug)', { seq });
    return { status: 'missing-slug' };
  }

  if (!isCurrentInstance()) {
    return buildSupersededResult('before-build-interface', seq, getActiveInstanceId, debugClickGate);
  }

  return {
    status: 'ready',
    slug
  };
}