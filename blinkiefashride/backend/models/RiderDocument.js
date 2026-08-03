const Sequelize = require('sequelize');
const { sequelize } = require('../db');

const RiderDocument = sequelize.define('RiderDocument', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  rider_id: { type: Sequelize.UUID, allowNull: false },
  user_id: { type: Sequelize.UUID, allowNull: true }, // Allow NULL for existing rows, will be updated
  document_type: Sequelize.STRING,
  document_url: Sequelize.TEXT,
  document_value: Sequelize.TEXT,
  status: { type: Sequelize.STRING, defaultValue: 'pending' },
  created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
  updated_at: Sequelize.DATE,
}, {
  tableName: 'rider_documents',
  timestamps: false,
});

module.exports = RiderDocument;
