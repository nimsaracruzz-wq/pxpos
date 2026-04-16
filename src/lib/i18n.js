import { useAppStore } from '@/store'
// Re-export useAppStore for tr() to call getState() directly
let _appStore = null
// Lazy store reference is set after module initialization
function getStore() {
  if (!_appStore) _appStore = useAppStore
  return _appStore
}

export const translations = {
  en: {
    // Nav
    nav_dashboard: 'Dashboard',
    nav_products: 'Products',
    nav_inventory: 'Inventory',
    nav_customers: 'Customers',
    nav_reports: 'Reports',
    nav_logs: 'Activity Logs',
    nav_pos: 'POS Terminal',
    nav_grn: 'Goods Receiving',
    nav_variants: 'Style & Variants',
    nav_labels: 'Print Labels',
    nav_rx: 'Rx Prescriptions',
    nav_batches: 'Batch & Expiry',
    nav_tables: 'Tables & KOT',
    nav_takeout: 'Take Out',
    nav_ledger: 'Customer Ledger',
    nav_weborders: 'Web Orders',
    nav_settings: 'Settings',
    nav_collapse: 'Collapse',
    nav_logout: 'Secure Logout',
    
    // Receipt
    rect_dinein: 'TABLE {0} — DINE IN',
    rect_takeout: '🛍️ TAKE OUT',
    rect_retail: '🏪 RETAIL SALE',
    rect_no: 'Receipt #',
    rect_date: 'Date',
    rect_time: 'Time',
    rect_cashier: 'Cashier',
    rect_waiter: 'Waiter',
    rect_customer: 'Customer',
    rect_subtotal: 'Subtotal',
    rect_discount: 'Discount',
    rect_vat: 'VAT',
    rect_total: 'TOTAL',
    rect_payment: 'Payment',
    rect_change: 'Change',
    rect_thanks_takeout: 'Thank you! Come again 🙏',
    rect_thanks_retail: 'Thank you for your business! 🙏',
    rect_label_dinein: 'Dine-In Receipt',
    rect_label_takeout: 'Take Out Receipt',
    rect_label_sale: 'Sale Receipt',
    rect_paid: 'Paid',
    rect_print: 'Print Receipt',
    rect_close: 'Close',

    // POS
    pos_scan: 'Scan barcode or search products... (F2 to focus)',
    pos_current_sale: 'Current Sale',
    pos_discount: 'Discount',
    pos_subtotal: 'Subtotal',
    pos_total: 'TOTAL',
    pos_cash: 'Cash',
    pos_card: 'Card',
    pos_split: 'Split',
    pos_charge: 'Charge',
  },
  si: {
    // Nav
    nav_dashboard: 'ප්‍රධාන පුවරුව',
    nav_products: 'භාණ්ඩ',
    nav_inventory: 'තොග',
    nav_customers: 'පාරිභෝගිකයින්',
    nav_reports: 'වාර්තා',
    nav_logs: 'ක්‍රියාකාරකම්',
    nav_pos: 'බිල්පත් පර්යන්තය',
    nav_grn: 'භාණ්ඩ භාරගැනීම්',
    nav_variants: 'වර්ග සහ විලාස',
    nav_labels: 'ලේබල් මුද්‍රණය',
    nav_rx: 'වෛද්‍ය නිර්දේශ',
    nav_batches: 'කාණ්ඩ සහ කල්ඉකුත්වීම්',
    nav_tables: 'මේස සහ කුස්සි නියෝග',
    nav_takeout: 'පාර්සල්',
    nav_ledger: 'ණය ගිණුම්',
    nav_weborders: 'අන්තර්ජාල ඇණවුම්',
    nav_settings: 'සැකසුම්',
    nav_collapse: 'හැකිලීමට',
    nav_logout: 'පිටවීම (Logout)',
    
    // Receipt
    rect_dinein: 'මේසය {0} — DINE IN',
    rect_takeout: '🛍️ පාර්සල්',
    rect_retail: '🏪 සිල්ලර විකුණුම්',
    rect_no: 'බිල්පත් අංකය',
    rect_date: 'දිනය',
    rect_time: 'වේලාව',
    rect_cashier: 'කැෂියර්',
    rect_waiter: 'වේටර්',
    rect_customer: 'පාරිභෝගිකයා',
    rect_subtotal: 'අනු එකතුව',
    rect_discount: 'වට්ටම',
    rect_vat: 'වැට් (VAT)',
    rect_total: 'මුළු මුදල (TOTAL)',
    rect_payment: 'ගෙවීම් ක්‍රමය',
    rect_change: 'ඉතිරි මුදල',
    rect_thanks_takeout: 'ස්තූතියි! නැවත එන්න 🙏',
    rect_thanks_retail: 'අප හා සම්බන්ධ වූවාට ස්තූතියි! 🙏',
    rect_label_dinein: 'අවන්හල් බිල්පත (Dine-In)',
    rect_label_takeout: 'පාර්සල් බිල්පත (Take Out)',
    rect_label_sale: 'විකුණුම් බිල්පත',
    rect_paid: 'ගෙවන ලදි',
    rect_print: 'බිල්පත මුද්‍රණය කරන්න',
    rect_close: 'වසන්න (Close)',

    // POS
    pos_scan: 'බාර්කෝඩ් ස්කෑන් කරන්න හෝ සොයන්න... (F2)',
    pos_current_sale: 'වත්මන් බිල්පත',
    pos_discount: 'වට්ටම',
    pos_subtotal: 'අනු එකතුව',
    pos_total: 'මුළු මුදල',
    pos_cash: 'මුදල්',
    pos_card: 'කාඩ්පත',
    pos_split: 'වෙනත්',
    pos_charge: 'ගෙවීම',
  }
}

export function useI18n() {
  const lang = useAppStore(s => s.language) || 'en'
  const t = (key, ...args) => {
    let str = translations[lang]?.[key] || translations.en[key] || key
    args.forEach((arg, i) => {
      str = str.replace(`{${i}}`, arg)
    })
    return str
  }
  return { t, lang }
}

/**
 * tr() — Static (non-hook) translation helper for use outside React components.
 * Reads the current language from the Zustand store snapshot.
 */
export function tr(key, ...args) {
  let lang = 'en'
  try {
    lang = getStore().getState().language || 'en'
  } catch {
    lang = 'en'
  }
  let str = translations[lang]?.[key] || translations.en[key] || key
  args.forEach((arg, i) => {
    str = str.replace(`{${i}}`, arg)
  })
  return str
}
