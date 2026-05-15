import { useSalesStore, useElectronicsStore } from './src/store/index.js'

try {
  useSalesStore.getState().addSale({
    activeModule: 'electronics',
    source: 'electronics',
    cartItems: [
      { id: 'ep1', name: 'Samsung Galaxy A55', serial: 'TEST_SERIAL_123', warrantyMonths: 12 }
    ]
  })
  console.log("Sale added successfully!")
  const w = useElectronicsStore.getState().getWarrantyStatus('TEST_SERIAL_123')
  console.log("Warranty Check:", w)
} catch (err) {
  console.error("Error during addSale:", err)
}
