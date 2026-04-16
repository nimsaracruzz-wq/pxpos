/**
 * Reset device lock for a license key.
 * Use this when a customer changes their PC or to fix dev testing issues.
 *
 * Usage: node scripts/reset-device.js PX-XXXX-XXXX-XXXX
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAXL7uGGsIXNbwHHnNkr0D2zfvU4E8Cmc8',
  authDomain:        'pxpos-7d777.firebaseapp.com',
  projectId:         'pxpos-7d777',
  storageBucket:     'pxpos-7d777.firebasestorage.app',
  messagingSenderId: '759604307830',
  appId:             '1:759604307830:web:09668e1b4e2ff4740cbc57',
}

const key = process.argv[2]
if (!key) {
  console.error('\n❌ Please provide a license key.')
  console.error('   Usage: node scripts/reset-device.js PX-XXXX-XXXX-XXXX\n')
  process.exit(1)
}

const app = initializeApp(FIREBASE_CONFIG)
const db  = getFirestore(app)

await setDoc(doc(db, 'licenses', key.toUpperCase()), {
  deviceId:    null,
  activatedAt: null,
  lastSeen:    null,
}, { merge: true })

console.log(`\n✅ Device lock reset for: ${key.toUpperCase()}`)
console.log('   Customer can now activate on any PC.\n')
process.exit(0)
