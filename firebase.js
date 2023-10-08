// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
apiKey: "AIzaSyBqsnKIBnbRJqkpyOynZGLySf28AuqmOiE",
authDomain: "pure-reactions.firebaseapp.com",
projectId: "pure-reactions",
storageBucket: "pure-reactions.appspot.com",
messagingSenderId: "722795539356",
appId: "1:722795539356:web:0ec764c6b5834567603659",
measurementId: "G-T7TWND1C6C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Make the configuration available globally
window.firebaseConfig = firebaseConfig;
window.firebaseApp = app;
window.firebaseAnalytics = analytics;