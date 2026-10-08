import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runInspect() {
  const customersGroup = await db.collectionGroup('customers').get();
  for (const doc of customersGroup.docs) {
    if (!doc.ref.parent.parent) {
      console.log(`Customer ${doc.id} has no parent! Path: ${doc.ref.path}`);
    }
  }
}

runInspect().catch(console.error);
