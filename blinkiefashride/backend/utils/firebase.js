const admin = require('firebase-admin');

let firebaseApp;

// Parse Firebase private key from environment
function parsePrivateKey(keyString) {
  if (!keyString) return null;
  
  // Try as JSON string first (if wrapped in quotes)
  if (keyString.startsWith('"') && keyString.endsWith('"')) {
    try {
      return JSON.parse(keyString);
    } catch (e) {
      // Not JSON, continue
    }
  }
  
  // Replace literal \n with actual newlines
  return keyString.replace(/\\n/g, '\n');
}

// Initialize Firebase Admin if credentials are available
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    if (!admin.apps.length) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
        }),
      });
      console.log('Firebase Admin initialized successfully');
    }
  } catch (err) {
    console.error('Firebase initialization failed:', err.message);
  }
}

// Send push notification
async function sendPush(fcmToken, { title, body, data = {} }) {
  if (!fcmToken || !firebaseApp) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    });
  } catch (err) {
    console.error('FCM error:', err.message);
  }
}

module.exports = { sendPush };
``