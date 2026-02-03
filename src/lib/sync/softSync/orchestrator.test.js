/**
 * Unit tests for soft-sync orchestrator
 * Run with: node --test src/lib/sync/softSync/orchestrator.test.js
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySoftSync,
  createInitialSoftSyncState,
  cleanupSoftSync
} from './orchestrator.js';

describe('applySoftSync', () => {
  function createMockDeps() {
    return {
      setPlaybackRate: mock.fn(),
      resetPlaybackRate: mock.fn(),
      performHardSync: mock.fn(),
      setTimeout: mock.fn((cb, delay) => 123), // Return fake timeout id
      clearTimeout: mock.fn(),
      getNow: mock.fn(() => 1000)
    };
  }

  it('should do nothing when drift is below threshold', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    
    // Original at 10.05, reaction at 10.0, no offset -> drift = 0.05
    const nextState = applySoftSync(state, 10.05, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.setPlaybackRate.mock.calls.length, 0);
    assert.equal(deps.performHardSync.mock.calls.length, 0);
    assert.equal(nextState.isActive, false);
  });

  it('should apply soft-sync for small drift', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    
    // Original at 11.0, reaction at 10.0, no offset -> drift = 1.0
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.setPlaybackRate.mock.calls.length, 1);
    assert.ok(deps.setPlaybackRate.mock.calls[0].arguments[0] < 1.0); // Should slow down
    assert.equal(deps.setTimeout.mock.calls.length, 1);
    assert.equal(nextState.isActive, true);
    assert.equal(nextState.resetTimeoutId, 123);
  });

  it('should call hard-sync for large drift', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    
    // Original at 13.0, reaction at 10.0, no offset -> drift = 3.0
    const nextState = applySoftSync(state, 13.0, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.performHardSync.mock.calls.length, 1);
    assert.equal(deps.performHardSync.mock.calls[0].arguments[0], 3.0);
    assert.equal(deps.setPlaybackRate.mock.calls.length, 0);
    assert.equal(nextState.isActive, false);
  });

  it('should not apply soft-sync when not playing', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: false,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.setPlaybackRate.mock.calls.length, 0);
    assert.equal(deps.performHardSync.mock.calls.length, 0);
  });

  it('should not apply soft-sync when buffering', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: true,
      isBuffering: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.setPlaybackRate.mock.calls.length, 0);
    assert.equal(deps.performHardSync.mock.calls.length, 0);
  });

  it('should not apply soft-sync when scrubbing', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: true,
      isScrubbing: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.setPlaybackRate.mock.calls.length, 0);
    assert.equal(deps.performHardSync.mock.calls.length, 0);
  });

  it('should not apply soft-sync when playback rate change is disabled', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: false
    });
    
    assert.equal(deps.setPlaybackRate.mock.calls.length, 0);
    assert.equal(deps.performHardSync.mock.calls.length, 0);
  });

  it('should reset rate when guard conditions become true during active soft-sync', () => {
    const state = {
      lastSoftSyncAt: 500,
      isActive: true,
      resetTimeoutId: 456
    };
    const deps = createMockDeps();
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: false, // Now not playing
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.resetPlaybackRate.mock.calls.length, 1);
    assert.equal(deps.clearTimeout.mock.calls.length, 1);
    assert.equal(deps.clearTimeout.mock.calls[0].arguments[0], 456);
    assert.equal(nextState.isActive, false);
    assert.equal(nextState.resetTimeoutId, undefined);
  });

  it('should respect cooldown period', () => {
    const state = {
      lastSoftSyncAt: 900, // 100ms ago
      isActive: false,
      resetTimeoutId: undefined
    };
    const deps = createMockDeps();
    deps.getNow = mock.fn(() => 1000);
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: true
    });
    
    // Should not apply because cooldown (750ms) hasn't passed
    assert.equal(deps.setPlaybackRate.mock.calls.length, 0);
  });

  it('should clear previous timeout before applying new soft-sync', () => {
    const state = {
      lastSoftSyncAt: 0,
      isActive: true,
      resetTimeoutId: 789
    };
    const deps = createMockDeps();
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.clearTimeout.mock.calls.length, 1);
    assert.equal(deps.clearTimeout.mock.calls[0].arguments[0], 789);
    assert.equal(deps.setPlaybackRate.mock.calls.length, 1);
  });

  it('should reset when mode changes to no-op during active soft-sync', () => {
    const state = {
      lastSoftSyncAt: 0,
      isActive: true,
      resetTimeoutId: 999
    };
    const deps = createMockDeps();
    
    // Drift = 0.05, below threshold
    const nextState = applySoftSync(state, 10.05, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.resetPlaybackRate.mock.calls.length, 1);
    assert.equal(deps.clearTimeout.mock.calls.length, 1);
    assert.equal(nextState.isActive, false);
  });

  it('should fallback to hard-sync on playback rate error', () => {
    const state = createInitialSoftSyncState();
    const deps = createMockDeps();
    deps.setPlaybackRate = mock.fn(() => {
      throw new Error('Playback rate not supported');
    });
    
    const nextState = applySoftSync(state, 11.0, 10.0, 0, deps, {
      isPlaying: true,
      allowPlaybackRateChange: true
    });
    
    assert.equal(deps.performHardSync.mock.calls.length, 1);
    assert.equal(nextState.isActive, false);
  });
});

describe('createInitialSoftSyncState', () => {
  it('should create initial state with correct defaults', () => {
    const state = createInitialSoftSyncState();
    assert.equal(state.lastSoftSyncAt, 0);
    assert.equal(state.isActive, false);
    assert.equal(state.resetTimeoutId, undefined);
  });
});

describe('cleanupSoftSync', () => {
  it('should clear timeout and reset rate when active', () => {
    const state = {
      lastSoftSyncAt: 1000,
      isActive: true,
      resetTimeoutId: 555
    };
    const deps = {
      clearTimeout: mock.fn(),
      resetPlaybackRate: mock.fn()
    };
    
    cleanupSoftSync(state, deps);
    
    assert.equal(deps.clearTimeout.mock.calls.length, 1);
    assert.equal(deps.clearTimeout.mock.calls[0].arguments[0], 555);
    assert.equal(deps.resetPlaybackRate.mock.calls.length, 1);
  });

  it('should not call reset when not active', () => {
    const state = {
      lastSoftSyncAt: 1000,
      isActive: false,
      resetTimeoutId: undefined
    };
    const deps = {
      clearTimeout: mock.fn(),
      resetPlaybackRate: mock.fn()
    };
    
    cleanupSoftSync(state, deps);
    
    assert.equal(deps.clearTimeout.mock.calls.length, 0);
    assert.equal(deps.resetPlaybackRate.mock.calls.length, 0);
  });

  it('should clear timeout even when not active', () => {
    const state = {
      lastSoftSyncAt: 1000,
      isActive: false,
      resetTimeoutId: 777
    };
    const deps = {
      clearTimeout: mock.fn(),
      resetPlaybackRate: mock.fn()
    };
    
    cleanupSoftSync(state, deps);
    
    assert.equal(deps.clearTimeout.mock.calls.length, 1);
    assert.equal(deps.resetPlaybackRate.mock.calls.length, 0);
  });
});
