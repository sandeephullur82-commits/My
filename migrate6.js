import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runMigration() {
  console.log("Starting migration 3...");
  
  const customersGroup = await db.collectionGroup('customers').get();
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
  
  for (const doc of customersGroup.docs) {
    const data = doc.data();
    const updates = {};
    let needsUpdate = false;
    
    if (!data.createdAt) {
      updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
      needsUpdate = true;
    }
    if (!data.updatedAt) {
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      needsUpdate = true;
    }
    if (data.isPinned === undefined) {
      // Optional, but might be nice to initialize
      // updates.isPinned = false;
    }
    
    // Ensure displayId is set if it's missing but we can infer it
    if (!data.displayId && data.id && data.id.startsWith('CUST-')) {
       updates.displayId = data.id;
       needsUpdate = true;
    }
    
    if (needsUpdate) {
      batch.update(doc.ref, updates);
      batchCount++;
      await commitBatchIfNeeded();
    }
  }
  
  for (const doc of entriesGroup.docs) {
    const data = doc.data();
    const updates = {};
    let needsUpdate = false;
    
    if (!data.createdAt) {
      updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
      needsUpdate = true;
    }
    if (!data.updatedAt) {
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      needsUpdate = true;
    }
    
    if (data.isDeleted === undefined) {
      updates.isDeleted = false;
      needsUpdate = true;
    }
    
    if (!data.customerId && doc.ref.parent.parent && doc.ref.parent.parent.id.startsWith('CUST-')) {
       // Wait, entries might be inside users/{uid}/entries/{id}
       // So customerId should be available
       console.log(`Warning: Entry ${doc.id} missing customerId`);
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
  
  console.log("Migration 3 complete.");
}

runMigration().catch(console.error);
