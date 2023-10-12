<!-- src/App.svelte -->
<script>
	import { onMount } from 'svelte';
	import { firebaseConfig } from '../firebaseConfig';
	import { initializeApp } from 'firebase/app';
	import { getFirestore, collection, getDocs } from 'firebase/firestore/lite';
	import { COLLECTION_NAME } from '../constants/firebase';
	
	// Initialize Firebase
	const app = initializeApp(firebaseConfig);
	const db = getFirestore(app);

	const getReactions = (callback) => {
		const reactionsCollection = collection(db, COLLECTION_NAME);
		
		getDocs(reactionsCollection)
		.then((querySnapshot) => {
			// console.log(querySnapshot);
			const lastDoc = querySnapshot["docs"][querySnapshot["docs"].length - 1];
			callback(lastDoc);
			// querySnapshot.forEach((doc) => {
			//   // doc.id is the document ID
			//   // doc.data() is an object containing the document data
			// });
		})
		.catch((error) => {
			console.error('Error getting documents: ', error);
		});
	};
	// 3. This function creates an <iframe> (and YouTube player)
	//    after the API code downloads.
	var playerReaction;
	var playerOriginal;
	var playerOptions = {
		'autoplay': 0,
		'controls': 1,
		'disablekb': 1,
		'modestbranding': 1,
		'rel': 0
	};


	function startReactionVideo() {
    playerReaction.playVideo();
	}
	function startOriginalVideo() {
		playerOriginal.playVideo();
	}
	function pauseOriginalVideo() {
		playerOriginal.pauseVideo();
	}
	// 4. The API will call this function when the video player is ready.
	function onPlayerReady(event) {
		console.log('player ready');
		// event.target.playVideo();
	}
	function onPlayerStateChange(event) {
		if (event.data == YT.PlayerState.PLAYING) {
			// setTimeout(stopVideo, 6000);
			// done = true;
		}
	}

	function goToSecondsInOriginalVideo(seconds) {
		return function() {
			playerOriginal.seekTo(seconds);
		};
	}
	function setVolumeForOriginalVideo(volume) {
		playerOriginal.setVolume(volume);
	}
	const setUpVideos = (doc) => {
		const obtainedData = doc.data();
		console.log(obtainedData);
		console.log(obtainedData["reaction-configs"]);
		window.playerConfigs = obtainedData["reaction-configs"];
		console.log(window.playerConfigs);
		playerReaction = new YT.Player('player-reaction', {
			// videoId: '2fjff_9P9to',
			videoId: obtainedData['reaction-video-id'],
			playerVars: playerOptions,
			events: {
			'onReady': onPlayerReady,
			'onStateChange': onPlayerStateChange
			}
		});
		playerOriginal = new YT.Player('player-original', {
			// videoId: 'wTLWTAG2DPU',
			videoId: obtainedData['original-video-id'],
			playerVars: playerOptions,
			events: {
			'onReady': onPlayerReady,
			'onStateChange': onPlayerStateChange
			}
		});
	};
	var CONFIG_OPTIONS = {
		START_VIDEO_REACTION: 1,
		START_VIDEO_ORIGINAL: 2,
		SET_VOLUME_REACTION: 3,
		SET_VOLUME_ORIGINAL: 4,
		PAUSE_VIDEO_ORIGINAL: 5,
		SEEK_TO_ORIGINAL: 6
	};
	function setTimeoutHandler (secondsInfo, configElement) {
		const activeConfigName = configElement[0];
		const extraConfigData = configElement[1];
		const timeoutInMiliseconds = secondsInfo * 1000;
		console.log(activeConfigName);
		console.log(timeoutInMiliseconds);
		switch (activeConfigName) {
			case CONFIG_OPTIONS.START_VIDEO_REACTION:
				setTimeout(startReactionVideo, timeoutInMiliseconds);
				break;
			case CONFIG_OPTIONS.SET_VOLUME_ORIGINAL:
				setTimeout(setVolumeForOriginalVideo(extraConfigData), timeoutInMiliseconds);
				break;
			case CONFIG_OPTIONS.START_VIDEO_ORIGINAL:
				setTimeout(startOriginalVideo, timeoutInMiliseconds);
				break;
			case CONFIG_OPTIONS.PAUSE_VIDEO_ORIGINAL:
				setTimeout(pauseOriginalVideo, timeoutInMiliseconds);
				break;
			case CONFIG_OPTIONS.SEEK_TO_ORIGINAL:
				setTimeout(goToSecondsInOriginalVideo(extraConfigData), timeoutInMiliseconds);
				break;
			default:
				break;
		}
	}
	onMount(async () => {
		var startButtonHandler = document.getElementById('players-start');
		startButtonHandler.addEventListener("click", () => {
			setTimeoutHandler(0, [1]);
			console.log(window.playerConfigs);
			for (const secondsInfo of Object.keys(window.playerConfigs)) {
				const configsForSecond = window.playerConfigs[secondsInfo]
				console.log(secondsInfo);
				const configElement = configsForSecond[0];
				console.log(configElement);
				setTimeoutHandler(secondsInfo, configElement);
			}
		});
		// Load the YouTube API
		const tag = document.createElement('script');
		tag.src = 'https://www.youtube.com/iframe_api';
		const firstScriptTag = document.getElementsByTagName('script')[0];
		firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
		// Set up a global callback for the YouTube API
		window.onYouTubeIframeAPIReady = () => {
			// player = new window.YT.Player('player', {
			// 	height: '390',
			// 	width: '640',
			// 	videoId: 'jrqVTUTDPVk'
			// });
			getReactions(setUpVideos);
		};
	  
	});
  </script>
  
  <style>

		/* Style for video container */
		.video-container {
			display: flex;
			justify-content: space-between;
			gap: 5rem;
			width: 100%;
		}

		.website-inner-container {
			margin: 5rem;
		}

		/* Style for individual video iframes */
		.video {
			flex: 0 0 48%; /* Adjust width as needed */
			margin-right: 2%;
		}

		/* Style for centered button */
		.center-button {
			margin-top: 20px;
			text-align: center;
		}

		/* Style for the button */
		button {
			padding: 10px 20px;
			background-color: #007BFF;
			color: #fff;
			border: none;
			border-radius: 5px;
			cursor: pointer;
			font-size: 16px;
		}

		/* Hover effect for the button */
		button:hover {
			background-color: #0056b3;
		}

		#player-original {
			width: 100wv;
		}
  </style>
  
		
		<div class="website-inner-container">
			<div id="player"></div>
			  <div class="video-container">
				<div id="player-original"></div>
				<div id="player-reaction"></div>
			  </div>
		  
			  <div id="players-start" class="center-button">
				<button>Start Watching</button>
			  </div>
			</div>



  