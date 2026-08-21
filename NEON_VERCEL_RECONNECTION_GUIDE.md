# Neon ↔ Vercel/Render Reconnection Guide

## Current Status
- **Backend**: Node.js (Express)
- **Database**: Neon PostgreSQL
- **Deployment**: Vercel (frontend) + Render/Vercel (backend)
- **Connection Type**: Neon Pooler (TCP connection pooling)

---

## Step 1: Check Your Neon Database Status

### Via Neon Console:
1. Go to [console.neon.tech](https://console.neon.tech)
2. Login with your credentials
3. Select your project → "Blinkiefash" or your project name
4. Check:
   - ✅ Database status (should be "Available", not "Suspended")
   - ✅ Compute status (check if compute is on)
   - ✅ Storage usage (make sure you're not over quota)

### Via Terminal (if database is running):
```bash
# From the SatyXAlka directory
cd backend
npm install  # ensure dependencies are installed
node -e "import('./db.js').then(({pool})=>pool.query('SELECT NOW()').then(r=>console.log('✅ Connected:',r.rows[0])).catch(e=>console.error('❌ Error:',e.message)))"
```

---

## Step 2: Get Fresh Neon Connection String

### If Neon is Available:
1. Go to **Neon Console** → Your Project
2. Click **"Connection string"** or **"Pooler Connection"**
3. Copy the connection string (should look like):
   ```
   postgresql://neondb_owner:npg_XXXXXXX@ep-xxxxx-pooler.c-x.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

### If Database is Suspended:
1. Click **"Resume"** button in Neon console
2. Wait 10-30 seconds for compute to spin up
3. Copy the connection string

### If You Need to Upgrade/Change Plan:
1. In Neon Console, go to **Settings** → **Billing**
2. Select your new plan
3. **After plan change**, go back to **Connection** and copy the new connection string
   - ⚠️ The connection string might change after plan upgrade
   - The old password/pooler endpoint may be invalidated

---

## Step 3: Update Environment Variables

### For Local Development:
```bash
# Update /backend/.env
DATABASE_URL=postgresql://your_user:your_password@your_host-pooler.c-5.us-east-1.aws.neon.tech/your_db?sslmode=require&channel_binding=require
```

### For Vercel (Frontend API):
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **blinkiefash** project
3. Click **Settings** → **Environment Variables**
4. Add/Update:
   - `DATABASE_URL` = (Neon connection string from Step 2)
5. Click **Save**
6. **Redeploy** the project (manually trigger deployment)

### For Render (Backend API):
1. Go to [render.com/dashboard](https://render.com/dashboard)
2. Select your backend service (e.g., "blinkiefash-backend")
3. Click **Environment** → **Update Environment Variables**
4. Add/Update:
   - `DATABASE_URL` = (Neon connection string from Step 2)
5. Click **Save**
6. Service will **auto-redeploy** (watch the "Latest Deploy" section)

### For Vercel (Backend API):
If you're using Vercel for backend:
1. Go to **Vercel Dashboard** → Select backend project
2. **Settings** → **Environment Variables**
3. Update `DATABASE_URL` with fresh Neon connection string
4. **Redeploy**

---

## Step 4: Verify Connection

### Check Render/Vercel Logs:
1. **Render**: Dashboard → Select service → **Logs** tab
2. **Vercel**: Dashboard → Select project → **Deployments** → Click latest → **Logs**
3. Look for success message:
   ```
   Database connected successfully
   Tables ensured
   ```
4. ❌ If you see `ECONNREFUSED` or `ETIMEDOUT`:
   - Verify connection string in environment variables
   - Check Neon compute is running
   - Restart the service (Render: click "Manual Deploy", Vercel: trigger redeploy)

### Test API Endpoint:
```bash
# Replace YOUR_BACKEND_URL with your actual backend URL
curl https://YOUR_BACKEND_URL/api/health

# Or test a simple endpoint
curl https://YOUR_BACKEND_URL/api/products/count
```

---

## Step 5: Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **"connect ECONNREFUSED"** | Neon compute is off. Resume it in console. |
| **"connection timeout"** | Firewall/IP issue. Neon allows all IPs by default; check if connection string is correct. |
| **"password authentication failed"** | Connection string is outdated after plan change. Get fresh one from Neon console. |
| **"Database is suspended"** | Your trial expired or plan downgraded. Upgrade or resume in Neon console. |
| **"SSL certificate problem"** | Ensure `sslmode=require` is in connection string. Our db.js adds this automatically. |
| **Vercel shows "Function completed without explicit return value"** | Database query failed. Check backend logs in Vercel dashboard. |

---

## Step 6: Reconnection Checklist

- [ ] Neon console shows database as "Available"
- [ ] Neon compute is running (not suspended)
- [ ] Fresh connection string copied from Neon
- [ ] Vercel environment variable updated with new DATABASE_URL
- [ ] Render environment variable updated with new DATABASE_URL
- [ ] Vercel deployment redeployed (or auto-redeployed)
- [ ] Render service auto-redeployed
- [ ] Backend logs show successful database connection
- [ ] API endpoints responding (test with curl)
- [ ] Frontend can fetch data from backend

---

## Current Configuration Files

### Backend Database Connection (`backend/db.js`):
```javascript
// Uses DATABASE_URL from environment
// Automatically adds sslmode=require for Neon
// SSL certificates are configured for Neon pooler
```

### Environment Variables Location:
- Local: `/backend/.env`
- Vercel (Frontend): Settings → Environment Variables
- Render (Backend): Environment → Environment Variables

---

## Support

If reconnection fails after following these steps:
1. Check Neon status at [console.neon.tech](https://console.neon.tech)
2. Verify connection string format matches:
   ```
   postgresql://[user]:[password]@[host]-pooler.c-5.us-east-1.aws.neon.tech/[database]?sslmode=require&channel_binding=require
   ```
3. Check backend logs for specific error messages
4. Verify firewall/network settings allow Neon connection

