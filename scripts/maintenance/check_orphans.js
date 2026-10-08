import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runCheck() {
  const customersGroup = await db.collectionGroup('customers').get();
  const validCustomers = new Set();
  
  customersGroup.docs.forEach(doc => {
    validCustomers.add(doc.id);
  });
  
  const entriesGroup = await db.collectionGroup('entries').get();
  let orphanCount = 0;
  let batch = db.batch();
  
  for (const doc of entriesGroup.docs) {
    const data = doc.data();
    if (!validCustomers.has(data.customerId)) {
      console.log(`Orphan entry found: ${doc.id} references missing customer ${data.customerId}`);
      orphanCount++;
      // Optional: Delete or flag orphan
      batch.update(doc.ref, { isDeleted: true, _orphan: true });
    }
  }
  
  if (orphanCount > 0) {
    await batch.commit();
    console.log(`Flagged ${orphanCount} orphan entries.`);
  } else {
    console.log("No orphan entries found.");
  }
}

runCheck().catch(console.error);
