import { getFirestore, collection, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

const updateFirebaseDocument = (dataToUpdate) => {
    const firestore = getFirestore(window.firebaseApp);
    const reactionsCollection = collection(firestore, 'reactions');
    const documentRef = doc(reactionsCollection, window.currentReactionDocumentId);

    updateDoc(documentRef, dataToUpdate);
};

window.updateFirebaseDocument = updateFirebaseDocument;