import { initializeFirebaseAdmin } from '../src/lib/server/firebaseAdmin.js';
import { getFirestore, collection, getDocs, writeBatch } from 'firebase-admin/firestore';
import { generateOriginalVideoSlug } from '../src/lib/helpers/originalVideo.js';
import { COLLECTION_REACTION_BINOMES } from '../src/lib/constants/firebase.js';

async function backfillOriginalVideoSlugs() {
  await initializeFirebaseAdmin();
  const db = getFirestore();
  const reactionsRef = collection(db, COLLECTION_REACTION_BINOMES);
  const snapshot = await getDocs(reactionsRef);

  if (snapshot.empty) {
    console.log('No reactions found to migrate.');
    return;
  }

  const batch = writeBatch(db);
  let count = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.originalVideoSlug && data.originalVideoTitle && data.originalVideoAuthor) {
      const slug = generateOriginalVideoSlug(data.originalVideoTitle, data.originalVideoAuthor);
      batch.update(doc.ref, { originalVideoSlug: slug });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully backfilled originalVideoSlug for ${count} reactions.`);
  } else {
    console.log('All reactions already have an originalVideoSlug.');
  }
}

backfillOriginalVideoSlugs().catch((error) => {
  console.error('Error backfilling original video slugs:', error);
  process.exit(1);
});
