const getClosestSmallerKey = (timedConfigs, searchKey) => {
    if (!timedConfigs) {
        return -Infinity;
    }
    const keys = Object.keys(timedConfigs).map(Number);
    // Filter keys to keep only those smaller than the input
    const smallerKeys = keys.filter(currentKey => currentKey < searchKey);

    // Find the closest smaller key
    return smallerKeys.reduce((prev, curr) => (curr > prev ? curr : prev), -Infinity);
};

export const getCurrentVolumeFromVolumeConfigs = (currentTime, volumeConfigs) => {
    const DEFAULT_VOLUME_LEVEL = 100;
    const closestSmallerTimeCode = getClosestSmallerKey(volumeConfigs, currentTime);
    // If there are smaller volumes, return the volume for the closest smaller key
    // Otherwise, return a default value of 100
    return closestSmallerTimeCode !== -Infinity ? volumeConfigs[closestSmallerTimeCode.toFixed(1)]?.volume : DEFAULT_VOLUME_LEVEL;
};

export const getCurrentStateFromStateConfigs = (currentTime, stateConfigs) => {
    const DEFAULT_STATE_CONFIG = {
        state: -1,
        time: "0.00",
        closestSmallerTimeCode: 0.00
    };
    const closestSmallerTimeCode = getClosestSmallerKey(stateConfigs, currentTime);
    return closestSmallerTimeCode !== -Infinity ? {
        ...stateConfigs[closestSmallerTimeCode.toFixed(1)],
        closestSmallerTimeCode: closestSmallerTimeCode
     } : DEFAULT_STATE_CONFIG;
};

export const getCompensatedReactionTime = (startTime, playlistBufferTime = 0) => {
    const currentTime = new Date().getTime();
    const reactionSeconds = (currentTime - startTime) / 1000; // Convert to seconds
    const reactionSecondsInCasePlaylist = reactionSeconds + +playlistBufferTime;
    const compensatedTime = reactionSecondsInCasePlaylist - 1;
    const truncatedTime = compensatedTime.toFixed(1);
    const timeAdjustedForDatabaseKey = truncatedTime.toString();
    return timeAdjustedForDatabaseKey < 0 ? 0 : timeAdjustedForDatabaseKey;
};

export const timeInVideoToSecondsConverter = (timeInVideo) => {
    // if input doesnt have :, then it is already in seconds
    if (!timeInVideo.includes(":")) {
        return parseFloat(timeInVideo);
    }
    // we split the input with :
    const timeArray = timeInVideo.split(":");
    // if two elements, then we have minutes and seconds, if three, we have hours, minutes and seconds. We convert to seconds accordingly
    return timeArray.length === 2 ?
        parseInt(
            timeArray[0]) * 60 + parseInt(timeArray[1]
        ) :
        parseInt(
            timeArray[0]) * 3600 + parseInt(timeArray[1]) * 60 + parseInt(timeArray[2]
        );
};
