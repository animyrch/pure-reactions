<script>
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import { getDatabase, ref, set, update } from 'firebase/database'; // Ensure firebase is initialized
    import ConfigEditorPlayerConfig from './ConfigEditorPlayerConfig.svelte';
    import ConfigEditorVolumeConfig from './ConfigEditorVolumeConfig.svelte';
    import { Select, Label, Button } from 'flowbite-svelte';
    import { updateFirebaseDocument } from "$lib/helpers/firebase";
  
    export let volumeConfigs = {};
    export let playerConfigs = {};
  
    let newConfigTime = '';
    const db = getDatabase();
  
    const configs = writable([]);
  
    const updateConfigs = () => {
      const mergedConfigs = [];
  
      // Merge and sort configs
      for (const key in volumeConfigs) {
        mergedConfigs.push({ type: 'volume', timeInReaction: parseFloat(key), ...volumeConfigs[key] });
      }
      for (const key in playerConfigs) {
        mergedConfigs.push({ type: 'player', timeInReaction: parseFloat(key), ...playerConfigs[key] });
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
  
      configs.forEach(config => {
        if (config.type === 'volume') {
          newVolumeConfigs[config.timeInReaction] = { volume: config.volume };
        } else if (config.type === 'player') {
          newPlayerConfigs[config.timeInReaction] = { time: config.time, state: config.state };
        }
      });
      updateFirebaseDocument({
          "volumeConfigs": newVolumeConfigs,
          "reactionConfigs": newPlayerConfigs
      });
    };
  
    onMount(() => {
      updateConfigs();
    });
  
    configs.subscribe(value => {
      // validate before updating
      // player config should have values for time, state and timeInReaction
      // volume config should have values for volume and timeInReaction
      if (value.some(config => config.type === 'player' && (!config.time || !config.state || !config.timeInReaction))) {
        console.error('Invalid player config');
        return;
      } else if (value.some(config => config.type === 'volume' && (!config.volume || !config.timeInReaction))) {
        console.error('Invalid volume config');
        return;
      }
      updateFirebase(value);
    });
  
    const addConfig = (type) => {
      configs.update(items => {
        if (type === 'volume') {
          items.push({ type: 'volume', timeInReaction: parseFloat(newConfigTime), volume: 100});
        } else if (type === 'player') {
          items.push({ type: 'player', timeInReaction: parseFloat(newConfigTime)});
        }
        items.sort((a, b) => a.timeInReaction - b.timeInReaction);
        return items;
      });
      console.log('configs', $configs);
    };
  
    const handleSelectionDelete = ({ timeIndicator, type}) => {
      configs.update(items => {
        return items.filter(item => !(item.type === type && item.timeInReaction == timeIndicator)); // Using == to allow comparison between string and number
      });
      console.log('configs', $configs);
    };
  
    function updateConfig(type, time, newState) {
      configs.update(items => {
        return items.map(item => {
            if (item.type === type && item.timeInReaction == time) { // Using == to allow comparison between string and number
                if (type === "player") {
                    return { ...item, state: newState };
                } else if (type === "volume") {
                    return { ...item, volume: newState };
                }
            }
            return item;
        });
      });
    }

    function updateTimeInReaction(type, time, newTime) {
      configs.update(items => {
        // Create a new array to force reactivity
        const updatedItems = items.map(item => {
          if (item.type === type && item.timeInReaction == time) { // Using == to allow comparison between string and number
            return { ...item, timeInReaction: newTime };
          }
          return item;
        });

        // Sort the updated items by time
        updatedItems.sort((a, b) => a.timeInReaction - b.timeInReaction);

        return updatedItems; // Return the new array reference
      });
    }
    function updateTimeConfig(type, time, newTime) {
      configs.update(items => {
        // Create a new array to force reactivity
        const updatedItems = items.map(item => {
          if (item.type === type && item.timeInReaction == time) { // Using == to allow comparison between string and number
            return { ...item, time: newTime };
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
    .icon {
      width: 20px;
      height: 20px;
    }
  </style>
  
  <div>
    <h1>Configs</h1>
    <div class="config-container">
      {#each $configs as config, index}
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
          {:else}
            <ConfigEditorPlayerConfig
                selected={config.state}
                timeIndicator={config.timeInReaction}
                originalVideoTime={config.time}
                on:selectionChange={handleSelectionChange}
                on:selectionDelete={(params) => handleSelectionDelete(params.detail)}
                on:timeIndicatorChange={(params) => handleTimeIndicatorChange(params.detail)}
                on:timeInOriginalChange={(params) => handleTimeChangeInOriginal(params.detail)}
            />
          {/if}
        </div>
      {/each}
    </div>
    <div class="mt-4">
        <Button on:click={() => addConfig('volume')} disabled={!newConfigTime}>Add Volume Config</Button>
        <Button on:click={() => addConfig('player')} disabled={!newConfigTime}>Add Player Config</Button>
        at
        <input
          id="newConfigTime"
          type="text"
          class="mt-2 p-2 border rounded"
          bind:value={newConfigTime}
        />
    </div>
  </div>
  