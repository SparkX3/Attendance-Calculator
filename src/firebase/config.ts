// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBaslRWAcgLT9Qa-DR-4LPlRIPrTauml7E",
  authDomain: "attendance-calculator-74a75.firebaseapp.com",
  projectId: "attendance-calculator-74a75",
  storageBucket: "attendance-calculator-74a75.firebasestorage.app",
  messagingSenderId: "1097791203284",
  appId: "1:1097791203284:web:dc3ac6a12efbd4ffd59841",
  measurementId: "G-H74YL9FZ5F"
};

// Initialize Firebase safely for Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Only initialize analytics on the client side
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, storage, googleProvider, analytics };
