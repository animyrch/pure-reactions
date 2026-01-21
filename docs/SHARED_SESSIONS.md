# Shared Reaction Sessions

This feature allows reactors to share their reaction sessions in real-time with viewers. When a reactor starts recording a reaction, they can generate a shareable URL that allows others to watch the same video synchronized with the reactor's controls.

## How It Works

### For Reactors (Backend Users)
1. Start a reaction session as usual
2. A shared session is automatically created when you click "Start Reaction"
3. Click "Share Session" to get a shareable URL
4. Share the URL with others - they'll see the same video and it will sync with your controls
5. The session automatically ends when you finish the reaction or leave the page

### For Viewers
1. Visit the shared URL (e.g., `/shared/[sessionId]`)
2. The video will automatically load and sync with the reactor's controls
3. You cannot control the video - only watch
4. The session ends when the reactor finishes or leaves

## Technical Implementation

### Firebase Realtime Database
- Uses Firebase Realtime Database for real-time synchronization
- Session data includes: video ID, current time, play/pause state, volume, viewer list
- Automatic cleanup of inactive sessions (older than 24 hours)

### Key Components
- `sharedSession.js` - Helper functions for session management
- `backend/+page.svelte` - Enhanced with sharing functionality
- `shared/[sessionId]/+page.svelte` - Viewer page for shared sessions

### Session States
- `WAITING` - Session created, waiting for reactor to start
- `PLAYING` - Video is playing
- `PAUSED` - Video is paused
- `ENDED` - Session has ended

## Features
- Real-time video synchronization (play/pause/seek/volume)
- Viewer count tracking
- Automatic session cleanup
- Error handling for disconnected sessions
- Mobile-friendly interface

## Security Considerations
- Sessions are public by design (anyone with the URL can join)
- No authentication required for viewers
- Sessions automatically expire after 24 hours
- Reactor controls all video playback

## Usage Examples

### Creating a Shared Session
```javascript
// Automatically called when starting a reaction
const sessionId = await createSharedSession(reactionDocumentId, originalVideoId, reactorId);
const shareUrl = generateShareUrl(sessionId);
```

### Joining a Session
```javascript
// Called when a viewer visits the shared URL
await joinSharedSession(sessionId, viewerId, viewerName);
```

### Syncing Video State
```javascript
// Called when reactor changes video state
await updateSessionState(sessionId, {
    state: SESSION_STATES.PLAYING,
    currentTime: player.getCurrentTime(),
    volume: player.getVolume()
});
```
