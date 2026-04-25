import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(apiKey)

export async function generateInventoryForecast(products, sales) {
  if (!apiKey) {
    throw new Error('CeyAI API key is not configured in .env')
  }

  // Use the standard text-based model
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  // Clean data to fit in prompt easily and remove huge unnecessary objects
  const productData = products.map(p => ({
    id: p.id,
    name: p.name,
    stock: p.stock,
    price: p.price,
    cost: p.cost,
    expiry: p.expiry || null,
  }))

  const recentSales = sales.slice(0, 500).map(s => ({
    date: s.date,
    items: (s.cartItems || []).map(i => ({ 
      id: i.id, 
      name: i.name, 
      qty: i.qty 
    }))
  }))

  const prompt = `
    You are an expert retail supply chain AI for a POS system.
    Analyze this store's data to predict which items will run out of stock soon.

    Currently Active Products:
    ${JSON.stringify(productData)}

    Recent Sales (Last 500 transactions):
    ${JSON.stringify(recentSales)}

    Based on the sales velocity and current stock levels:
    1. Identify up to 10 products that are at risk of a stockout within the next 30 days.
    2. Recommend an order quantity that covers roughly 4 weeks of sales based on their velocity.
    
    IMPORTANT: You must return ONLY a raw JSON array. Do not include markdown formatting (like \`\`\`json).
    Use this exact format:
    [
      {
        "productId": "string",
        "productName": "string",
        "currentStock": number,
        "predictedDaysUntilStockout": number,
        "recommendedOrderQty": number,
        "reason": "string (brief explanation)"
      }
    ]
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    
    // Safely parse out any markdown if the model hallucinates it
    const cleanedText = text.replace(/```json/gi, '').replace(/```/gi, '').trim()
    return JSON.parse(cleanedText)
  } catch (err) {
    console.error('[AI] Forecast Generation Error:', err)
    throw new Error('Failed to generate forecast from CeyAI. Please check your API key and connection.')
  }
}

export async function generateDashboardInsights(sales, products) {
  if (!apiKey) {
    throw new Error('CeyAI API key is not configured in .env')
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  // Summarize sales by date to reduce token size
  const salesByDate = {}
  sales.forEach(s => {
    const d = new Date(s.date).toDateString()
    if (!salesByDate[d]) salesByDate[d] = { revenue: 0, transactions: 0, itemsSold: {} }
    salesByDate[d].revenue += s.total || 0
    salesByDate[d].transactions += 1
    ;(s.cartItems || []).forEach(item => {
      const name = item.name || 'Unknown'
      salesByDate[d].itemsSold[name] = (salesByDate[d].itemsSold[name] || 0) + (item.qty || 1)
    })
  })

  // Take the last 7 active days of data
  const recentDays = Object.keys(salesByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .slice(0, 7)
    .map(d => ({ date: d, ...salesByDate[d] }))

  const productData = products.map(p => ({
    name: p.name,
    stock: p.stock,
  }))

  const prompt = `
    You are an AI assistant for a POS (Point of Sale) system.
    Analyze the following sales data and generate a clear, business-friendly summary.
    
    Your output MUST include insights on:
    1. Best-selling items (daily/weekly/monthly)
    2. Dead stock (items with low or zero sales based on inventory data)
    3. Peak sales hours
    4. Customer trends (if possible)
    5. Profit insights

    IMPORTANT:
    - Generate output in BOTH English and Sinhala
    - Keep it short, simple, and actionable
    - Use a friendly business tone
    
    Sinhala should be natural and easy to understand.
    Use simple Sri Lankan Sinhala (not formal or literary).
    
    Example style:
    English: "Your coffee sales increased by 18% this week. Peak sales time is 8 AM to 10 AM. Sandwich sales are low and may need promotion."
    Sinhala: "මෙම සතියේ ඔබගේ කෝපි අලෙවිය 18% කින් වැඩිවී ඇත. වැඩිම අලෙවි වේලාව පෙ.ව. 8 සිට 10 දක්වාය. සැන්ඩ්විච් අලෙවිය අඩු බැවින් ප්‍රචාරයක් අවශ්‍ය විය හැක."

    Daily Sales Data (last 7 active days):
    ${JSON.stringify(recentDays)}

    Current Inventory Data:
    ${JSON.stringify(productData)}

    IMPORTANT: Return ONLY a raw JSON array of objects. No markdown formatting (\`\`\`json).
    Format EXACTLY like this:
    [
      {
        "type": "positive" | "negative" | "info" | "action",
        "title": "string (English title)",
        "description": "string (English description)",
        "titleSi": "string (Sinhala title)",
        "descriptionSi": "string (Sinhala description)"
      }
    ]
  `

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleanedText = text.replace(/```json/gi, '').replace(/```/gi, '').trim()
    return JSON.parse(cleanedText)
  } catch (err) {
    console.error('[AI] Insight Generation Error:', err)
    throw new Error('Failed to generate dashboard insights from CeyAI.')
  }
}
