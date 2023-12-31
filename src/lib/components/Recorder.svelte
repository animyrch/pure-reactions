<script>
  let mediaStream;
  let mediaRecorder;
  let recordedChunks = [];
  let videoElement;

  export let startRecording;
  export let stopRecording;

  const stopRecordingProcess = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaStream.getTracks().forEach((track) => track.stop());
    }
  };

  $: if (startRecording) {
    startRecording = false;
    startRecordingProcess();
  }
  $: if (stopRecording) {
    stopRecording = true;
    stopRecordingProcess();
  }

  const startRecordingProcess = async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        downloadLink.textContent = 'Download Video';

        // Append the download link to the document
        document.body.appendChild(downloadLink);
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
      console.error('Error accessing media devices:', error);
    }
  };
</script>

<style>
  .recorder-container{
    width: 100%;
  }
</style>

<div>
  <div class="recorder-container">
    <video bind:this={videoElement} controls autoplay width="100%" />
  </div>
</div>
