# Blinkiefash Rider App - Deployment Guide

## Current Status ✅

- ✅ Backend code cleaned and pushed to GitHub: `https://github.com/blinkiefash-coder/blinkiefash-rider-backend.git`
- ✅ Firebase credentials fixed
- ✅ Flutter app API service updated to use `https://blinkiefash-rider-backend.onrender.com`
- ⏳ Backend deployment to Render **PENDING**

## Step 1: Deploy Backend to Render

### Prerequisites
- Have the Render dashboard open: https://dashboard.render.com
- GitHub account with access to: `https://github.com/blinkiefash-coder/blinkiefash-rider-backend.git`

### Deployment Instructions

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign in with your GitHub account

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Select "Deploy an existing repository"
   - Paste repository URL: `https://github.com/blinkiefash-coder/blinkiefash-rider-backend.git`
   - Click "Connect"

3. **Configure Service**
   - **Name**: `blinkiefash-rider-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free tier (for testing)

4. **Add Environment Variables**
   
   Add these variables in the Render dashboard:

   | Key | Value |
   |-|-|
   | `DATABASE_URL` | `postgresql://neondb_owner:npg_yw6RXdt0sKvB@ep-falling-block-amfecyj6-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
   | `JWT_SECRET` | `blinkiefashride_secret_key` |
   | `PORT` | `5001` |
   | `NODE_ENV` | `production` |
   | `FIREBASE_PROJECT_ID` | `blinkiefash-18d9f` |
   | `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@blinkiefash-18d9f.iam.gserviceaccount.com` |
   | `FIREBASE_PRIVATE_KEY` | (paste the private key from `.env`) |
   | `CLOUDINARY_CLOUD_NAME` | `dv6w0wyxk` |
   | `CLOUDINARY_API_KEY` | `894545237978256` |
   | `CLOUDINARY_API_SECRET` | `ioxpuWYEtxicrX6r98Bq1PjPopA` |

   ⚠️ **IMPORTANT**: When pasting `FIREBASE_PRIVATE_KEY`, make sure the newlines are preserved exactly as shown in the `.env` file.

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete (5-10 minutes)
   - You'll see a live link like: `https://blinkiefash-rider-backend.onrender.com`

### Verify Deployment

Once deployed, test the backend is working:

```bash
curl -X POST https://blinkiefash-rider-backend.onrender.com/rider/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rider",
    "phone": "9876543210",
    "password": "Test@123",
    "vehicleType": "Bike",
    "vehicleNumber": "ABC123",
    "licenseNumber": "DL123456",
    "documentType": "license",
    "documentUrl": null
  }'
```

Expected response: `{"token": "...", "name": "Test Rider"}`

## Step 2: Rebuild and Test Flutter App

Once backend is deployed:

1. **Rebuild Flutter App**
   ```bash
   cd /Users/sa40091223/Downloads/SatyXAlka/blinkiefashride
   flutter clean
   flutter pub get
   flutter run
   ```

2. **Test Registration Flow**
   - Open the app
   - Go to Sign Up
   - Fill in test data
   - Click "Register"
   - Expected: Successful registration with auto-login

3. **Test Login Flow**
   - Log out
   - Enter registered credentials
   - Click "Login"
   - Expected: Successful login with JWT token

## Troubleshooting

### "Server returned non-JSON response"
- Check Render deployment logs for errors
- Verify all environment variables are set correctly
- Ensure DATABASE_URL is valid

### Registration fails with 500 error
- Check backend logs on Render dashboard
- Verify Neon database connection
- Check Firebase credentials format

### App still connecting to old URL
- Verify `api_service.dart` has correct baseUrl
- Rebuild app with `flutter clean && flutter pub get`

## File Changes Made

1. **blinkiefashride/lib/api_service.dart**
   - Updated baseUrl from `https://blinkiefash.onrender.com` → `https://blinkiefash-rider-backend.onrender.com`
   - Added response validation for content-type checking

2. **blinkiefashride/backend/server.js**
   - Removed line that was clearing FIREBASE_PRIVATE_KEY

3. **blinkiefashride/backend/utils/firebase.js**
   - Re-enabled Firebase Admin initialization with proper error handling

4. **blinkiefashride/backend/render.yaml**
   - Added deployment configuration for Render

## Next Steps

1. Deploy backend to Render (this step)
2. Test backend endpoints
3. Rebuild Flutter app
4. Test end-to-end signup/login flow
5. Monitor for any runtime errors

---

**Questions?** Check the backend logs at: https://dashboard.render.com > Services > blinkiefash-rider-backend > Logs
