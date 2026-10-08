const admin = require('firebase-admin');
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
  console.log("ADC initialized successfully.");
} catch (e) {
  console.error("ADC error:", e.message);
}
