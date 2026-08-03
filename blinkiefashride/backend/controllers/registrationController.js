const { User, Rider, RiderDocument } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
  try {
    const {
      name,
      phone,
      password,
      vehicle_type,
      vehicle_number,
      license_number,
      vehicleType,
      vehicleNumber,
      licenseNumber,
      documentType,
      documentUrl,
    } = req.body;

    const normalizedVehicleType = vehicle_type || vehicleType || 'Bike';
    const normalizedVehicleNumber = vehicle_number || vehicleNumber || null;
    const normalizedLicenseNumber = license_number || licenseNumber || null;
    const normalizedDocumentType = documentType || 'license';
    const normalizedDocumentUrl = documentUrl || null;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create user
    const user = await User.create({
      name,
      phone,
      password: hashedPassword,
      role: 'rider',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    // Create rider in Riders table
    const rider = await Rider.create({
      user_id: user.id,
      vehicle_type: normalizedVehicleType,
      vehicle_number: normalizedVehicleNumber,
      license_number: normalizedLicenseNumber,
      is_verified: false,
      is_available: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create rider document record for verification
    await RiderDocument.create({
      rider_id: rider.id,
      user_id: user.id,
      document_type: normalizedDocumentType,
      document_url: normalizedDocumentUrl,
      document_value: normalizedLicenseNumber,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Auto-login after registration
    const token = jwt.sign({ id: rider.id, userId: user.id, role: 'rider' }, process.env.JWT_SECRET || 'secret');
    res.json({ token, name: user.name });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};
