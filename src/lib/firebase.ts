import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc,
  getDocFromServer,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

const env: any = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};

let firebaseConfig: any = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'pigmy-pro.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'pigmy-pro',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'pigmy-pro.appspot.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

// Validate config presence
const hasConfig = Boolean(
  env.VITE_FIREBASE_API_KEY && 
  env.VITE_FIREBASE_API_KEY !== 'your-api-key' && 
  env.VITE_FIREBASE_API_KEY !== 'demo-api-key' && 
  env.VITE_FIREBASE_PROJECT_ID && 
  env.VITE_FIREBASE_PROJECT_ID !== 'your-project-id' &&
  env.VITE_FIREBASE_PROJECT_ID !== 'pigmy-pro'
);

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
  if (!hasConfig) {
    console.warn("Firebase configuration is missing or using default placeholders. Please set up your Firebase project in the AI Studio platform Secrets panel.");
    return;
  }
  
  try {
    // Testing specific internal path to verify backend reachability
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('offline') || error.message.includes('unavailable')) {
        console.warn("Firebase: Client is currently offline or running in cached mode.");
      } else if ((error as any).code === 'permission-denied') {
        // Permission denied means it successfully reached the server and evaluated rules
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
