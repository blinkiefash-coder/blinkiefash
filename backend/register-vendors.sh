#!/bin/bash

# Register two vendors via API

BASE_URL="http://localhost:3001/api/vendor"

echo "🚀 Registering vendors via API..."
echo ""

# Vendor 1: Manjulagrand
echo "📍 Vendor 1: Manjulagrand"
curl -X POST "$BASE_URL/register" \
  -F "business_name=Manjula Grand" \
  -F "owner_name=Manjula Grand" \
  -F "email=Manjulagrand@blinkiefash.in" \
  -F "phone=+919876543210" \
  -F "password=Manjula@121216" \
  -F "business_type=retail" \
  -F "category=Fashion" \
  -F "store_name=Manjula Grand" \
  -F "description=Manjula Grand Store" \
  -F "address=Cuttack, Odisha" \
  -F "city=Cuttack" \
  -F "state=Odisha" \
  -F "pincode=753001" \
  -F "lat=20.3768252" \
  -F "lng=85.8877655" \
  -F "account_holder_name=Manjula Grand" \
  -F "bank_name=AXIS Bank" \
  -F "ifsc_code=AXIS0000000" \
  2>/dev/null | jq '.success, .message, .vendor_id' || echo "Registration attempt submitted"

echo ""
echo "---"
echo ""

# Vendor 2: Crimson Club Cuttack
echo "📍 Vendor 2: Crimson Club Cuttack"
curl -X POST "$BASE_URL/register" \
  -F "business_name=Crimson Club Cuttack" \
  -F "owner_name=Crimson Club Cuttack" \
  -F "email=Crimsouneclubcuttack@blinkiefash.in" \
  -F "phone=+919876543211" \
  -F "password=Crimcuttack@121216" \
  -F "business_type=retail" \
  -F "category=Fashion" \
  -F "store_name=Crimson Club Cuttack" \
  -F "description=Crimson Club Cuttack Store" \
  -F "address=Cuttack, Odisha" \
  -F "city=Cuttack" \
  -F "state=Odisha" \
  -F "pincode=753001" \
  -F "lat=20.4703600" \
  -F "lng=85.8875637" \
  -F "account_holder_name=Crimson Club Cuttack" \
  -F "bank_name=AXIS Bank" \
  -F "ifsc_code=AXIS0000000" \
  2>/dev/null | jq '.success, .message, .vendor_id' || echo "Registration attempt submitted"

echo ""
echo "✅ Vendor registration requests sent!"
echo ""
echo "Credentials:"
echo "1. Email: Manjulagrand@blinkiefash.in | Password: Manjula@121216"
echo "2. Email: Crimsouneclubcuttack@blinkiefash.in | Password: Crimcuttack@121216"
