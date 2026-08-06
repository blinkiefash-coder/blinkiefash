const { Delivery, DeliveryTracking, Rider } = require('../models');
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const { sendPush } = require('../utils/firebase');
const { getRoadDistance } = require('../utils/distance');

// ── Push the customer a status notification by orderId ──────────────────────
const CUSTOMER_STATUS_MESSAGES = {
  out_for_delivery: { title: '🛵 Out for delivery', body: 'Your order is on the way! Track it live in the app.' },
  picked:           { title: '🛍️ Picked up',         body: 'Our rider has picked up your order from the store.' },
  delivered:        { title: '🎉 Delivered!',       body: 'Your order has been delivered. Thanks for shopping with us!' },
  trial_started:    { title: '👕 Try & Buy started', body: 'Your trial has started. Decide within the time window.' },
  cancelled:        { title: '❌ Order cancelled',   body: 'Your order has been cancelled.' },
};

async function notifyCustomerOfOrderStatus(orderId, status) {
  if (!CUSTOMER_STATUS_MESSAGES[status] || !orderId) return;
  try {
    const rows = await sequelize.query(
      `SELECT u.fcm_token
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = :orderId`,
      { replacements: { orderId }, type: QueryTypes.SELECT }
    );
    if (!rows.length || !rows[0].fcm_token) return;
    const { title, body } = CUSTOMER_STATUS_MESSAGES[status];
    await sendPush(rows[0].fcm_token, {
      title,
      body,
      data: { type: 'order_status', orderId: String(orderId), status },
    });
  } catch (err) {
    console.error('[notifyCustomerOfOrderStatus]', err.message);
  }
}

exports.getDeliveries = async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        d.id, d.status, d.delivery_fee, d.distance, d.started_at, d.is_active,
        o.id          AS order_id,
        o.status      AS order_status,
        o.total_amount,
        o.confirmed_at,
        a.address_line, a.city, a.pincode,
        a.lat         AS drop_lat, a.lng AS drop_lng,
        ds.name       AS store_name, ds.address AS store_address,
        ds.lat        AS store_lat,  ds.lng AS store_lng,
        u.name        AS customer_name, u.phone AS customer_phone,
        COALESCE((
          SELECT json_agg(json_build_object(
            'name', p.name, 'size', v.size, 'color', v.color, 'qty', oi.quantity
          ) ORDER BY oi.id)
          FROM order_items oi
          JOIN product_variants v ON v.id = oi.variant_id
          JOIN products p ON p.id = v.product_id
          WHERE oi.order_id = o.id
        ), '[]') AS items
      FROM deliveries d
      JOIN orders o      ON o.id  = d.order_id
      JOIN addresses a   ON a.id  = o.address_id
      LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
      JOIN users u       ON u.id  = o.user_id
      WHERE d.rider_id = :riderId
      ORDER BY d.started_at DESC
    `, { replacements: { riderId: req.user.id }, type: QueryTypes.SELECT });
    res.json(rows);
  } catch (err) {
    console.error('getDeliveries error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Available orders (confirmed, no active delivery yet) ─────────────────────
exports.getAvailableOrders = async (req, res) => {
  try {
    const riderId = req.user.id;
    const rows = await sequelize.query(`
      SELECT
        o.id, o.status, o.total_amount, o.created_at,
        a.address_line, a.city, a.pincode,
        a.lat AS drop_lat, a.lng AS drop_lng,
        ds.name AS store_name, ds.address AS store_address,
        ds.lat  AS store_lat,  ds.lng AS store_lng,
        u.name  AS customer_name, u.phone AS customer_phone,
        json_agg(json_build_object(
          'name', p.name, 'size', v.size, 'color', v.color, 'qty', oi.quantity
        ) ORDER BY oi.id) AS items,
        dist_calc.km AS distance,
        CASE
          WHEN dist_calc.km IS NULL THEN 59
          WHEN dist_calc.km <=  5  THEN 59
          WHEN dist_calc.km <= 10  THEN 69
          WHEN dist_calc.km <= 15  THEN 79
          WHEN dist_calc.km <= 20  THEN 89
          WHEN dist_calc.km <= 25  THEN 99
          ELSE 109
        END AS delivery_fee
      FROM orders o
      JOIN addresses a    ON a.id  = o.address_id
      LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
      JOIN users u         ON u.id  = o.user_id
      JOIN order_items oi  ON oi.order_id = o.id
      JOIN product_variants v ON v.id = oi.variant_id
      JOIN products p      ON p.id = v.product_id
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN a.lat IS NOT NULL AND a.lng IS NOT NULL
                 AND ds.lat IS NOT NULL AND ds.lng IS NOT NULL
            THEN ROUND(
              (6371 * acos(GREATEST(-1, LEAST(1,
                cos(radians(ds.lat)) * cos(radians(a.lat)) *
                cos(radians(a.lng) - radians(ds.lng)) +
                sin(radians(ds.lat)) * sin(radians(a.lat))
              ))) * 1.6)::numeric, 1)
            ELSE NULL
          END AS km
      ) dist_calc
      CROSS JOIN (
        SELECT current_lat AS rider_lat, current_lng AS rider_lng
        FROM "Riders"
        WHERE id = :riderId
      ) rider_loc
      WHERE o.status = 'confirmed'
        AND NOT EXISTS (
          SELECT 1 FROM deliveries d
          WHERE d.order_id = o.id AND d.is_active = TRUE
        )
        AND rider_loc.rider_lat IS NOT NULL
        AND rider_loc.rider_lng IS NOT NULL
        AND ds.lat IS NOT NULL
        AND ds.lng IS NOT NULL
        AND (
          6371 * acos(GREATEST(-1.0, LEAST(1.0,
            cos(radians(ds.lat)) * cos(radians(rider_loc.rider_lat)) *
            cos(radians(rider_loc.rider_lng) - radians(ds.lng)) +
            sin(radians(ds.lat)) * sin(radians(rider_loc.rider_lat))
          ))) * 1.6
        ) <= 7
      GROUP BY o.id, a.address_line, a.city, a.pincode, a.lat, a.lng,
               ds.name, ds.address, ds.lat, ds.lng, u.name, u.phone, dist_calc.km,
               rider_loc.rider_lat, rider_loc.rider_lng
      ORDER BY o.created_at ASC
    `, { replacements: { riderId }, type: QueryTypes.SELECT });
    res.json({ success: true, orders: rows });
  } catch (err) {
    console.error('getAvailableOrders error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Atomic accept — only one rider wins ──────────────────────────────────────
exports.acceptOrder = async (req, res) => {
  const { orderId } = req.params;
  const riderId = req.user.id;
  const t = await sequelize.transaction();
  try {
    // Lock the order row to prevent race conditions
    const rows = await sequelize.query(
      `SELECT id, status FROM orders WHERE id = :orderId FOR UPDATE`,
      { replacements: { orderId }, type: QueryTypes.SELECT, transaction: t }
    );
    if (!rows.length || rows[0].status !== 'confirmed') {
      await t.rollback();
      return res.status(409).json({ success: false, message: 'Order no longer available' });
    }

    // Check if already taken (belt-and-suspenders)
    const existing = await sequelize.query(
      `SELECT id FROM deliveries WHERE order_id = :orderId AND is_active = TRUE LIMIT 1`,
      { replacements: { orderId }, type: QueryTypes.SELECT, transaction: t }
    );
    if (existing.length) {
      await t.rollback();
      return res.status(409).json({ success: false, message: 'Order already taken by another rider' });
    }

    // ── Calculate distance & rider payout ────────────────────────────────────
    // Rider payout tiers: ≤5km ₹30 | ≤10km ₹40 | ≤15km ₹50 | ≤20km ₹60 | ≤25km ₹70 | >25km ₹80
    const geoRows = await sequelize.query(
      `SELECT a.lat AS drop_lat, a.lng AS drop_lng,
              ds.lat AS store_lat, ds.lng AS store_lng
       FROM orders o
       JOIN addresses a ON a.id = o.address_id
       LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
       WHERE o.id = :orderId`,
      { replacements: { orderId }, type: QueryTypes.SELECT, transaction: t }
    );
    let distanceKm = null;
    let riderFee = 59; // base payout
    if (geoRows.length) {
      const { drop_lat, drop_lng, store_lat, store_lng } = geoRows[0];
      if (drop_lat && drop_lng && store_lat && store_lng) {
        const lat1 = parseFloat(store_lat), lon1 = parseFloat(store_lng);
        const lat2 = parseFloat(drop_lat),  lon2 = parseFloat(drop_lng);
        // Uses Google Distance Matrix API if GOOGLE_MAPS_API_KEY is set, else Haversine×1.6
        distanceKm = await getRoadDistance(lat1, lon1, lat2, lon2);
        if      (distanceKm <=  5) riderFee = 59;
        else if (distanceKm <= 10) riderFee = 69;
        else if (distanceKm <= 15) riderFee = 79;
        else if (distanceKm <= 20) riderFee = 89;
        else if (distanceKm <= 25) riderFee = 99;
        else                       riderFee = 109;
      }
    }

    // Create delivery record with 'assigned' — the first valid status per deliveries_status_check
    const delivery = await sequelize.query(
      `INSERT INTO deliveries (id, order_id, rider_id, status, started_at, is_active, delivery_fee, distance)
       VALUES (gen_random_uuid(), :orderId, :riderId, 'assigned', NOW(), TRUE, :riderFee, :distance)
       RETURNING id`,
      { replacements: { orderId, riderId, riderFee, distance: distanceKm }, type: QueryTypes.SELECT, transaction: t }
    );

    // Update order: assign rider + set status to 'out_for_delivery'
    await sequelize.query(
      `UPDATE orders SET status = 'out_for_delivery', rider_id = :riderId WHERE id = :orderId`,
      { replacements: { riderId, orderId }, type: QueryTypes.UPDATE, transaction: t }
    );

    await t.commit();

    const rider = await Rider.findByPk(riderId);
    if (rider?.fcm_token) {
      await sendPush(rider.fcm_token, {
        title: '✅ Order Accepted!',
        body: `Head to pickup. Your earning for this delivery: ₹${riderFee}`,
        data: { type: 'order_accepted', deliveryId: delivery[0].id },
      });
    }

    // Notify the customer that the order is on the way
    notifyCustomerOfOrderStatus(orderId, 'out_for_delivery').catch(() => {});

    res.json({ success: true, deliveryId: delivery[0].id, riderFee, distanceKm });
  } catch (err) {
    await t.rollback();
    console.error('acceptOrder error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await Delivery.update({ status }, { where: { id, rider_id: req.user.id } });
    // Cascade delivery status changes to the orders table
    const orderStatusMap = {
      picked:       'picked',          // rider picked up from store
      on_the_way:   'out_for_delivery', // heading to customer
      arrived:      'out_for_delivery', // at customer location
      completed:    'delivered',        // order delivered
    };
    if (orderStatusMap[status]) {
      await sequelize.query(
        `UPDATE orders SET status = :newStatus WHERE id = (
           SELECT order_id FROM deliveries WHERE id = :deliveryId
         )`,
        { replacements: { newStatus: orderStatusMap[status], deliveryId: id }, type: QueryTypes.UPDATE }
      );

      // Push the cascaded status to the customer
      const orderRows = await sequelize.query(
        `SELECT order_id FROM deliveries WHERE id = :deliveryId`,
        { replacements: { deliveryId: id }, type: QueryTypes.SELECT }
      );
      if (orderRows.length) {
        notifyCustomerOfOrderStatus(orderRows[0].order_id, orderStatusMap[status])
          .catch(() => {});
      }
    }
    // Credit earnings when delivery is completed
    if (status === 'completed') {
      const feeRow = await sequelize.query(
        `SELECT delivery_fee FROM deliveries WHERE id = :id`,
        { replacements: { id }, type: QueryTypes.SELECT }
      );
      const fee = parseFloat(feeRow[0]?.delivery_fee || 0);
      if (fee > 0) {
        await sequelize.query(
          `UPDATE "Riders" SET earnings_balance = COALESCE(earnings_balance,0) + :fee WHERE id = :riderId`,
          { replacements: { fee, riderId: req.user.id }, type: QueryTypes.UPDATE }
        );
        const { RiderPayout } = require('../models');
        await RiderPayout.create({
          rider_id: req.user.id, amount: fee,
          payout_date: new Date(), status: 'earned',
          reference: `delivery:${id}`,
        });
      }
    }
    // Push notification when an order is assigned to this rider
    if (status === 'assigned') {
      const rider = await Rider.findByPk(req.user.id);
      if (rider?.fcm_token) {
        await sendPush(rider.fcm_token, {
          title: '🛵 New Order Assigned!',
          body: 'You have a new delivery order. Tap to view details.',
          data: { type: 'order_assigned', deliveryId: id },
        });
      }
    }
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error('updateStatus error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLocation = async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  await DeliveryTracking.create({ delivery_id: id, lat, lng, recorded_at: new Date() });
  // Update rider's current position — "Riders" is the Sequelize table (uppercase)
  await sequelize.query(
    `UPDATE "Riders" SET current_lat = :lat, current_lng = :lng, last_active = NOW()
     WHERE user_id = :userId`,
    { replacements: { lat, lng, userId: req.user.id }, type: QueryTypes.UPDATE }
  );
  res.json({ message: 'Location updated' });
};

// ── Mark arrived: fetch existing OTP and push to customer ──────────────────────
exports.markArrived = async (req, res) => {
  const { id } = req.params; // delivery id
  try {
    // Only the owning rider may call this
    const rows = await sequelize.query(
      `SELECT d.order_id, o.user_id, o.delivery_otp, d.rider_id
       FROM deliveries d JOIN orders o ON o.id = d.order_id
       WHERE d.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Delivery not found' });
    if (rows[0].rider_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const { order_id, user_id, delivery_otp: otp } = rows[0];
    
    if (!otp) {
      console.warn(`⚠️  No delivery_otp found for order ${order_id}`);
      return res.status(400).json({ success: false, message: 'OTP not generated for this order' });
    }

    console.log(`📍 Rider arrived at customer location for order ${order_id}. Using existing OTP: ${otp}`);

    // Update delivery status to 'arrived'
    await sequelize.query(
      `UPDATE deliveries SET status = 'arrived' WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    );

    // Send push to customer with the OTP created at checkout — wrapped in try/catch
    try {
      const custRow = await sequelize.query(
        `SELECT fcm_token FROM users WHERE id = :userId`,
        { replacements: { userId: user_id }, type: QueryTypes.SELECT }
      );
      if (custRow.length && custRow[0].fcm_token) {
        await sendPush(custRow[0].fcm_token, {
          title: '🛵 Rider has arrived!',
          body: `Your delivery OTP is ${otp}. Show this to the rider.`,
          data: { type: 'rider_arrived', orderId: order_id, otp },
        }).catch(() => {});
      }
    } catch (_) { /* push is best-effort */ }

    console.log(`✅ Customer notified. OTP ${otp} visible on web vendor panel.`);
    res.json({ success: true, message: 'Marked arrived. OTP sent to customer.', delivery_otp: otp });
  } catch (err) {
    console.error('markArrived error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Verify OTP entered by rider ───────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  const { id } = req.params; // delivery id
  const { otp } = req.body;
  if (!otp || !/^\d{4}$/.test(String(otp)))
    return res.status(400).json({ success: false, message: 'Invalid OTP format' });
  try {
    const rows = await sequelize.query(
      `SELECT d.id, d.rider_id, o.id AS order_id, o.delivery_otp, o.is_try_order
       FROM deliveries d JOIN orders o ON o.id = d.order_id
       WHERE d.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Delivery not found' });
    const row = rows[0];
    if (row.rider_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });
    if (row.delivery_otp !== String(otp))
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });

    await sequelize.query(
      `UPDATE orders SET otp_verified_at = NOW() WHERE id = :orderId`,
      { replacements: { orderId: row.order_id }, type: QueryTypes.UPDATE }
    );

    res.json({ success: true, is_try_order: row.is_try_order ?? false });
  } catch (err) {
    console.error('verifyOtp error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Rider selects "try" or "buy" after OTP verified ──────────────────────────
exports.tryBuySelect = async (req, res) => {
  const { id } = req.params; // delivery id
  const { mode } = req.body; // 'try' | 'buy'
  if (!['try', 'buy'].includes(mode))
    return res.status(400).json({ success: false, message: 'mode must be "try" or "buy"' });
  try {
    const rows = await sequelize.query(
      `SELECT d.rider_id, d.order_id, o.otp_verified_at
       FROM deliveries d JOIN orders o ON o.id = d.order_id
       WHERE d.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Delivery not found' });
    const row = rows[0];
    if (row.rider_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (!row.otp_verified_at) return res.status(400).json({ success: false, message: 'OTP not verified yet' });

    if (mode === 'try') {
      const deadline = new Date(Date.now() + 15 * 60 * 1000);
      await sequelize.query(
        `UPDATE orders
         SET try_buy_mode = TRUE,
             try_buy_started_at = NOW(),
             try_buy_deadline   = :deadline,
             status = 'trial_started'
         WHERE id = :orderId`,
        { replacements: { orderId: row.order_id, deadline }, type: QueryTypes.UPDATE }
      );
      notifyCustomerOfOrderStatus(row.order_id, 'trial_started').catch(() => {});
      res.json({ success: true, mode: 'try', deadline });
    } else {
      // Direct buy — complete delivery + credit earnings
      await sequelize.query(
        `UPDATE orders SET status = 'delivered' WHERE id = :orderId`,
        { replacements: { orderId: row.order_id }, type: QueryTypes.UPDATE }
      );
      notifyCustomerOfOrderStatus(row.order_id, 'delivered').catch(() => {});
      await sequelize.query(
        `UPDATE deliveries SET status = 'completed', completed_at = NOW() WHERE id = :id`,
        { replacements: { id }, type: QueryTypes.UPDATE }
      );
      const feeRow = await sequelize.query(
        `SELECT delivery_fee FROM deliveries WHERE id = :id`,
        { replacements: { id }, type: QueryTypes.SELECT }
      );
      const fee = parseFloat(feeRow[0]?.delivery_fee || 0);
      if (fee > 0) {
        await sequelize.query(
          `UPDATE "Riders" SET earnings_balance = COALESCE(earnings_balance,0) + :fee WHERE id = :riderId`,
          { replacements: { fee, riderId: req.user.id }, type: QueryTypes.UPDATE }
        );
        const { RiderPayout } = require('../models');
        await RiderPayout.create({
          rider_id: req.user.id, amount: fee,
          payout_date: new Date(), status: 'earned',
          reference: `delivery:${id}`,
        });
      }
      res.json({ success: true, mode: 'buy' });
    }
  } catch (err) {
    console.error('tryBuySelect error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Record try & buy final decision (kept / returned) ────────────────────────
exports.tryBuyComplete = async (req, res) => {
  const { id } = req.params; // delivery id
  const { decision } = req.body; // 'kept' | 'returned'
  if (!['kept', 'returned'].includes(decision))
    return res.status(400).json({ success: false, message: 'decision must be "kept" or "returned"' });
  try {
    const rows = await sequelize.query(
      `SELECT d.rider_id, d.order_id FROM deliveries d WHERE d.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Delivery not found' });
    if (rows[0].rider_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const finalStatus = decision === 'kept' ? 'delivered' : 'cancelled';
    await sequelize.query(
      `UPDATE orders
       SET try_buy_decision = :decision,
           status = CASE WHEN :decision = 'kept' THEN 'delivered' ELSE 'cancelled' END
       WHERE id = :orderId`,
      { replacements: { decision, orderId: rows[0].order_id }, type: QueryTypes.UPDATE }
    );
    notifyCustomerOfOrderStatus(rows[0].order_id, finalStatus).catch(() => {});
    await sequelize.query(
      `UPDATE deliveries SET status = 'completed', completed_at = NOW() WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    );
    // Credit earnings on 'kept' (delivered), minimum cancellation fee on 'returned'
    const { RiderPayout } = require('../models');
    if (decision === 'kept') {
      const feeRow = await sequelize.query(
        `SELECT delivery_fee FROM deliveries WHERE id = :id`,
        { replacements: { id }, type: QueryTypes.SELECT }
      );
      const fee = parseFloat(feeRow[0]?.delivery_fee || 0);
      if (fee > 0) {
        await sequelize.query(
          `UPDATE "Riders" SET earnings_balance = COALESCE(earnings_balance,0) + :fee WHERE id = :riderId`,
          { replacements: { fee, riderId: rows[0].rider_id }, type: QueryTypes.UPDATE }
        );
        await RiderPayout.create({
          rider_id: rows[0].rider_id, amount: fee,
          payout_date: new Date(), status: 'earned',
          reference: `delivery:${id}`,
        });
      }
    } else if (decision === 'returned') {
      // Rider still gets a minimum return fee for effort (even if customer rejected items)
      const MIN_RETURN_FEE = 30;
      await sequelize.query(
        `UPDATE "Riders" SET earnings_balance = COALESCE(earnings_balance,0) + :fee WHERE id = :riderId`,
        { replacements: { fee: MIN_RETURN_FEE, riderId: rows[0].rider_id }, type: QueryTypes.UPDATE }
      );
      await RiderPayout.create({
        rider_id: rows[0].rider_id, amount: MIN_RETURN_FEE,
        payout_date: new Date(), status: 'earned',
        reference: `return:${id}`,
      });
    }
    res.json({ success: true, decision });
  } catch (err) {
    console.error('tryBuyComplete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get delivery detail (includes OTP status for customer polling) ────────────
exports.getDeliveryDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await sequelize.query(
      `SELECT d.id AS delivery_id, d.status AS delivery_status,
              d.store_pickup_otp, d.store_pickup_verified_at, d.delivery_photo_url,
              o.id AS order_id, o.status AS order_status,
              o.delivery_otp, o.otp_verified_at,
              o.is_try_order, o.try_buy_mode,
              o.try_buy_started_at, o.try_buy_deadline, o.try_buy_decision,
              o.created_at AS started_at, o.confirmed_at,
              o.total_amount, o.final_amount,
              a.lat AS drop_lat, a.lng AS drop_lng,
              a.address_line, a.city, a.pincode,
              u.name AS customer_name, u.phone AS customer_phone
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       LEFT JOIN addresses a ON a.id = o.address_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE d.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Mark arrived at dark store — generate store pickup OTP ───────────────────
exports.markStoreArrived = async (req, res) => {
  const { id } = req.params; // delivery id
  try {
    const rows = await sequelize.query(
      `SELECT d.rider_id, d.order_id FROM deliveries d WHERE d.id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Delivery not found' });
    if (rows[0].rider_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    // Generate 4-digit store OTP
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    console.log(`📍 Rider ${req.user.id} arrived at store. Generated OTP: ${otp} for delivery ${id}`);

    // Store OTP in deliveries using ALTER-safe approach with DO block
    // First try to update; if column doesn't exist it will silently fail and
    // we create the column. We use raw SQL with a fallback.
    try {
      await sequelize.query(
        `ALTER TABLE deliveries
         ADD COLUMN IF NOT EXISTS store_pickup_otp VARCHAR(4),
         ADD COLUMN IF NOT EXISTS store_pickup_verified_at TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT`,
        { type: QueryTypes.RAW }
      );
    } catch (_) { /* columns may already exist */ }

    await sequelize.query(
      `UPDATE deliveries SET store_pickup_otp = :otp WHERE id = :id`,
      { replacements: { otp, id }, type: QueryTypes.UPDATE }
    );

    // Verify the OTP was stored
    const verify = await sequelize.query(
      `SELECT store_pickup_otp FROM deliveries WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    console.log(`✓ Verified OTP stored in DB: ${verify[0]?.store_pickup_otp} (for delivery ${id})`);

    // Return OTP so store staff can see it
    res.json({ 
      success: true, 
      message: 'Store OTP generated. Give it to the rider.', 
      store_pickup_otp: otp 
    });
  } catch (err) {
    console.error('markStoreArrived error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Verify store pickup OTP entered by rider ──────────────────────────────────
exports.verifyStoreOtp = async (req, res) => {
  const { id } = req.params; // delivery id
  const { otp } = req.body;
  console.log(`🔐 Verifying store OTP for delivery ${id}. Rider entered: ${otp} (type: ${typeof otp})`);
  
  if (!otp || !/^\d{4}$/.test(String(otp)))
    return res.status(400).json({ success: false, message: 'Invalid OTP format' });
  try {
    const rows = await sequelize.query(
      `SELECT rider_id, store_pickup_otp FROM deliveries WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Delivery not found' });
    const row = rows[0];
    console.log(`📋 Retrieved from DB - OTP: "${row.store_pickup_otp}" (type: ${typeof row.store_pickup_otp}), Rider ID: ${row.rider_id}, Current user: ${req.user.id}`);
    
    if (row.rider_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Forbidden' });
    if (!row.store_pickup_otp || row.store_pickup_otp !== String(otp)) {
      console.log(`❌ OTP mismatch! Expected: "${row.store_pickup_otp}", Got: "${String(otp)}"`);
      return res.status(400).json({ success: false, message: 'Incorrect store OTP' });
    }

    console.log(`✅ OTP verified! Updating status to 'picked' for delivery ${id}`);
    await sequelize.query(
      `UPDATE deliveries SET store_pickup_verified_at = NOW(), status = 'picked' WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    );
    // Update order status to picked
    await sequelize.query(
      `UPDATE orders SET status = 'picked'
       WHERE id = (SELECT order_id FROM deliveries WHERE id = :id)`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    );

    res.json({ success: true, message: 'Store pickup confirmed' });
  } catch (err) {
    console.error('verifyStoreOtp error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};


