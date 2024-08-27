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
 * 'https://www.youtube.com/shorts/3JnmAl_8W5k'
 * 'LEv2fMoVvXE';
 */
export const extractYouTubeVideoId = (url) => {
  const regex = /^([a-zA-Z0-9_-]{11})$|(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v|shorts)\/))([^\?&"'>]+)/;
  const matches = url.match(regex);
  return matches ? (matches[1] || matches[6]) : null;
};

export const extractYoutubePlaylistId = (input) => {
    // Regular expression to match YouTube playlist ID
    const regex = /^PL[A-Za-z0-9_-]{16,}$/;

    // If the input matches the regular expression, return the input as it is
    if(regex.test(input)) {
        return input;
    }

    // If the input is a URL, extract the playlist ID from it
    const url = new URL(input);
    const params = new URLSearchParams(url.search);
    return params.get('list');
}

export async function getPlaylistVideoDetails(playlistId) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=AIzaSyCh578WuJotsqrcVBqZXChOD1SPshe1cnE`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const videoDetails = data.items.map(item => {
            return {
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails.default.url,
            };
        });
        return videoDetails;
    } catch (error) {
        console.error(error);
    }
}