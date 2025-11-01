<script>
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import { getDatabase } from 'firebase/database';
    import ConfigEditorPlayerConfig from './ConfigEditorPlayerConfig.svelte';
    import ConfigEditorVolumeConfig from './ConfigEditorVolumeConfig.svelte';
    import ConfigEditorPlaybackConfig from './ConfigEditorPlaybackConfig.svelte';
    import { Button } from 'flowbite-svelte';
    import { updateFirebaseDocument } from "$lib/helpers/firebase";
    import { timeInVideoToSecondsConverter } from "$lib/helpers/reaction";
  
  export let volumeConfigs = {};
  export let playerConfigs = {};
  export let stateTimeline = [];
  export let volumeTimeline = [];
  export let playbackRateConfigs = {};
  export let playbackRateTimeline = [];
  
    let newConfigTime = '';
  getDatabase();
  
    const configs = writable([]);
  
    const updateConfigs = () => {
      const mergedConfigs = [];
      // Prefer new arrays, fall back to legacy maps
      if (Array.isArray(volumeTimeline) && volumeTimeline.length) {
        volumeTimeline.forEach(ev => mergedConfigs.push({ type: 'volume', timeInReaction: Number(ev.t), volume: ev.volume }));
      } else {
        for (const key in volumeConfigs) {
          mergedConfigs.push({ type: 'volume', timeInReaction: parseFloat(key), ...volumeConfigs[key] });
        }
      }
      if (Array.isArray(stateTimeline) && stateTimeline.length) {
        stateTimeline.forEach(ev => mergedConfigs.push({ type: 'player', timeInReaction: Number(ev.t), state: ev.state, time: Number(ev.targetTime) }));
      } else {
        for (const key in playerConfigs) {
          mergedConfigs.push({ type: 'player', timeInReaction: parseFloat(key), ...playerConfigs[key] });
        }
      }
      if (Array.isArray(playbackRateTimeline) && playbackRateTimeline.length) {
        playbackRateTimeline.forEach(ev => mergedConfigs.push({ type: 'speed', timeInReaction: Number(ev.t), rate: Number(ev.rate) }));
      } else {
        for (const key in playbackRateConfigs) {
          mergedConfigs.push({ type: 'speed', timeInReaction: parseFloat(key), rate: Number(playbackRateConfigs[key]?.rate ?? 1) });
        }
      }
      mergedConfigs.sort((a, b) => a.timeInReaction - b.timeInReaction);
      configs.set(mergedConfigs);
    };
  
    const updateFirebase = (configs) => {
      if (configs.length === 0) {
        return;
      }
      const newVolumeConfigs = {};
      const newPlayerConfigs = {};
      const newPlaybackRateConfigs = {};
      const newStateTimeline = [];
      const newVolumeTimeline = [];
      const newPlaybackTimeline = [];
  
      configs.forEach(config => {
        if (config.type === 'volume') {
          newVolumeConfigs[config.timeInReaction] = { volume: config.volume };
          newVolumeTimeline.push({ t: Number(config.timeInReaction), volume: Number(config.volume) });
        } else if (config.type === 'player') {
          newPlayerConfigs[config.timeInReaction] = { time: config.time, state: config.state };
          newStateTimeline.push({ t: Number(config.timeInReaction), state: Number(config.state), targetTime: Number(config.time) });
        } else if (config.type === 'speed') {
          newPlaybackRateConfigs[config.timeInReaction] = { rate: config.rate };
          newPlaybackTimeline.push({ t: Number(config.timeInReaction), rate: Number(config.rate) });
        }
      });
      updateFirebaseDocument({
          volumeConfigs: newVolumeConfigs,
          reactionConfigs: newPlayerConfigs,
          playbackRateConfigs: newPlaybackRateConfigs,
          stateTimeline: newStateTimeline.sort((a,b) => a.t - b.t),
          volumeTimeline: newVolumeTimeline.sort((a,b) => a.t - b.t),
          playbackTimeline: newPlaybackTimeline.sort((a,b) => a.t - b.t)
      });
    };
  
    onMount(() => {
      updateConfigs();
    });
  
    configs.subscribe(value => {
      // validate before updating
      // player config should have values for time, state and timeInReaction
      // volume config should have values for volume and timeInReaction
      if (value.some(config => config.type === 'player' && (typeof config.time  === 'undefined'|| !config.state || typeof config.timeInReaction === 'undefined'))) {
        console.error('Invalid player config');
        return;
      } else if (value.some(config => config.type === 'volume' && (!config.volume || typeof config.timeInReaction === 'undefined'))) {
        console.error('Invalid volume config');
        return;
      } else if (value.some(config => config.type === 'speed' && (typeof config.rate === 'undefined' || typeof config.timeInReaction === 'undefined'))) {
        console.error('Invalid playback speed config');
        return;
      }
      value = value.map(config => ({
        ...config,
        time: (typeof config.time !== 'undefined') ? Number(config.time).toFixed(2) : config.time,
        timeInReaction: (typeof config.timeInReaction !== 'undefined') ? Number(config.timeInReaction).toFixed(1) : config.timeInReaction,
        rate: config.type === 'speed' && typeof config.rate !== 'undefined' ? Number(config.rate).toFixed(2) : config.rate
      }));
      updateFirebase(value);
    });
  
    const addConfig = (type) => {
      const newConfigTimeAdjusted = timeInVideoToSecondsConverter(newConfigTime);
      configs.update(items => {
        if (type === 'volume') {
          items.push({ type: 'volume', timeInReaction: parseFloat(newConfigTimeAdjusted), volume: 100});
        } else if (type === 'player') {
          items.push({ type: 'player', timeInReaction: parseFloat(newConfigTimeAdjusted)});
        } else if (type === 'speed') {
          items.push({ type: 'speed', timeInReaction: parseFloat(newConfigTimeAdjusted), rate: 1 });
        }
        items.sort((a, b) => a.timeInReaction - b.timeInReaction);
        return items;
      });
    };
  
    const handleSelectionDelete = ({ timeIndicator, type}) => {
      configs.update(items => {
        return items.filter(item => !(item.type === type && item.timeInReaction == timeIndicator)); // Using == to allow comparison between string and number
      });
    };
  
    function updateConfig(type, time, newState) {
      configs.update(items => {
        return items.map(item => {
            if (item.type === type && item.timeInReaction == time) { // Using == to allow comparison between string and number
                if (type === "player") {
                    return { ...item, state: newState };
                } else if (type === "volume") {
                    return { ...item, volume: newState };
        } else if (type === "speed") {
          return { ...item, rate: newState };
                }
            }
            return item;
        });
      });
    }

    function updateTimeInReaction(type, time, newTime) {
      const newTimeAdjusted = timeInVideoToSecondsConverter(newTime);
      configs.update(items => {
        // Create a new array to force reactivity
        const updatedItems = items.map(item => {
          if (item.type === type && item.timeInReaction == time) { // Using == to allow comparison between string and number
            return { ...item, timeInReaction: newTimeAdjusted };
          }
          return item;
        });

        // Sort the updated items by time
        updatedItems.sort((a, b) => a.timeInReaction - b.timeInReaction);

        return updatedItems; // Return the new array reference
      });
    }
    function updateTimeConfig(type, time, newTime) {
      const newTimeAdjusted = timeInVideoToSecondsConverter(newTime);
      configs.update(items => {
        // Create a new array to force reactivity
        const updatedItems = items.map(item => {
          if (item.type === type && item.timeInReaction == time) { // Using == to allow comparison between string and number
            return { ...item, time: newTimeAdjusted };
          }
          return item;
        });

        // Sort the updated items by time
        updatedItems.sort((a, b) => a.timeInReaction - b.timeInReaction);

        return updatedItems; // Return the new array reference
      });
    }

    const handleSelectionChange = (event) => {
        updateConfig(event.detail.type, event.detail.timeIndicator, event.detail.state);
    };

    const handleTimeIndicatorChange = (details) => {
        updateTimeInReaction(details.type, details.time, details.newTime);
    };
    const handleTimeChangeInOriginal = (details) => {
        updateTimeConfig(details.type, details.time, details.timeIndicator);
    };
    const handleVolumeChange = (details) => {
      updateConfig('volume', details.time, details.volume);
    };
    const handleRateChange = (details) => {
      updateConfig('speed', details.time, details.rate);
    };
  </script>
  
  <style>
    .config-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .config-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  </style>
  
  <div>
    <h1>Configs</h1>
    <div class="config-container">
  {#each $configs as config}
        <div class="config-item">
          {#if config.type === 'volume'}
            <ConfigEditorVolumeConfig
                volume={config.volume}
                timeIndicator={config.timeInReaction}
                on:selectionChange={handleSelectionChange}
                on:selectionDelete={(params) => handleSelectionDelete(params.detail)}
                on:timeIndicatorChange={(params) => handleTimeIndicatorChange(params.detail)}
                on:volumeChange={(params) => handleVolumeChange(params.detail)}
            />
          {:else if config.type === 'player'}
            <ConfigEditorPlayerConfig
                selected={config.state}
                timeIndicator={config.timeInReaction}
                originalVideoTime={config.time}
                on:selectionChange={handleSelectionChange}
                on:selectionDelete={(params) => handleSelectionDelete(params.detail)}
                on:timeIndicatorChange={(params) => handleTimeIndicatorChange(params.detail)}
                on:timeInOriginalChange={(params) => handleTimeChangeInOriginal(params.detail)}
            />
          {:else if config.type === 'speed'}
            <ConfigEditorPlaybackConfig
                rate={Number(config.rate ?? 1)}
                timeIndicator={config.timeInReaction}
                on:selectionDelete={(params) => handleSelectionDelete(params.detail)}
                on:timeIndicatorChange={(params) => handleTimeIndicatorChange(params.detail)}
                on:rateChange={(params) => handleRateChange(params.detail)}
            />
          {/if}
        </div>
      {/each}
    </div>
    <div class="mt-4">
        <Button on:click={() => addConfig('volume')} disabled={!newConfigTime}>Add Volume Config</Button>
        <Button on:click={() => addConfig('player')} disabled={!newConfigTime}>Add Player Config</Button>
        <Button on:click={() => addConfig('speed')} disabled={!newConfigTime}>Add Playback Speed Config</Button>
        at
        <input
          id="newConfigTime"
          type="text"
          class="mt-2 p-2 border rounded"
          bind:value={newConfigTime}
        />
    </div>
  </div>
  