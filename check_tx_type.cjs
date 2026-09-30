const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();
async function check() {
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const entries = await db.collection('users').doc(user.id).collection('entries').get();
    for (const doc of entries.docs) {
      const data = doc.data();
      if (typeof data.type !== 'string') {
        console.log(`id: ${doc.id}, type: ${data.type} (${typeof data.type})`);
      }
    }
  }
}
check().then(() => process.exit(0));
