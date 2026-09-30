const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();
async function check() {
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const customers = await db.collection('users').doc(user.id).collection('customers').get();
    for (const doc of customers.docs) {
      const data = doc.data();
      if (typeof data.phone !== 'string') {
        console.log(`id: ${doc.id}, phone: ${data.phone} (${typeof data.phone})`);
      }
    }
  }
}
check().then(() => process.exit(0));
