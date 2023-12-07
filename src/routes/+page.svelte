<!-- src/App.svelte -->

<script>
	import { onMount } from 'svelte';
	import { initializeApp } from 'firebase/app';
	import { getFirestore, collection, getDocs } from 'firebase/firestore/lite';
	import { COLLECTION_NAME, FIREBASE_CONFIG } from '$lib/constants/firebase';
	// Initialize Firebase
	const app = initializeApp(FIREBASE_CONFIG);
	const db = getFirestore(app);
	let documentData = [];

	const getReactions = (callback) => {
		const reactionsCollection = collection(db, COLLECTION_NAME);
		
		getDocs(reactionsCollection)
		.then((querySnapshot) => {
			documentData = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				data: doc.data()
			}));
			querySnapshot.docs.map(doc => console.log(doc.data()));
		})
		.catch((error) => {
			console.error('Error getting documents: ', error);
		});
	};

	// Call getReactions when the component is mounted
	onMount(() => {
		getReactions();
	});
</script>
		
<div>
	<div>
	  <!-- Loop through documentData and display the content in the template -->
	  {#each documentData as doc, index (index)}
		<a href={`/reaction/${doc.id}`}>
			<div class="thumbnails-container">
				<div class="reaction-thumbnail-container">
					<img src={`https://img.youtube.com/vi/${doc.data['reaction-video-id']}/hqdefault.jpg`} alt="Video Thumbnail">
				</div>
				<div class="original-thumbnail-container">
					<img src={`https://img.youtube.com/vi/${doc.data['original-video-id']}/hqdefault.jpg`} alt="Video Thumbnail">
				</div>
			</div>
			<!-- Replace "someField" with the actual field names in your documents -->
		</a>
	  {/each}
	</div>
  </div>


  
<style>
.thumbnails-container {
	position: relative;
}
.reaction-thumbnail-container img {
	width: 100%;
	object-fit: contain;
	border: solid 1px black;
}
.original-thumbnail-container img {
	border: solid 1px white;
	border-top: black;
	object-fit: contain;
	width: 50%;
	position: absolute;
	z-index: 10;
	top: 0;
}
</style>