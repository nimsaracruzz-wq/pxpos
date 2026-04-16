/**
 * Paxxmo POS — License Key Generator
 * ====================================
 * Run this script to create new license keys for customers.
 *
 * Usage:
 *   node scripts/create-license.js
 *
 * Requirements:
 *   npm install firebase (already installed)
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { randomBytes } from 'crypto'

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAXL7uGGsIXNbwHHnNkr0D2zfvU4E8Cmc8',
  authDomain:        'pxpos-7d777.firebaseapp.com',
  projectId:         'pxpos-7d777',
  storageBucket:     'pxpos-7d777.firebasestorage.app',
  messagingSenderId: '759604307830',
  appId:             '1:759604307830:web:09668e1b4e2ff4740cbc57',
}

// ── License details — edit these before running ──────────────────────────────
const LICENSE = {
  businessName: 'Kandy Supermart',        // ← Customer business name
  email:        'owner@kandymart.com',    // ← Customer email
  plan:         'basic',                  // ← basic | pro | enterprise
  expiresAt:    '2027-12-31',            // ← Expiry date (or null for lifetime)
  active:       true,
}
// ─────────────────────────────────────────────────────────────────────────────

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const rand  = (n) => Array.from({ length: n }, () => chars[randomBytes(1)[0] % chars.length]).join('')
  return `PX-${rand(4)}-${rand(4)}-${rand(4)}`
}

async function main() {
  const app = initializeApp(FIREBASE_CONFIG)
  const db  = getFirestore(app)
  const key = generateKey()

  await setDoc(doc(db, 'licenses', key), {
    ...LICENSE,
    createdAt:   new Date().toISOString(),
    activatedAt: null,
    deviceId:    null,   // set automatically when customer first activates
    lastSeen:    null,
  })

  console.log('\n✅ License key created successfully!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Key:      ${key}`)
  console.log(`  Business: ${LICENSE.businessName}`)
  console.log(`  Plan:     ${LICENSE.plan}`)
  console.log(`  Expires:  ${LICENSE.expiresAt || 'Never (Lifetime)'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n📋 Send this key to your customer!\n')
  process.exit(0)
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
