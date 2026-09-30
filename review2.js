import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runReview() {
  const customers = await db.collectionGroup('customers').limit(1).get();
  if (!customers.empty) {
    console.log("Sample Customer:", JSON.stringify(customers.docs[0].data(), null, 2));
  }
  
  const entries = await db.collectionGroup('entries').where('isDeleted', '==', false).limit(1).get();
  if (!entries.empty) {
    console.log("Sample Entry:", JSON.stringify(entries.docs[0].data(), null, 2));
  }
}

runReview().catch(console.error);
