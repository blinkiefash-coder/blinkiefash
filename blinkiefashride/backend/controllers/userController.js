const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: 'Phone and password required' });
    const user = await User.findOne({ where: { phone } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret'
    );
    res.json({ token, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};