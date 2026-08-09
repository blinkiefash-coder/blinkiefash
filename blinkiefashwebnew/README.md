# blinkiefashwebnew

A fresh web client for Blinkiefash, built to mirror the look, feel and core
flows of the `blinkiefashmob` Flutter app (60-minute delivery home feed,
categories, product detail with size variants, cart, wishlist, checkout,
orders and account/OTP login) using the same backend API as `frontend`.

## Getting started

```bash
npm install
npm run dev
```

By default the app talks to the deployed backend
(`https://blinkiefash.onrender.com`). To point at a local backend, create a
`.env.local` file:

```
VITE_API_BASE_URL=http://localhost:5000
```
