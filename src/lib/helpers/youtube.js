import {
  basicVideoDetailsUrl,
  videoIdPlaceholder,
  YOUTUBE_URL
} from '$lib/constants/youtube';

const getBasicVideoDetailsWithEmbedApi = async (videoId) => {
    try {
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
 * 'https://www.youtube.com/shorts/3JnmAl_8W5k'
 * 'LEv2fMoVvXE';
 */
export const extractYouTubeVideoId = (originalUrl) => {
  const regex = /^([a-zA-Z0-9_-]{11})$|(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v|shorts)\/))([^\?&"'>]+)/;
  const matches = originalUrl.match(regex);
  return matches ? (matches[1] || matches[6]) : null;
};

export const extractYoutubePlaylistId = (originalUrl) => {
    let playlistId = null;
    if (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be')) {
        const urlParams = new URLSearchParams(new URL(originalUrl).search);
        playlistId = urlParams.get('list');
    }
    return playlistId;
}

export const fetchFirstPlaylistVideos = async (playlistId, apiKey) => {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${apiKey}`;
  try {
      const response = await fetch(url);
      const data = await response.json();

      // Extract video IDs from the response
      return data.items;
  } catch (error) {
      console.error('Error fetching playlist videos:', error);
  }
}