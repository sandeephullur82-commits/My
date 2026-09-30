import admin from 'firebase-admin';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
async function run() {
  const list = await admin.auth().listUsers();
  list.users.forEach(u => console.log(u.email, u.uid));
}
run().catch(console.error);
