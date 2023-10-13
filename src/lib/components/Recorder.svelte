<script>
    let mediaRecorder;
    let recordedChunks = [];
  
    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        mediaRecorder = new MediaRecorder(stream);
  
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };
  
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'recorded-video.webm';
          a.click();
          URL.revokeObjectURL(url);
          recordedChunks = [];
        };
  
        mediaRecorder.start();
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    }
  
    function stopRecording() {
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
    }
  </script>
  
  <style>
    /* Add your styles here */
  </style>
  
  <div>
    <button on:click={startRecording}>Start Recording</button>
    <button on:click={stopRecording}>Stop Recording</button>
  </div>
  