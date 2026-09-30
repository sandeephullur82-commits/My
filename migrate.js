import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runMigration() {
  console.log("Starting migration...");
  
  const usersRef = db.collection('users');
  const usersSnap = await usersRef.get();
  
  console.log(`Found ${usersSnap.size} users.`);
  
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    console.log(`\nMigrating user: ${uid}`);
    
    const customersRef = usersRef.doc(uid).collection('customers');
    const entriesRef = usersRef.doc(uid).collection('entries');
    
    const customersSnap = await customersRef.get();
    const entriesSnap = await entriesRef.get();
    
    console.log(`  Found ${customersSnap.size} customers and ${entriesSnap.size} entries.`);
    
    // First, map customers by ID
    const customers = {};
    customersSnap.docs.forEach(doc => {
      customers[doc.id] = { id: doc.id, ...doc.data(), ref: doc.ref };
    });
    
    // Process entries and calculate totals
    const customerTotals = {};
    Object.keys(customers).forEach(id => {
      customerTotals[id] = { paid: 0, pending: customers[id].loan || customers[id].loanAmount || 0, hasChanges: false };
    });
    
    const batch = db.batch();
    let batchCount = 0;
    
    async function commitBatchIfNeeded() {
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    for (const doc of entriesSnap.docs) {
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
        console.log(`  Updating entry ${doc.id}`);
        batch.update(doc.ref, updates);
        batchCount++;
        await commitBatchIfNeeded();
      }
    }
    
    // Process customers
    for (const doc of customersSnap.docs) {
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
      
      if (!data.createdBy) {
        updates.createdBy = uid;
        needsUpdate = true;
      }
      
      if (data.isDeleted === undefined) {
        updates.isDeleted = false;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        console.log(`  Updating customer ${doc.id}`);
        batch.update(doc.ref, updates);
        batchCount++;
        await commitBatchIfNeeded();
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
  }
  
  console.log("Migration complete.");
}

runMigration().catch(console.error);
