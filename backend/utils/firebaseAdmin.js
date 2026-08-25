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
 * Logs errors if sending fails.
 */
export async function sendPush(fcmToken, { title, body, data = {} }) {
  if (!fcmToken) {
    console.warn('[sendPush] No fcmToken provided, skipping notification');
    return;
  }
  try {
    initializeFirebaseAdmin();
    const isVendorNewOrder = String(data?.type || '') === 'vendor_new_order';
    const stringData = Object.fromEntries(
      Object.entries({ ...data, title, body }).map(([k, v]) => [k, String(v)])
    );

    const payload = {
      token: fcmToken,
      data: stringData,
      android: {
        priority: 'high',
        notification: isVendorNewOrder
            ? {
                channelId: 'blinkiefash_vendor_orders_ring_v2',
                priority: 'max',
                sound: 'default',
                defaultSound: true,
                defaultVibrateTimings: true,
                notificationCount: 1,
                tag: `vendor-order-${String(data?.orderId || '')}`,
              }
            : {
                channelId: 'blinkiefash_orders_v2',
                priority: 'max',
                sound: 'default',
              },
      },
      apns: {
        payload: {
          aps: isVendorNewOrder
              ? {
                  alert: { title, body },
                  sound: 'default',
                  'thread-id': `vendor-order-${String(data?.vendorId || '')}`,
                }
              : {
                  alert: { title, body },
                  sound: 'default',
                },
        },
      },
      // Vendor new-order messages are data-only so the app's background
      // handler can show them with full alarm sound. Customer messages keep
      // the notification block so the OS shows them when app is killed.
      ...(isVendorNewOrder ? {} : { notification: { title, body } }),
    };

    await admin.messaging().send(payload);
  } catch (err) {
    console.error('[sendPush] Error sending notification:', err.message);
  }
}

/**
 * Notify available riders (is_available=true) who are within 7 km of the
 * order's darkstore about a new order.
 * Uses the shared Neon DB — same DB as blinkiefashride backend.
 */
export async function notifyAvailableRiders(pool, orderId) {
  try {
    // "Riders" is the Sequelize-created table (uppercase); 'riders' lowercase is empty migration table
    // Only notify riders whose current location is within 7 km (road-adjusted) of the darkstore
    const { rows } = await pool.query(
      `SELECT r.fcm_token
       FROM "Riders" r
       JOIN orders o ON o.id = $1
       JOIN dark_stores ds ON ds.id = o.dark_store_id
       WHERE r.is_available = TRUE
         AND r.fcm_token IS NOT NULL
         AND r.fcm_token != ''
         AND r.current_lat IS NOT NULL
         AND r.current_lng IS NOT NULL
         AND ds.lat IS NOT NULL
         AND ds.lng IS NOT NULL
         AND (
           6371 * acos(GREATEST(-1.0, LEAST(1.0,
             cos(radians(ds.lat)) * cos(radians(r.current_lat)) *
             cos(radians(r.current_lng) - radians(ds.lng)) +
             sin(radians(ds.lat)) * sin(radians(r.current_lat))
           ))) * 1.6
         ) <= 7`,
      [orderId]
    );
    await Promise.all(rows.map(r => sendPush(r.fcm_token, {
      title: '🛵 New Order Available!',
      body: 'A new delivery order is waiting near you. Go online to accept it.',
      data: { type: 'order_available', orderId: String(orderId) },
    })));
  } catch (err) {
    console.error('[notifyAvailableRiders] error:', err.message);
  }
}

/**
 * Notify available riders (is_available=true) who are within 7 km of a
 * newly created parcel delivery request's pickup point.
 * Uses the shared Neon DB — same DB as blinkiefashride backend.
 */
export async function notifyRidersOfNewParcel(pool, requestId, pickupLat, pickupLng) {
  try {
    if (pickupLat == null || pickupLng == null) return;
    const { rows } = await pool.query(
      `SELECT r.fcm_token
       FROM "Riders" r
       WHERE r.is_available = TRUE
         AND r.fcm_token IS NOT NULL
         AND r.fcm_token != ''
         AND r.current_lat IS NOT NULL
         AND r.current_lng IS NOT NULL
         AND (
           6371 * acos(GREATEST(-1.0, LEAST(1.0,
             cos(radians($1)) * cos(radians(r.current_lat)) *
             cos(radians(r.current_lng) - radians($2)) +
             sin(radians($1)) * sin(radians(r.current_lat))
           ))) * 1.6
         ) <= 7`,
      [Number(pickupLat), Number(pickupLng)]
    );
    await Promise.all(rows.map(r => sendPush(r.fcm_token, {
      title: '📦 New Parcel Available!',
      body: 'A new parcel delivery request is waiting near you.',
      data: { type: 'parcel_available', requestId: String(requestId) },
    })));
  } catch (err) {
    console.error('[notifyRidersOfNewParcel] error:', err.message);
  }
}

export async function notifyVendorOfNewOrder(pool, orderId) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT u.fcm_token, v.id AS vendor_id, v.store_name
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants pv ON pv.id = oi.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id = p.vendor_id
       JOIN order_vendor_offers ovo
         ON ovo.order_id = o.id
        AND ovo.vendor_id = v.id
        AND ovo.status = 'offered'
       JOIN users u ON u.id = v.user_id
       WHERE o.id = $1
         AND u.fcm_token IS NOT NULL
         AND u.fcm_token != ''`,
      [orderId]
    );

    await Promise.all(rows.map((row) => sendPush(row.fcm_token, {
      title: '🛒 New order received',
      body: `Order placed for ${row.store_name || 'your store'}. Open vendor app to confirm.`,
      data: {
        type: 'vendor_new_order',
        orderId: String(orderId),
        vendorId: String(row.vendor_id),
      },
    })));
  } catch (err) {
    console.error('[notifyVendorOfNewOrder] error:', err.message);
  }
}

// ── Customer push helpers ───────────────────────────────────────────────────
const STATUS_MESSAGES = {
  placed:           { title: '🧾 Order placed',     body: 'Your order has been received. We\'ll start preparing it shortly.' },
  confirmed:        { title: '✅ Order confirmed',  body: 'Your order is confirmed and a rider will be assigned soon.' },
  packed:           { title: '📦 Packed & ready',   body: 'Your order is packed and ready for pickup.' },
  picked:           { title: '🛍️ Picked up',         body: 'Our rider has picked up your order from the store.' },
  out_for_delivery: { title: '🛵 Out for delivery', body: 'Your order is on the way! Track it live in the app.' },
  trial_started:    { title: '👕 Try & Buy started', body: 'Your trial has started. Decide within the time window.' },
  trial_completed:  { title: '✅ Trial completed',  body: 'Your try & buy decision has been recorded.' },
  delivered:        { title: '🎉 Delivered!',       body: 'Your order has been delivered. Thanks for shopping with us!' },
  completed:        { title: '🎉 Order completed',  body: 'Your order is complete. Thanks for shopping with us!' },
  cancelled:        { title: '❌ Order cancelled',  body: 'Your order has been cancelled.' },
};

export async function notifyCustomerOfStatus(pool, orderId, status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const message =
    STATUS_MESSAGES[normalizedStatus] ?? {
      title: '📦 Order updated',
      body: `Your order status is now ${normalizedStatus.replaceAll('_', ' ')}.`,
    };
  try {
    const { rows } = await pool.query(
      `SELECT u.fcm_token
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [orderId]
    );
    if (!rows.length) {
      console.warn(`[notifyCustomerOfStatus] No user found for orderId: ${orderId}`);
      return;
    }
    if (!rows[0].fcm_token) {
      console.warn(`[notifyCustomerOfStatus] Customer has no FCM token for orderId: ${orderId}`);
      return;
    }
    const { title, body } = message;
    console.log(`[notifyCustomerOfStatus] Sending "${title}" notification for orderId: ${orderId}`);
    await sendPush(rows[0].fcm_token, {
      title,
      body,
      data: { type: 'order_status', orderId: String(orderId), status: normalizedStatus },
    });
  } catch (err) {
    console.error('[notifyCustomerOfStatus] error:', err.message);
  }
}

export async function notifyCustomer(pool, userId, payload) {
  try {
    const { rows } = await pool.query(
      `SELECT fcm_token FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length || !rows[0].fcm_token) return;
    await sendPush(rows[0].fcm_token, payload);
  } catch (err) {
    console.error('[notifyCustomer] error:', err.message);
  }
}
