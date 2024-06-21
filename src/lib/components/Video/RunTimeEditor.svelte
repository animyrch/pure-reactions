<script>
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
  
    let config = {
      "10.0": { state: 1, time: "00:10" },
      "20.0": { state: 2, time: "00:20" },
      "40.0": { state: 3, time: "00:40" }
    };
  
    const videoDuration = 60; // Video duration in seconds
    let positions = writable([]);
    let cursorTime = writable(null);
    let showPopover = writable(false);
    let popoverX = writable(0);
    let popoverY = writable(0);
    let selectedLine = writable(null);
    let creatingLinePosition = writable(null);
  
    onMount(() => {
      updatePositions();
    });
  
    function updatePositions() {
      let newPositions = [];
      for (const [time, data] of Object.entries(config)) {
        const percentage = (parseFloat(time) / videoDuration) * 100;
        newPositions.push({ ...data, position: percentage.toFixed(1) });
      }
      positions.set(newPositions);
    }
  
    function handleMouseMove(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = ((event.clientX - rect.left) / rect.width) * videoDuration;
      cursorTime.set(position.toFixed(1));
    }
  
    function handleRectClick(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = ((event.clientX - rect.left) / rect.width) * videoDuration;
      creatingLinePosition.set(position.toFixed(1));
      showPopover.set(true);
      popoverX.set(event.clientX);
      popoverY.set(event.clientY);
      selectedLine.set(null);
    }
  
    function handleLineClick(event, line) {
      event.stopPropagation();
      showPopover.set(true);
      popoverX.set(event.clientX);
      popoverY.set(event.clientY);
      selectedLine.set(line);
    }
  
    function createLine(type) {
      const position = parseFloat($creatingLinePosition).toFixed(1);
      const time = formatTime(position);
      config[position] = { state: type, time: time };
      updatePositions();
      showPopover.set(false);
    }
  
    function deleteLine(line) {
      const position = (line.position * videoDuration / 100).toFixed(1);
      console.log('Deleting position:', position); // Debugging line
      delete config[position];
      updatePositions();
      showPopover.set(false);
    }
  
    function formatTime(time) {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  </script>
  
  <div class="w-full p-4">
    <div 
      class="relative w-full h-16 bg-blue-200"
      on:mousemove={handleMouseMove}
      on:click={handleRectClick}
    >
      {#each $positions as line (line.position)}
        <div 
          class="absolute cursor-pointer" 
          style="left: {line.position}%;"
        >
          <div class="relative w-px h-16 bg-black">
            <button
                class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full"
                on:click={(event) => handleLineClick(event, line)}
            >
              {#if line.state === 1}
                ⏯️
              {/if}
              {#if line.state === 2}
                ⏹️
              {/if}
              {#if line.state === 3}
                ⏳
              {/if}
          </button>
            <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
              {line.time}
            </div>
          </div>
        </div>
      {/each}
  
      {#if $cursorTime}
        <div class="absolute" style="left: {($cursorTime / videoDuration) * 100}%;">
          <div class="relative">
            <div class="absolute bottom-full mb-4">
              {$cursorTime}
            </div>
          </div>
        </div>
      {/if}
  
      {#if $showPopover}
        <div class="fixed bg-white shadow-lg p-2" style="top: {$popoverY}px; left: {$popoverX}px;">
          {#if $selectedLine}
            <button on:click={() => deleteLine($selectedLine)}>Delete</button>
          {:else}
            <button on:click={() => createLine(1)}>Create Start</button>
            <button on:click={() => createLine(2)}>Create Stop</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  
  <style>
    .state-line {
      width: 1px;
      background-color: black;
    }
  </style>
  