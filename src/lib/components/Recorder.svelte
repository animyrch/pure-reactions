<script>
  import { GradientButton } from 'flowbite-svelte';
  import { onMount } from "svelte";

  let mediaStream;
  let mediaRecorder;
  let recordedChunks = [];
  let videoElement;
  let videoError = false;

  export let startRecording;
  export let stopRecording;

  $: if (startRecording) {
    startRecording = false;
    startRecordingProcess();
  }
  $: if (stopRecording) {
    stopRecording = true;
    stopRecordingProcess();
  }

  const prepareRecordingProcess = async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      // Set the live video feed as the source of the video element
      videoElement.srcObject = mediaStream;
    } catch (error) {
      videoError = true;
      console.error('Error accessing media devices:', error);
    }
  };

  const startRecordingProcess = async () => {
    try {
      // mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaRecorder = new MediaRecorder(mediaStream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const recordedUrl = URL.createObjectURL(recordedBlob);

        // Set the recorded video as the source of the video element
        videoElement.src = recordedUrl;

        // Create a download link
        const downloadLink = document.createElement('a');
        downloadLink.href = recordedUrl;
        downloadLink.download = 'recorded-video.webm';
        downloadLink.textContent = "If automatic download didn't work, you can manually download your video by clicking here";

        const downloadElement = document.getElementById('download-link');

        // Append the download link to the specified div
        if (downloadElement) {
          downloadElement.appendChild(downloadLink);

          // Trigger a click event to start the download
          downloadLink.click();
        }
        // Unmute the audio
        videoElement.muted = false;
      };

      // Set the live video feed as the source of the video element
      videoElement.srcObject = mediaStream;

      // Start the recording
      // Mute the audio during recording
      videoElement.muted = true;
      mediaRecorder.start();
    } catch (error) {
      videoError = true;
      console.error('Error accessing media devices:', error);
    }
  };

  const stopRecordingProcess = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaStream.getTracks().forEach((track) => track.stop());
    }
  };

  onMount(async () => {
    await prepareRecordingProcess();
  });
</script>

<style>
  .recorder-container{
    width: 100%;
  }
</style>

<div>
  <div class="recorder-container">
    <!-- svelte-ignore a11y-media-has-caption -->
    <video bind:this={videoElement} controls autoplay width="100%" />
    {#if videoError}
      <p class="m-1 text-sm">
        If you don't already see yourself above, your reaction will not be recorded. Please change your browser settings to allow access to camera or use a different browser.
      </p>
    {:else}
      <p class="m-1 text-sm">
        Video capture starts recording when you click 'Start Reaction' and finishes when you click 'Finish Reaction'
      </p>
    {/if}
    <GradientButton id="download-link" class={videoElement?.src ? 'block' : 'hidden'} outline color="pinkToOrange"></GradientButton>
  </div>
</div>
