import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runMigration() {
  console.log("Starting migration 4 (notifications)...");
  
  const notificationsGroup = await db.collectionGroup('notifications').get();
  
  let batch = db.batch();
  let batchCount = 0;
  
  async function commitBatchIfNeeded() {
    if (batchCount >= 400) {
      await batch.commit();
      batchCount = 0;
      batch = db.batch();
    }
  }
  
  for (const doc of notificationsGroup.docs) {
    const data = doc.data();
    const updates = {};
    let needsUpdate = false;
    
    if (data.id !== doc.id) {
      updates.id = doc.id;
      needsUpdate = true;
    }
    
    if (!data.createdAt) {
      updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
      needsUpdate = true;
    }
    if (data.isRead === undefined) {
      updates.isRead = false;
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
  
  console.log("Migration 4 complete.");
}

runMigration().catch(console.error);
