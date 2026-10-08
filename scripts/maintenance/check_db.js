const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const db = admin.firestore();

async function check() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.docs.length} users.`);
  
  for (const user of users.docs) {
    console.log(`User: ${user.id}`);
    const collections = await user.ref.listCollections();
    for (const col of collections) {
      console.log(`  Collection: ${col.id}`);
      const docs = await col.limit(1).get();
      if (!docs.empty) {
        console.log(`    Sample:`, docs.docs[0].data());
      }
    }
  }
}

check().then(() => process.exit(0)).catch(console.error);
