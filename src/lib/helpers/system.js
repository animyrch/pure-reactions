import { browser } from '$app/environment';

export function isMobileDevice() {
    if (browser && window) {
        // return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return window.innerWidth < 640;
    }
    return false;
}

export function copyToClipboard(text) {
    // Create a temporary input element
    const input = document.createElement('textarea');
  
    // Set the input value to the text to be copied
    input.value = text;
  
    // Append the input element to the document
    document.body.appendChild(input);
  
    // Select the text in the input element
    input.select();
  
    // Execute the "copy" command to copy the selected text
    document.execCommand('copy');
  
    // Remove the temporary input element
    document.body.removeChild(input);
  }