#!/usr/bin/env node

// Generate password hashes for vendor creation
const crypto = require('crypto');

const vendors = [
  {
    email: 'Manjulagrand@blinkiefash.in',
    password: 'Manjula@121216'
  },
  {
    email: 'Crimsouneclubcuttack@blinkiefash.in',
    password: 'Crimcuttack@121216'
  }
];

console.log('\n🔐 PASSWORD HASH GENERATOR\n');
console.log('Copy the hash values below into the SQL file:\n');
console.log('---\n');

vendors.forEach((vendor) => {
  // Generate scrypt hash
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(vendor.password, salt, 64).toString('hex');
  const hash = `scrypt:s=16:N=16384:r=8:p=1$${salt}$${derived}`;
  
  console.log(`Email: ${vendor.email}`);
  console.log(`Password: ${vendor.password}`);
  console.log(`Hash:\n${hash}\n`);
  console.log('---\n');
});

console.log('Update CREATE_VENDORS.sql with these hashes in the password_hash fields.');
