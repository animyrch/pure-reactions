<script>
  let mediaStream;
  let mediaRecorder;
  let recordedChunks = [];
  let videoElement;

  const startRecording = async () => {
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

      // Mute the audio during recording
      videoElement.muted = true;

      // Start the recording
      mediaRecorder.start();
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaStream.getTracks().forEach((track) => track.stop());
    }
  };
</script>

<div>
  <button on:click={startRecording}>Start Recording</button>
  <button on:click={stopRecording}>Stop Recording</button>
</div>

<video bind:this={videoElement} controls autoplay />
