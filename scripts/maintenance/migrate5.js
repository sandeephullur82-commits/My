import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runMigration() {
  console.log("Starting migration 2...");
  const entriesGroup = await db.collectionGroup('entries').get();
  
  let batch = db.batch();
  let batchCount = 0;
  
  async function commitBatchIfNeeded() {
    if (batchCount >= 400) {
      await batch.commit();
      batchCount = 0;
      batch = db.batch();
    }
  }
  
  for (const doc of entriesGroup.docs) {
    const data = doc.data();
    const updates = {};
    let needsUpdate = false;
    
    if (data.status === 'paid' && !data.paidAt) {
      updates.paidAt = data.timestamp || data.createdAt || Date.now();
      needsUpdate = true;
    }
    
    if (data.status === 'unsettled' && !data.unsettledAt) {
      updates.unsettledAt = data.timestamp || data.createdAt || Date.now();
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      batch.update(doc.ref, updates);
      batchCount++;
      await commitBatchIfNeeded();
    }
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log("Migration 2 complete.");
}

runMigration().catch(console.error);
