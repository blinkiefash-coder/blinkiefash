const Sequelize = require('sequelize');
const { sequelize } = require('../db');

const Rider = sequelize.define('Rider', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  user_id: { type: Sequelize.UUID, allowNull: false },
  vehicle_type: Sequelize.STRING,
  vehicle_number: Sequelize.STRING,
  license_number: Sequelize.STRING,
  is_available: Sequelize.BOOLEAN,
  is_verified: Sequelize.BOOLEAN,
  current_lat: Sequelize.DECIMAL,
  current_lng: Sequelize.DECIMAL,
  last_active: Sequelize.DATE,
  earnings_balance: { type: Sequelize.DECIMAL(12,2), defaultValue: 0 },
  fcm_token: Sequelize.STRING,
}, {
  tableName: 'Riders',
  timestamps: true,   // DB has camelCase createdAt/updatedAt columns
  underscored: false, // do NOT convert to snake_case
});

module.exports = Rider;