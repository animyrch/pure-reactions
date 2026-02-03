/**
 * YouTube Player Adapter
 * 
 * Implements PlayerAdapter interface for YouTube IFrame API.
 * Provides abstraction layer for future player types.
 */

/**
 * YouTube Player Adapter
 * 
 * Wraps YouTube IFrame API player to match PlayerAdapter interface
 * @implements {import('../types.js').PlayerAdapter}
 */
export class YouTubePlayerAdapter {
  /**
   * @param {Object} player - YouTube IFrame API player instance
   */
  constructor(player) {
    this.player = player;
  }
  
  getCurrentTime() {
    try {
      return this.player.getCurrentTime() || 0;
    } catch (error) {
      console.warn('[YouTubePlayerAdapter] Failed to get current time:', error);
      return 0;
    }
  }
  
  seek(time) {
    try {
      // allowSeekAhead = true allows seeking to unbuffered positions
      this.player.seekTo(time, true);
    } catch (error) {
      console.warn('[YouTubePlayerAdapter] Failed to seek:', error);
    }
  }
  
  getPlayerState() {
    try {
      return this.player.getPlayerState();
    } catch (error) {
      console.warn('[YouTubePlayerAdapter] Failed to get player state:', error);
      return -1;
    }
  }
  
  setPlaybackRate(rate) {
    try {
      if (this.player.setPlaybackRate) {
        this.player.setPlaybackRate(rate);
      }
    } catch (error) {
      console.warn('[YouTubePlayerAdapter] Failed to set playback rate:', error);
    }
  }
}
