import { initializeFirebaseAdmin } from '../../src/lib/server/firebaseAdmin';
import { getFirestore, collection, addDoc, deleteDoc, getDocs, query, where } from 'firebase-admin/firestore';
import { COLLECTION_REACTION_BINOMES } from '../../src/lib/constants/firebase';

export async function seedReaction(data) {
  await initializeFirebaseAdmin();
  const db = getFirestore();
  const reactionsRef = collection(db, COLLECTION_REACTION_BINOMES);
  const docRef = await addDoc(reactionsRef, {
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { id: docRef.id, ...data };
}

export async function clearReactions() {
  await initializeFirebaseAdmin();
  const db = getFirestore();
  const reactionsRef = collection(db, COLLECTION_REACTION_BINOMES);
  const snapshot = await getDocs(reactionsRef);
  const promises = [];
  snapshot.forEach((doc) => {
    promises.push(deleteDoc(doc.ref));
  });
  await Promise.all(promises);
}
