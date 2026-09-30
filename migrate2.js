import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runMigration() {
  console.log("Starting migration...");
  
  const customersGroup = await db.collectionGroup('customers').get();
  const entriesGroup = await db.collectionGroup('entries').get();
  
  console.log(`Found ${customersGroup.size} customers and ${entriesGroup.size} entries across all users.`);
  
  const batch = db.batch();
  let batchCount = 0;
  
  async function commitBatchIfNeeded() {
    if (batchCount >= 400) {
      await batch.commit();
      batchCount = 0;
    }
  }
  
  const customerTotals = {};
  
  // Initialize totals
  customersGroup.docs.forEach(doc => {
    const data = doc.data();
    const loan = Number(data.loan) || 0;
    customerTotals[doc.id] = { 
      paid: 0, 
      pending: loan, 
      loan: loan, 
      ref: doc.ref 
    };
  });
  
  for (const doc of entriesGroup.docs) {
    const data = doc.data();
    const updates = {};
    let needsUpdate = false;
    
    // Ensure id matches
    if (data.id !== doc.id) {
      updates.id = doc.id;
      needsUpdate = true;
    }
    
    // Fix types
    let type = data.type;
    let status = data.status;
    
    if (type === 'not_paid') {
      type = 'unsettled';
      needsUpdate = true;
    }
    if (status === 'not_paid') {
      status = 'unsettled';
      needsUpdate = true;
    }
    
    if (type !== data.type) updates.type = type;
    if (status !== data.status) updates.status = status;
    
    // Ensure amount is number
    if (typeof data.amount !== 'number') {
      updates.amount = Number(data.amount) || 0;
      needsUpdate = true;
    }
    
    const amt = updates.amount !== undefined ? updates.amount : data.amount;
    const stat = updates.status !== undefined ? updates.status : data.status;
    const typ = updates.type !== undefined ? updates.type : data.type;
    
    // Update totals
    if (stat === 'paid' && typ !== 'unsettled' && !data.isDeleted) {
      if (data.customerId && customerTotals[data.customerId]) {
        customerTotals[data.customerId].paid += amt;
      }
    }
    
    // Ensure date exists
    if (!data.date && data.timestamp) {
      updates.date = new Date(data.timestamp).toISOString().slice(0, 10);
      needsUpdate = true;
    }
    
    if (!data.timestamp) {
      updates.timestamp = data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : Date.now();
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      batch.update(doc.ref, updates);
      batchCount++;
      await commitBatchIfNeeded();
    }
  }
  
  for (const doc of customersGroup.docs) {
    const data = doc.data();
    const updates = {};
    let needsUpdate = false;
    
    if (data.id !== doc.id) {
      updates.id = doc.id;
      needsUpdate = true;
    }
    
    // Trim name and phone
    const name = data.name ? String(data.name).trim() : '';
    const phone = data.phone ? String(data.phone).replace(/\D/g, '').trim() : '';
    
    if (name !== data.name) {
      updates.name = name;
      needsUpdate = true;
    }
    if (phone !== data.phone) {
      updates.phone = phone;
      needsUpdate = true;
    }
    
    // uniqueKey
    const uniqueKey = `${name.toLowerCase()}_${phone}`;
    if (data.uniqueKey !== uniqueKey) {
      updates.uniqueKey = uniqueKey;
      needsUpdate = true;
    }
    
    // Ensure numbers
    const loan = Number(data.loan) || 0;
    if (loan !== data.loan) {
      updates.loan = loan;
      updates.loanAmount = loan;
      needsUpdate = true;
    }
    if (data.loanAmount === undefined) {
      updates.loanAmount = loan;
      needsUpdate = true;
    }
    
    let startDate = data.startDate;
    if (typeof startDate !== 'number') {
      startDate = new Date(startDate).getTime();
      if (isNaN(startDate)) startDate = Date.now();
      updates.startDate = startDate;
      needsUpdate = true;
    }
    
    let endDate = data.endDate;
    if (typeof endDate !== 'number') {
      endDate = new Date(endDate).getTime();
      if (isNaN(endDate)) endDate = Date.now();
      updates.endDate = endDate;
      needsUpdate = true;
    }
    
    // Update totals
    const totals = customerTotals[doc.id];
    if (totals) {
      const expectedPending = loan - totals.paid;
      if (data.paid !== totals.paid || data.pending !== expectedPending) {
        updates.paid = totals.paid;
        updates.pending = expectedPending;
        needsUpdate = true;
      }
    }
    
    // createdBy missing => use uid from path (users/{uid}/customers/{id})
    if (!data.createdBy) {
      const uid = doc.ref.parent.parent.id;
      updates.createdBy = uid;
      needsUpdate = true;
    }
    
    if (data.isDeleted === undefined) {
      updates.isDeleted = false;
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
  
  console.log("Migration complete.");
}

runMigration().catch(console.error);
