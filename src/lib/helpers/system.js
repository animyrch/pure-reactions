import { browser } from '$app/environment';

/**
 * Escapes HTML special characters to prevent XSS when using {@html}.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Converts plain text to HTML, auto-detecting URLs and turning them into
 * clickable `<a>` links that open in a new tab.
 * Supports https://, http://, and bare www. URLs.
 * All non-URL text is HTML-escaped to prevent XSS.
 * @param {string} text
 * @returns {string} HTML string safe for {@html} rendering
 */
export function linkifyText(text) {
    if (typeof text !== 'string' || text.length === 0) return '';

    const urlPattern = /((https?:\/\/|www\.)[^\s<>"']+)/g;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = urlPattern.exec(text)) !== null) {
        // Escape and append the text before this URL
        result += escapeHtml(text.slice(lastIndex, match.index));

        const rawUrl = match[1];
        // Ensure the href is always a full URL
        const href = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
        const escapedDisplay = escapeHtml(rawUrl);
        const escapedHref = escapeHtml(href);

        result += `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer">${escapedDisplay}</a>`;
        lastIndex = match.index + match[0].length;
    }

    // Append remaining text after the last URL
    result += escapeHtml(text.slice(lastIndex));
    return result;
}

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