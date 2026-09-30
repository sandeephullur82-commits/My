import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function run() {
  const users = await admin.auth().getUsers([{email: 'pigmycollector@gmail.com'}]);
  if (users.users.length > 0) {
    console.log("Found user UID:", users.users[0].uid);
  } else {
    console.log("User not found.");
  }
}

run().catch(console.error);
