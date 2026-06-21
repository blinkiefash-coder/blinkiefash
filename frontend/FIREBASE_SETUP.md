# Firebase Setup Guide for BlinkieFash

## What You Need to Share

Share **only these 9 values** from your Firebase project:

### Frontend (`.env.local`)
1. **VITE_FIREBASE_API_KEY** - Your Firebase API key
2. **VITE_FIREBASE_AUTH_DOMAIN** - Usually `your-project-id.firebaseapp.com`
3. **VITE_FIREBASE_PROJECT_ID** - Your project ID
4. **VITE_FIREBASE_STORAGE_BUCKET** - Usually `your-project-id.appspot.com`
5. **VITE_FIREBASE_MESSAGING_SENDER_ID** - Sender ID (numeric)
6. **VITE_FIREBASE_APP_ID** - App ID

### Backend (`.env`)
7. **FIREBASE_PROJECT_ID** - Same as above
8. **FIREBASE_CLIENT_EMAIL** - Service account email
9. **FIREBASE_PRIVATE_KEY** - Service account private key (multiline, escape newlines with `\n`)

---

## How to Get These Values

### Step 1: Get Frontend Config (Web App Config)
1. Go to **Firebase Console** → your project
2. Click **Project Settings** (gear icon, top left)
3. Click **"Your apps"** section
4. Find your **Web app** (should be listed, or create one if missing)
5. Copy the entire config object:
   ```javascript
   {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   }
   ```
6. Fill frontend `.env.local` with these values

### Step 2: Get Backend Config (Service Account Key)
1. Go to **Firebase Console** → your project
2. Click **Project Settings** (gear icon)
3. Click **"Service Accounts"** tab
4. Click **"Generate New Private Key"** button
5. A JSON file downloads → Open it
6. Copy these 3 values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (paste as-is, it has `\n` already)
7. Fill backend `.env` with these values

### Step 3: Enable Phone Auth in Firebase
1. Firebase Console → **Authentication** (left menu)
2. Click **"Sign-in method"** tab
3. Click **"Phone"** provider
4. Toggle **Enable** ✓
5. **Add Test Phone Numbers** (for development):
   - Click **"Phone numbers for testing"**
   - Add test numbers like: `+919876543210`
   - Set OTP: `123456`
   - This skips real SMS during testing
6. Save

### Step 4: Add Localhost to Authorized Domains
1. Firebase Console → **Authentication** (left menu)
2. Click **"Settings"** tab
3. Under **"Authorized domains"**, click **"Add domain"**
4. Add: `localhost`
5. Save

---

## After Setup

1. Copy frontend values to: `/frontend/.env.local`
   ```
   VITE_FIREBASE_API_KEY=abc123...
   VITE_FIREBASE_AUTH_DOMAIN=myproject.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=myproject
   VITE_FIREBASE_STORAGE_BUCKET=myproject.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
   ```

2. Copy backend values to: `/backend/.env`
   ```
   FIREBASE_PROJECT_ID=myproject
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@myproject.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n
   DATABASE_URL=postgresql://...
   ```

3. **Restart both servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

4. Test at `http://localhost:5173/login`
   - Use a phone from your Neon `users` table
   - OTP will be `123456` (because we added test number above)

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `auth/invalid-api-key` | Check VITE_FIREBASE_API_KEY is correct and auth enabled |
| `auth/operation-not-allowed` | Enable Phone auth in Firebase Console |
| `auth/invalid-phone-number` | Ensure phone is +91 prefix for India or use test number |
| `auth/too-many-requests` | Wait 5 mins or use test phone number |
| `FIREBASE_PROJECT_ID undefined` in backend | Check `.env` file exists with correct values |

---

## What to Share with Me

Just reply with these 9 values:
```
API_KEY: ___________
AUTH_DOMAIN: ___________
PROJECT_ID: ___________
STORAGE_BUCKET: ___________
SENDER_ID: ___________
APP_ID: ___________
CLIENT_EMAIL: ___________
PRIVATE_KEY: ___________
```

Or paste the Firebase web config + service account JSON download.
