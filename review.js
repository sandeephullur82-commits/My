import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runReview() {
  const users = await db.collection('users').get();
  if (users.empty) {
    console.log("No users found");
    return;
  }
  
  const uid = users.docs[0].id;
  const customers = await db.collection(`users/${uid}/customers`).limit(1).get();
  if (!customers.empty) {
    console.log("Sample Customer:", JSON.stringify(customers.docs[0].data(), null, 2));
  }
  
  const entries = await db.collection(`users/${uid}/entries`).limit(1).get();
  if (!entries.empty) {
    console.log("Sample Entry:", JSON.stringify(entries.docs[0].data(), null, 2));
  }
}

runReview().catch(console.error);
