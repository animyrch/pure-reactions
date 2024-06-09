import {
  basicVideoDetailsUrl,
  videoIdPlaceholder,
  YOUTUBE_URL
} from '$lib/constants/youtube';

const getBasicVideoDetailsWithEmbedApi = async (videoId) => {
    try {
      console.log('Fetching data for video:', basicVideoDetailsUrl.replace(videoIdPlaceholder, videoId));
        const response = await fetch(basicVideoDetailsUrl.replace(videoIdPlaceholder, videoId));
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching data:', error.message);
      }
};

export const downloadBasicVideoDetails = async (videoId) => {
  const videoDetails = await getBasicVideoDetailsWithEmbedApi(videoId);
  return {
    videoAuthor: getAuthorFromAuthorUrl(videoDetails?.author_url),
    videoTitle: videoDetails?.title
  };
};

export const getAuthorFromAuthorUrl = (authorUrl) => {
  return authorUrl && authorUrl.replace(YOUTUBE_URL, '');
};

/**
 *  // Examples
 * 'https://youtu.be/LEv2fMoVvXE?si=SNxsWCJfigFYILvg';
 * 'https://www.youtube.com/watch?v=LEv2fMoVvXE&ab_channel=AsmongoldTV';
 * 'https://www.youtube.com/watch?v=LEv2fMoVvXE';
 * 'LEv2fMoVvXE';
 */
export const extractYouTubeVideoId = (urlOrVideoId) => {
  // Regular expression to match YouTube video IDs in different URL formats
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  
  // Check if the input is already a YouTube video ID
  if (urlOrVideoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
    return urlOrVideoId; // Return the input as it is
  }

  // Match the video ID using the regular expression
  const match = urlOrVideoId.match(regex);

  // Return the video ID if a match is found, otherwise return null
  return match ? match[1] : null;
};