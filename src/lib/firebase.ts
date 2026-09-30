import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  doc,
  getDocFromServer,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

let firebaseConfig: any = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)'
};

// Validate config presence
const hasConfig = firebaseConfig.apiKey && 
                 firebaseConfig.apiKey !== 'your-api-key' && 
                 firebaseConfig.projectId && 
                 firebaseConfig.projectId !== 'your-project-id';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore
export const db = initializeFirestore(app, {}, firebaseConfig.databaseId);

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
