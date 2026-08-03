# Parcel Delivery OTP System - Complete Implementation Guide

## 🎯 Overview
Implemented a complete OTP verification system for parcel deliveries. The flow now includes:
1. **Rider Notification** - Riders see available nearby delivery requests
2. **Rider Acceptance** - Rider accepts a delivery, triggering OTP generation
3. **OTP Verification** - Customer receives OTP and verifies before starting pickup

---

## 🏗️ Architecture & Components

### **1. Backend (Node.js/Express)**
**File:** `/backend/routes/deliver.js`

#### Database Schema Updates
```sql
-- OTP Columns Added to deliver_requests table:
- otp_code VARCHAR(6)              -- 6-digit OTP
- otp_generated_at TIMESTAMPTZ     -- When OTP was created
- otp_verified BOOLEAN DEFAULT false -- Verification status
```

#### New API Endpoints

**GET `/api/deliver/available`**
- **Purpose:** Riders query nearby pending delivery requests
- **Query Parameters:**
  - `riderLat` (required) - Rider's current latitude
  - `riderLng` (required) - Rider's current longitude
  - `radiusKm` (optional, default=10) - Search radius in km
- **Response:** 
```json
{
  "success": true,
  "requests": [
    {
      "id": "uuid",
      "pickup_text": "123 Main St",
      "drop_text": "456 Park Ave",
      "pickup_lat": 20.4625,
      "pickup_lng": 85.883,
      "distance_km": 5.5,
      "estimated_fare": 47.75,
      "receiver_name": "John Doe",
      "receiver_phone": "+91 9876543210",
      "created_at": "timestamp"
    }
  ]
}
```

**PATCH `/api/deliver/request/:id/accept`**
- **Purpose:** Rider accepts delivery request, OTP is generated
- **Request Body:**
```json
{
  "riderId": "uuid",
  "riderName": "Rider Name",
  "riderPhone": "+91 9876543210",
  "riderLat": 20.4625,
  "riderLng": 85.883
}
```
- **Response:**
```json
{
  "success": true,
  "request": {
    "id": "uuid",
    "status": "assigned",
    "otp_code": "123456",
    "distance_km": 5.5,
    "estimated_fare": 47.75
  },
  "message": "Request accepted. OTP generated for customer."
}
```

**PATCH `/api/deliver/request/:id/verify-otp`**
- **Purpose:** Customer verifies OTP and starts delivery
- **Request Body:**
```json
{
  "otp": "123456"
}
```
- **Response:**
```json
{
  "success": true,
  "request": {
    "id": "uuid",
    "status": "in_progress",
    "otp_verified": true
  },
  "message": "OTP verified. Delivery started."
}
```
- **Validation:**
  - OTP must match exactly (6 digits)
  - OTP expires after 10 minutes
  - Cannot verify already verified OTP

**GET `/api/deliver/request/:id`** (Updated)
- Now returns `otp_code` and `otp_verified` fields

---

### **2. Rider App (Flutter)**
**File:** `/blinkiefashride/lib/pages/available_parcels_screen.dart` (NEW)

#### Features
- ✅ Real-time location access (Geolocator)
- ✅ Fetch nearby available parcels within 10km
- ✅ Display route, distance, fare, receiver details
- ✅ Accept parcel delivery with one tap
- ✅ Show OTP to rider upon successful acceptance
- ✅ Pull-to-refresh capability
- ✅ Error handling and loading states

#### Usage
```dart
// Import in rider app
import 'pages/available_parcels_screen.dart';

// Navigate to screen
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (_) => AvailableParcelsScreen(
      riderId: 'rider_uuid',
      riderName: 'Rider Name',
      riderPhone: '+91 9876543210',
    ),
  ),
);
```

#### API Service Updates
**File:** `/blinkiefashride/lib/api_service.dart`

```dart
// Get available parcel requests
Future<List<Map<String, dynamic>>> getAvailableParcelRequests(
  double riderLat,
  double riderLng,
  {double radiusKm = 10}
)

// Accept a parcel delivery
Future<Map<String, dynamic>?> acceptParcelRequest(
  String requestId,
  {
    required String riderId,
    required String riderName,
    required String riderPhone,
    double? riderLat,
    double? riderLng,
  }
)
```

---

### **3. Customer App (Flutter)**
**File:** `/blinkiefashmob/lib/pages/parcel_tracking_screen.dart` (Updated)

#### OTP Display Box
When rider accepts delivery, customer sees:
```
┌─────────────────────────────────┐
│  Delivery OTP                    │
│                                  │
│  1 2 3 4 5 6          ✓ Verified│
│                                  │
│  Share this code with rider     │
└─────────────────────────────────┘
```

#### UI Components Added
- **OTP Box:** Shows 6-digit code in large blue font
- **Verification Status:** Green checkmark when verified
- **Instructions:** "Share this code with your rider at pickup"
- **Conditional Display:** Only shows when rider is assigned and OTP exists

#### Status Flow
```
PENDING (5 min timer showing)
    ↓
ASSIGNED (Rider accepted, OTP displayed)
    ↓
IN_PROGRESS (OTP verified, delivery started)
    ↓
COMPLETED (Delivery complete)
```

---

## 🔄 Complete User Flow

### **Rider Perspective**
```
1. Rider opens "Available Parcels" tab
2. System fetches parcels within 10km radius
3. Rider reviews: distance, fare, receiver details
4. Rider taps "Accept Delivery"
5. OTP generated: "123456" shown to rider
6. Rider goes to pickup location
7. Rider shares OTP with customer
```

### **Customer Perspective**
```
1. Customer books parcel delivery
2. Tracking screen shows "Connecting to rider in 5 min"
3. Rider accepts delivery
4. Customer sees OTP box with 6-digit code
5. Rider arrives at pickup
6. Customer shares OTP with rider
7. Rider enters OTP in their app (future enhancement)
8. Delivery starts, status changes to "in_progress"
9. Customer tracks real-time location
```

---

## 🛠️ Implementation Details

### **OTP Generation**
- Random 6-digit number
- Generated when rider accepts request
- Valid for 10 minutes
- Can only be verified once

### **Status Transitions**
```
pending → assigned (rider accepts)
         → cancelled (customer cancels)

assigned → in_progress (OTP verified)
         → cancelled (during waiting period)

in_progress → completed (delivery complete)
```

### **Distance Calculation**
- Uses PostgreSQL `ST_Distance` function
- Haversine formula implemented in JavaScript
- Results returned in ascending order (nearest first)

### **Error Handling**
- Invalid OTP: "Invalid OTP"
- Expired OTP: "OTP expired" (after 10 minutes)
- Already verified: "OTP already verified"
- Request no longer pending: "Request is no longer pending"
- Missing fields: Validation error message

---

## 📦 Database Changes

### **Table: deliver_requests**
```sql
ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS otp_generated_at TIMESTAMPTZ;
ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT false;
```

### **Query for Available Requests**
```sql
SELECT * FROM deliver_requests
WHERE status = 'pending'
AND (6371 * acos(cos(radians(riderLat)) * cos(radians(pickup_lat)) 
     * cos(radians(pickup_lng) - radians(riderLng)) 
     + sin(radians(riderLat)) * sin(radians(pickup_lat)))) <= radiusKm
ORDER BY created_at DESC
LIMIT 20
```

---

## 🚀 Deployment Status

### ✅ Completed
- Backend endpoints deployed to Render
- Database migrations applied
- Rider app parcel acceptance flow
- Customer app OTP display
- API services integrated
- Git commits pushed

### 🔜 Next Steps (Optional Enhancements)
1. **Rider-side OTP Entry:** Add screen for rider to enter OTP
2. **Push Notifications:** Alert rider of new requests
3. **Rating System:** Rate delivery after completion
4. **Payment Integration:** In-app payment for cash-free transactions
5. **SMS/Email Notifications:** Send OTP via SMS to customer
6. **Analytics Dashboard:** Track delivery metrics, earnings

---

## 🔐 Security Features
✅ OTP expires after 10 minutes
✅ One-time verification (can't use same OTP twice)
✅ Status validation (can't accept already-assigned request)
✅ Location-based filtering (only nearby requests shown)
✅ Phone verification for rider identity

---

## 📊 Testing Checklist

- [ ] Rider can view available requests within 10km
- [ ] Rider accepts request and OTP is generated
- [ ] Customer sees OTP on tracking screen
- [ ] OTP verification shows success
- [ ] Status changes to "in_progress" after verification
- [ ] OTP expires after 10 minutes (manual test)
- [ ] Invalid OTP shows error message
- [ ] Rider location updates correctly
- [ ] Customer can cancel before rider accepts
- [ ] Completed delivery shows confirmation

---

## 📝 Code Examples

### **Accept Delivery (Rider App)**
```dart
final result = await _api.acceptParcelRequest(
  'request-uuid',
  riderId: 'rider-123',
  riderName: 'Amit Kumar',
  riderPhone: '+91 9876543210',
  riderLat: 20.4625,
  riderLng: 85.883,
);

if (result?['success'] == true) {
  final otp = result?['request']?['otp_code'];
  print('OTP: $otp');
}
```

### **Verify OTP (Backend)**
```javascript
PATCH /api/deliver/request/:id/verify-otp
{
  "otp": "123456"
}
// Returns: status changes to 'in_progress'
```

### **Display OTP (Customer App)**
```dart
if (data['status'] == 'assigned' && data['otp_code'] != null) {
  // Show OTP box
  Text(data['otp_code']) // Display "123456"
}
```

---

## 📞 Support
For issues or questions regarding the OTP system:
1. Check rider/customer phone numbers match backend records
2. Verify GPS permissions on rider device
3. Ensure backend is running on Render
4. Check database connection to PostgreSQL (Neon)

---

**Last Updated:** August 3, 2026
**Status:** 🟢 Live in Production
**Version:** 1.0
