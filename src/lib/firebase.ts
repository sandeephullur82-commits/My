import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc,
  getDocFromServer,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDMKmGTLDgtvv6CGypWfczIbSuXhj9fSnc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pigmy-app-a794e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pigmy-app-a794e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pigmy-app-a794e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "520886677066",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:520886677066:web:23a898f2701b2170d7c0b3"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Enable offline persistence using enabling API as requested
enableIndexedDbPersistence(db).then(() => {
  console.log("Firestore offline persistence enabled successfully via enableIndexedDbPersistence.");
}).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Firestore offline persistence failed: Multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.warn("Firestore offline persistence failed: Browser does not support persistence.");
  } else {
    console.error("Firestore offline persistence initialization error:", err);
  }
});

let messagingInstance: Messaging | null = null;
isSupported().then(supported => {
  if (supported) {
    messagingInstance = getMessaging(app);
  }
});
export const messaging = () => messagingInstance;

// CRITICAL: Connection test as per system guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('offline') || error.message.includes('unavailable')) {
        console.warn("Firebase: Client is currently offline or running in cached mode.");
      } else if ((error as any).code === 'permission-denied') {
        console.log("Firebase Connection: Success (rules verified)");
      } else {
        console.error("Firebase connection test failed:", error);
      }
    }
  }
}

// Set persistence explicitly to handle iframe environments better
setPersistence(auth, browserLocalPersistence).catch(console.error);

testConnection();
