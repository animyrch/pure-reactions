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
			<p>{doc.id}</p>
			<img src={`https://img.youtube.com/vi/${doc.data['reaction-video-id']}/hqdefault.jpg`} alt="Video Thumbnail">
			<img src={`https://img.youtube.com/vi/${doc.data['original-video-id']}/hqdefault.jpg`} alt="Video Thumbnail">
			<!-- Replace "someField" with the actual field names in your documents -->
		</a>
	  {/each}
	</div>
  </div>


  