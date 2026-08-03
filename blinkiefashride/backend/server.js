// Allow self-signed / intermediate TLS certs (Neon DB + Cloudinary on local network)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
https.globalAgent.options.rejectUnauthorized = false;

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { sequelize } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


// Import routes
const riderRoutes = require('./routes/rider');
const deliveryRoutes = require('./routes/delivery');
const payoutRoutes = require('./routes/payout');
const reviewRoutes = require('./routes/review');
const shiftRoutes = require('./routes/shift');
const supportRoutes = require('./routes/support');
const notificationRoutes = require('./routes/notification');
const userRoutes = require('./routes/user');

// Register routes
app.use('/rider', riderRoutes);
app.use('/delivery', deliveryRoutes);
app.use('/payout', payoutRoutes);
app.use('/review', reviewRoutes);
app.use('/shift', shiftRoutes);
app.use('/support', supportRoutes);
app.use('/notification', notificationRoutes);
app.use('/user', userRoutes);
app.use('/upload', require('./routes/upload'));

const PORT = process.env.PORT || 5000;

// Test DB connection and sync
sequelize.authenticate()
  .then(() => {
    console.log('Database connected successfully');
    return sequelize.sync({ alter: { drop: false } });
  })
  .then(async () => {
    // Ensure columns used by getDeliveryDetail exist before any request comes in
    const { QueryTypes } = require('sequelize');
    await sequelize.query(
      `ALTER TABLE deliveries
       ADD COLUMN IF NOT EXISTS store_pickup_otp VARCHAR(4),
       ADD COLUMN IF NOT EXISTS store_pickup_verified_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT`,
      { type: QueryTypes.RAW }
    ).catch(() => {});
    
    // Populate NULL user_id values in rider_documents by looking up from riders
    await sequelize.query(
      `UPDATE rider_documents rd 
       SET user_id = r.user_id 
       FROM "Riders" r 
       WHERE rd.rider_id = r.id AND rd.user_id IS NULL`,
      { type: QueryTypes.UPDATE }
    ).catch((err) => console.log('Could not auto-update user_id:', err.message));
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });
