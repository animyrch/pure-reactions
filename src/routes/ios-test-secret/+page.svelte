<script>
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";

    let playerOriginal;
    let playerReaction;
    let isApiReady = false;
    let bothPlaying = false;
    let statusMessage = "Waiting for interactions...";
    let timer;
    let timeRemaining = 10;
    let currentPhase = "both_muted"; // 'both_muted' | 'original_muted' | 'reaction_muted'
    let originalReady = false;
    let reactionReady = false;

    // Use arbitrary video IDs for testing
    const ORIGINAL_VIDEO_ID = "dQw4w9WgXcQ"; // Never Gonna Give You Up (Classic)
    const REACTION_VIDEO_ID = "dQw4w9WgXcQ"; // Math response (Just an example)

    onMount(() => {
        if (!browser) return;

        if (!window.YT) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                isApiReady = true;
                initPlayers();
            };
        } else {
            isApiReady = true;
            initPlayers();
        }
    });

    onDestroy(() => {
        if (timer) clearInterval(timer);
        if (playerOriginal && playerOriginal.destroy) playerOriginal.destroy();
        if (playerReaction && playerReaction.destroy) playerReaction.destroy();
    });

    function initPlayers() {
        console.log("Initializing players...");

        playerOriginal = new YT.Player("player-original", {
            height: "360",
            width: "640",
            videoId: ORIGINAL_VIDEO_ID,
            playerVars: {
                playsinline: 1,
                controls: 1,
            },
            events: {
                onReady: () => {
                    originalReady = true;
                    ensureBothMuted();
                },
                onStateChange: onPlayerStateChange,
            },
        });

        playerReaction = new YT.Player("player-reaction", {
            height: "360",
            width: "640",
            videoId: REACTION_VIDEO_ID,
            playerVars: {
                playsinline: 1,
                controls: 1,
            },
            events: {
                onReady: () => {
                    reactionReady = true;
                    ensureBothMuted();
                },
                onStateChange: onPlayerStateChange,
            },
        });
    }

    function ensureBothMuted() {
        if (!originalReady || !reactionReady) return;
        playerOriginal?.mute?.();
        playerReaction?.mute?.();
        currentPhase = "both_muted";
        statusMessage = "Players ready. Both start muted — press play on both.";
    }

    let firstVideoPaused = false;
    let successfulDualStart = false;

    function onPlayerStateChange(event) {
        checkStartCondition(event.target);
    }

    function checkStartCondition(triggeringPlayer) {
        if (successfulDualStart) return;

        const p1State = playerOriginal?.getPlayerState();
        const p2State = playerReaction?.getPlayerState();

        const p1Playing = p1State === 1;
        const p2Playing = p2State === 1;
        const p1Paused = p1State === 2;
        const p2Paused = p2State === 2;

        console.log(`State Check: P1=${p1State} P2=${p2State}`);

        // Success condition: Both are playing
        if (p1Playing && p2Playing) {
            console.log("SUCCESS detected.");
            successfulDualStart = true;
            bothPlaying = true;
            statusMessage =
                "SUCCESS! Both players running. The pause did NOT break it.";

            // Unmute purely to prove audio works, but let logic decide phase
            playerOriginal.unMute();
            playerReaction.mute();

            startAlternatingSequence();
            return;
        }

        // STEP 1: Pause the first one that plays (Hypothesis Test)
        // Only do this if we haven't paused one yet.
        if (!firstVideoPaused) {
            if (p1Playing) {
                console.log("Hypothesis Test: Pausing Original...");
                playerOriginal.pauseVideo();
                firstVideoPaused = true;
                statusMessage = "Original PAUSED. Now click Reaction.";
                return;
            } else if (p2Playing) {
                console.log("Hypothesis Test: Pausing Reaction...");
                playerReaction.pauseVideo();
                firstVideoPaused = true;
                statusMessage = "Reaction PAUSED. Now click Original.";
                return;
            }
        }

        // STEP 2: Attempt to resume if we are in the "One Playing, One Paused" state
        if (firstVideoPaused) {
            if (p1Playing && p2Paused) {
                // Reaction was paused, Original is now playing. Resume Reaction.
                console.log("Attempting to resume Reaction...");
                statusMessage = "Original playing. Resuming Reaction...";
                playerReaction.playVideo();
            } else if (p2Playing && p1Paused) {
                // Original was paused, Reaction is now playing. Resume Original.
                console.log("Attempting to resume Original...");
                statusMessage = "Reaction playing. Resuming Original...";
                playerOriginal.playVideo();
            } else {
                statusMessage = `Waiting... P1:${stateToString(p1State)} P2:${stateToString(p2State)}`;
            }
        } else {
            statusMessage = "Waiting for user to click a video...";
        }
    }

    function stateToString(state) {
        if (state === 1) return "PLAYING";
        if (state === 2) return "PAUSED";
        if (state === 0) return "ENDED";
        if (state === 3) return "BUFFERING";
        if (state === 5) return "CUED";
        return "UNKNOWN (" + state + ")";
    }
    function startAlternatingSequence() {
        // Start switching only once both are confirmed playing.
        setPhase("original_muted");

        // Set up timer for switching
        timer = setInterval(() => {
            timeRemaining--;
            if (timeRemaining <= 0) {
                togglePhase();
                timeRemaining = 10;
            }
        }, 1000);
    }

    function setPhase(phase) {
        currentPhase = phase;
        timeRemaining = 10;

        if (phase === "both_muted") {
            playerOriginal.mute();
            playerReaction.mute();
            statusMessage = "Phase: BOTH MUTED";
        } else if (phase === "original_muted") {
            playerOriginal.mute();
            playerReaction.unMute();
            playerReaction.setVolume(100);
            statusMessage = "Phase: ORIGINAL MUTED | Reaction PLAYING";
        } else {
            playerOriginal.unMute();
            playerOriginal.setVolume(100);
            playerReaction.mute();
            statusMessage = "Phase: REACTION MUTED | Original PLAYING";
        }
    }

    function togglePhase() {
        if (currentPhase === "original_muted") {
            setPhase("reaction_muted");
        } else {
            setPhase("original_muted");
        }
    }
</script>

<div class="test-container">
    <h1>iOS Dual Playback Test</h1>
    <p class="status">{statusMessage}</p>

    {#if bothPlaying}
        <div class="timer">Next switch in: {timeRemaining}s</div>
    {/if}

    <div class="players-grid">
        <div class="player-wrapper">
            <h2>Original (Muted in Phase 1)</h2>
            <div id="player-original"></div>
            <div
                class="indicator"
                class:active={currentPhase === "reaction_muted"}
                class:muted={currentPhase === "original_muted" ||
                    currentPhase === "both_muted"}
            >
                {currentPhase === "reaction_muted" ? "AUDIO ACTIVE" : "MUTED"}
            </div>
        </div>

        <div class="player-wrapper">
            <h2>Reaction (Muted in Phase 2)</h2>
            <div id="player-reaction"></div>
            <div
                class="indicator"
                class:active={currentPhase === "original_muted"}
                class:muted={currentPhase === "reaction_muted" ||
                    currentPhase === "both_muted"}
            >
                {currentPhase === "original_muted" ? "AUDIO ACTIVE" : "MUTED"}
            </div>
        </div>
    </div>

    <div class="instructions">
        <h3>Instructions:</h3>
        <ol>
            <li>Tap "Play" on the Original video.</li>
            <li>Tap "Play" on the Reaction video.</li>
            <li>Wait for both to be in "PLAYING" state.</li>
            <li>Observe if they stay playing when the audio switches.</li>
        </ol>
    </div>
</div>

<style>
    .test-container {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        background: #111;
        color: white;
        min-height: 100vh;
    }

    .status {
        font-size: 1.2rem;
        color: #ffd700;
        margin-bottom: 10px;
    }

    .timer {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 20px;
    }

    .players-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
    }

    @media (min-width: 768px) {
        .players-grid {
            grid-template-columns: 1fr 1fr;
        }
    }

    .player-wrapper {
        background: #222;
        padding: 10px;
        border-radius: 8px;
    }

    .player-wrapper h2 {
        font-size: 1rem;
        margin-bottom: 10px;
    }

    .indicator {
        margin-top: 10px;
        padding: 10px;
        text-align: center;
        font-weight: bold;
        background: #333;
        border-radius: 4px;
    }

    .indicator.active {
        background: #00aa00;
        color: white;
    }

    .indicator.muted {
        background: #aa0000;
        color: white;
    }

    .instructions {
        margin-top: 40px;
        padding: 20px;
        background: #333;
        border-radius: 8px;
    }
</style>
