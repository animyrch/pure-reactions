import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    query,
    where
} from "firebase/firestore/lite";
import {
    getAuth,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    updatePassword,
    sendEmailVerification,
    reauthenticateWithCredential,
    EmailAuthProvider,
    verifyBeforeUpdateEmail
} from "firebase/auth";
import { COLLECTION_NAME, FIREBASE_CONFIG } from "$lib/constants/firebase";

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
export const auth = getAuth(app);

export const createReactionDocument = (originalVideoId) => {
    const reactionsCollection = collection(db, COLLECTION_NAME);
    const dataToAdd = {
        "original-video-id": originalVideoId,
        "reaction-configs": {},
    };
    addDoc(reactionsCollection, dataToAdd)
        .then((documentRef) => {
            // documentRef.id contains the auto-generated document ID
            console.log("Document added with ID:", documentRef.id);
            window.currentReactionDocumentId = documentRef.id;
        })
        .catch((error) => {
            console.error("Error adding document:", error);
        });
};

export const updateFirebaseDocument = (dataToUpdate) => {
    const reactionsCollection = collection(db, COLLECTION_NAME);
    const documentRef = doc(
        reactionsCollection,
        window.currentReactionDocumentId
    );

    updateDoc(documentRef, dataToUpdate);
};

export const getAllReactions = async () => {
    let reactions = [];
    try {
        const reactionsCollection = collection(db, COLLECTION_NAME);
        const querySnapshot = await getDocs(reactionsCollection);
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
    } catch (error) {
        console.error('Error getting documents: ', error);
    }
    return reactions;
};

export const getFilteredReactions = async ({
    userId
}) => {
    let reactions = [];
    try {
        const reactionsCollection = collection(db, COLLECTION_NAME);
        const queryRef = query(reactionsCollection, where("reactor-id", "==", userId));
        const querySnapshot = await getDocs(queryRef);
        reactions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data()
        }));
        return reactions;
    } catch (error) {
        console.error('Error getting filtered documents: ', error);
    }
};

export const createUserWithEmailAndPasswordWrapper = async (email, password) => {
    try {
        const userCreds = await createUserWithEmailAndPassword(auth, email, password)
        sendEmailVerification(userCreds.user, {
            url: window.location.href
        });
        console.log('Verification email sent.');
    } catch (error) {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log('errorCode', errorCode);
        console.log('errorMessage', errorMessage);
    }
};

export const signInWithEmailAndPasswordWrapper = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('user', user);
    } catch (error) {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log('errorCode', errorCode);
        console.log('errorMessage', errorMessage);
    }
};

export const checkUserSignInStatusWrapper = () => {
    return new Promise((resolve, reject) => {
        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
            // Unsubscribe immediately after the first invocation
            unsubscribe();
    
            if (user) {
                // User is signed in
                resolve(user);
            } else {
                // User is signed out
                resolve(null);
            }
            });
        } catch (error) {
            reject('Sign in status check failed');
        }
    });
};

export const signOutWrapper = async () => {
    try {
        await signOut(auth);
        console.log('User signed out');
    } catch (error) {
        console.error('Sign-out error:', error);
    }
};

export async function updateDisplayNameHelper(user, displayName) {
    try {
        await updateProfile(user, { displayName });
    } catch (error) {
        console.error('Error updating display name:', error.message);
        throw error;
    }
}
export async function updatePhotoHelper(user, photoURL) {
    try {
        await updateProfile(user, { photoURL });
    } catch (error) {
        console.error('Error updating user photo:', error.message);
        throw error;
    }
}
export async function updateEmailHelper(user, newEmail) {
    try {
      await verifyBeforeUpdateEmail(user, newEmail);
    } catch (error) {
      console.error('Error updating email:', error.message);
      throw error;
    }
}
export async function updatePasswordHelper(user, newPassword) {
    try {
      await updatePassword(user, newPassword);
    } catch (error) {
      console.error('Error updating password:', error.message);
      throw error;
    }
  }

export const reauthenticateUserHelper = async (user) => {
    try {
        // Prompt the user to re-enter their password
        const password = prompt('Please enter your password to continue:');
        console.log(auth);
        // const credential = auth.EmailAuthProvider.credential(user.email, password);
        const credential = EmailAuthProvider.credential(user.email, password);
        // Reauthenticate the user
        console.log(credential, 'credential');
        await reauthenticateWithCredential(auth.currentUser, credential);
    } catch (error) {
        console.error('Error reauthenticating user:', error.message);
        throw error;
    }
};