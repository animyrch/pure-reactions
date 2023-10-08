import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

const createReactionDocument = (originalVideoId) => {
    const firestore = getFirestore(window.firebaseApp);
    const reactionsCollection = collection(firestore, 'reactions');
    const dataToAdd = {
        "original-video-id": originalVideoId,
        "reactor-id": 1,
        "reaction-configs": {}
    };
    addDoc(reactionsCollection, dataToAdd)
        .then((documentRef) => {
            // documentRef.id contains the auto-generated document ID
            console.log('Document added with ID:', documentRef.id);
            window.currentReactionDocumentId = documentRef.id;
        })
        .catch((error) => {
            console.error('Error adding document:', error);
        });
};

window.createReactionDocument = createReactionDocument;