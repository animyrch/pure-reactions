import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const getReactions = (callback) => {
    const firestore = getFirestore(window.firebaseApp);
    const reactionsCollection = collection(firestore, "reactions");
    
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

window.getReactions = getReactions;