import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyC95_wRrJKUkFvrOKVRXagY_86loxRHTIA',
  authDomain: 'blinkiefash-18d9f.firebaseapp.com',
  projectId: 'blinkiefash-18d9f',
  storageBucket: 'blinkiefash-18d9f.appspot.com',
  messagingSenderId: '492570746016',
  appId: '1:492570746016:web:e7556df79ebcd15eedbdc5',
  measurementId: 'G-XV1MY35TES',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
