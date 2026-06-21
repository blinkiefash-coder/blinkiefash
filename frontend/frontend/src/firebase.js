import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

let auth = null

if (hasFirebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig)
    auth = getAuth(app)
  } catch (error) {
    console.error('Firebase initialization failed:', error)
  }
} else {
  console.error('Firebase config is missing. Check VITE_FIREBASE_* environment variables.')
}

export { auth }
