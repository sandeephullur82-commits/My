import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runInspect() {
  const customersGroup = await db.collectionGroup('customers').get();
  for (const doc of customersGroup.docs) {
    console.log(doc.ref.path);
  }
}

runInspect().catch(console.error);
