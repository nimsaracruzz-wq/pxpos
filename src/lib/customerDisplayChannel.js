const CUSTOMER_DISPLAY_KEY = 'paxxmo.customer.display'
const CUSTOMER_DISPLAY_EVENT = 'paxxmo:customer-display:update'
const CUSTOMER_DISPLAY_SETTINGS_KEY = 'paxxmo.customer.display.settings'
const CUSTOMER_DISPLAY_SETTINGS_EVENT = 'paxxmo:customer-display:settings:update'

function parsePayload(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function getCustomerDisplayPayload() {
  if (typeof window === 'undefined') return null
  return parsePayload(window.localStorage.getItem(CUSTOMER_DISPLAY_KEY))
}

export function publishCustomerDisplay(payload) {
  if (typeof window === 'undefined') return
  const nextPayload = {
    ...payload,
    updatedAt: Date.now(),
  }
  window.localStorage.setItem(CUSTOMER_DISPLAY_KEY, JSON.stringify(nextPayload))
  window.dispatchEvent(new CustomEvent(CUSTOMER_DISPLAY_EVENT, { detail: nextPayload }))
}

export function clearCustomerDisplay() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CUSTOMER_DISPLAY_KEY)
  window.dispatchEvent(new CustomEvent(CUSTOMER_DISPLAY_EVENT, { detail: null }))
}

export function getCustomerDisplaySettings() {
  if (typeof window === 'undefined') return null
  return parsePayload(window.localStorage.getItem(CUSTOMER_DISPLAY_SETTINGS_KEY))
}

export function publishCustomerDisplaySettings(payload) {
  if (typeof window === 'undefined') return
  const nextPayload = {
    ...payload,
    updatedAt: Date.now(),
  }
  window.localStorage.setItem(CUSTOMER_DISPLAY_SETTINGS_KEY, JSON.stringify(nextPayload))
  window.dispatchEvent(new CustomEvent(CUSTOMER_DISPLAY_SETTINGS_EVENT, { detail: nextPayload }))
}

export function clearCustomerDisplaySettings() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CUSTOMER_DISPLAY_SETTINGS_KEY)
  window.dispatchEvent(new CustomEvent(CUSTOMER_DISPLAY_SETTINGS_EVENT, { detail: null }))
}

export function subscribeCustomerDisplay(listener) {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event) => {
    if (event.key !== CUSTOMER_DISPLAY_KEY) return
    listener(parsePayload(event.newValue))
  }

  const onLocalEvent = (event) => {
    listener(event.detail || null)
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(CUSTOMER_DISPLAY_EVENT, onLocalEvent)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CUSTOMER_DISPLAY_EVENT, onLocalEvent)
  }
}

export function subscribeCustomerDisplaySettings(listener) {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event) => {
    if (event.key !== CUSTOMER_DISPLAY_SETTINGS_KEY) return
    listener(parsePayload(event.newValue))
  }

  const onLocalEvent = (event) => {
    listener(event.detail || null)
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(CUSTOMER_DISPLAY_SETTINGS_EVENT, onLocalEvent)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CUSTOMER_DISPLAY_SETTINGS_EVENT, onLocalEvent)
  }
}
