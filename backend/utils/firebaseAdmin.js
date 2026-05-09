import admin from 'firebase-admin'

let firebaseAdminApp = null

const initializeFirebaseAdmin = () => {
  if (firebaseAdminApp) return firebaseAdminApp

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials in backend environment')
  }

  firebaseAdminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })

  return firebaseAdminApp
}

export const getFirebaseAdminAuth = () => {
  initializeFirebaseAdmin()
  return admin.auth()
}
