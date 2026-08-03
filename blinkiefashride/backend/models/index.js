const Rider = require('./Rider');
const RiderDocument = require('./RiderDocument');
const RiderPayout = require('./RiderPayout');
const RiderReview = require('./RiderReview');
const RiderShift = require('./RiderShift');
const SupportTicket = require('./SupportTicket');
const Delivery = require('./Delivery');
const DeliveryTracking = require('./DeliveryTracking');
const Notification = require('./Notification');
const User = require('./User');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const OrderStatusLog = require('./OrderStatusLog');

// Define associations here if needed
// Example: Rider.hasMany(RiderPayout, { foreignKey: 'rider_id' });

module.exports = {
  Rider,
  RiderDocument,
  RiderPayout,
  RiderReview,
  RiderShift,
  SupportTicket,
  Delivery,
  DeliveryTracking,
  Notification,
  User,
  Order,
  OrderItem,
  OrderStatusLog,
};
