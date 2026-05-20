import admin from 'firebase-admin'

let firebaseAdminApp = null

const initializeFirebaseAdmin = () => {
  if (firebaseAdminApp) return firebaseAdminApp

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials in backend environment')
  }

  firebaseAdminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })

  return firebaseAdminApp
}

export const getFirebaseAdminAuth = () => {
  initializeFirebaseAdmin()
  return admin.auth()
}

/**
 * Send an FCM push to a single device token.
 * Silently ignores missing/expired tokens.
 */
export async function sendPush(fcmToken, { title, body, data = {} }) {
  if (!fcmToken) return;
  try {
    initializeFirebaseAdmin();
    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: { channelId: 'blinkiefash_orders', priority: 'max' },
      },
      apns: { payload: { aps: { alert: { title, body }, sound: 'default' } } },
    });
  } catch (_) {}
}

/**
 * Notify ALL available riders (is_available=true) about a new order.
 * Uses the shared Neon DB — same DB as blinkiefashride backend.
 */
export async function notifyAvailableRiders(pool, orderId) {
  try {
    // "Riders" is the Sequelize-created table (uppercase); 'riders' lowercase is empty migration table
    const { rows } = await pool.query(
      `SELECT r.fcm_token FROM "Riders" r
       WHERE r.is_available = TRUE AND r.fcm_token IS NOT NULL AND r.fcm_token != ''`
    );
    await Promise.all(rows.map(r => sendPush(r.fcm_token, {
      title: '🛵 New Order Available!',
      body: 'A new delivery order is waiting. Go online to accept it.',
      data: { type: 'order_available', orderId: String(orderId) },
    })));
  } catch (err) {
    console.error('[notifyAvailableRiders] error:', err.message);
  }
}
