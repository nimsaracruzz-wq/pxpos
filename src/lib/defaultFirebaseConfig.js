export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAXL7uGGsIXNbwHHnNkr0D2zfvU4E8Cmc8',
  authDomain: 'pxpos-7d777.firebaseapp.com',
  projectId: 'pxpos-7d777',
  storageBucket: 'pxpos-7d777.firebasestorage.app',
  messagingSenderId: '759604307830',
  appId: '1:759604307830:web:09668e1b4e2ff4740cbc57',
  measurementId: 'G-N0F75CXC4W',
}

export function defaultFirebaseConfigJson() {
  return JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2)
}