export type ExperienceClockMode = 'reaction' | 'wall' | 'frozen';

export type ExperienceClockSnapshot = {
  mode: ExperienceClockMode;
  experienceTimeMs: number;
  nowMs: number;
  anchorExperienceTimeMs: number;
  anchorNowMs: number;
};

type ExperienceClockState = {
  mode: ExperienceClockMode;
  anchorExperienceTimeMs: number;
  anchorNowMs: number;
};

const normalizeMs = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
};

export class ExperienceClock {
  private state: ExperienceClockState;

  constructor({ experienceTimeMs = 0, nowMs = 0 }: { experienceTimeMs?: number; nowMs?: number } = {}) {
    this.state = {
      mode: 'frozen',
      anchorExperienceTimeMs: normalizeMs(experienceTimeMs),
      anchorNowMs: normalizeMs(nowMs)
    };
  }

  snapshot(nowMs: number): ExperienceClockSnapshot {
    const normalizedNow = normalizeMs(nowMs);
    const experienceTimeMs = this.state.mode === 'frozen'
      ? this.state.anchorExperienceTimeMs
      : this.state.anchorExperienceTimeMs + Math.max(normalizedNow - this.state.anchorNowMs, 0);

    return {
      mode: this.state.mode,
      experienceTimeMs,
      nowMs: normalizedNow,
      anchorExperienceTimeMs: this.state.anchorExperienceTimeMs,
      anchorNowMs: this.state.anchorNowMs
    };
  }

  anchorToReactionTime(reactionTimeMs: number, nowMs: number): ExperienceClockSnapshot {
    this.state = {
      mode: 'reaction',
      anchorExperienceTimeMs: normalizeMs(reactionTimeMs),
      anchorNowMs: normalizeMs(nowMs)
    };
    return this.snapshot(nowMs);
  }

  advanceWithWallClock(experienceTimeMs: number, nowMs: number): ExperienceClockSnapshot {
    this.state = {
      mode: 'wall',
      anchorExperienceTimeMs: normalizeMs(experienceTimeMs),
      anchorNowMs: normalizeMs(nowMs)
    };
    return this.snapshot(nowMs);
  }

  freezeAt(experienceTimeMs: number, nowMs: number): ExperienceClockSnapshot {
    this.state = {
      mode: 'frozen',
      anchorExperienceTimeMs: normalizeMs(experienceTimeMs),
      anchorNowMs: normalizeMs(nowMs)
    };
    return this.snapshot(nowMs);
  }
}

export function createExperienceClock(
  options: { experienceTimeMs?: number; nowMs?: number } = {}
): ExperienceClock {
  return new ExperienceClock(options);
}
