// Utility for testing cache persistence
export function testCachePersistence() {
  const testKey = 'cache-persistence-test'
  const testData = { message: 'Cache working!', timestamp: Date.now() }
  
  console.log('🧪 Testing cache persistence...')
  
  // Save test data
  localStorage.setItem(testKey, JSON.stringify(testData))
  
  // Immediately verify it was saved
  const saved = localStorage.getItem(testKey)
  if (saved) {
    const parsed = JSON.parse(saved)
    console.log('✅ Cache persistence test PASSED:', parsed)
    
    // Clean up test data
    localStorage.removeItem(testKey)
    return true
  } else {
    console.error('❌ Cache persistence test FAILED')
    return false
  }
}

export function listCachedOHLCVData() {
  const keys = Object.keys(localStorage).filter(key => key.startsWith('ohlcv-cache-'))
  console.log(`📊 Found ${keys.length} cached OHLCV entries:`)
  
  keys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}')
      const ageMinutes = Math.round((Date.now() - data.timestamp) / (1000 * 60))
      console.log(`  • ${data.poolAddress?.slice(0, 8)}... ${data.interval} (${data.dataPoints} pts, ${ageMinutes}m old)`)
    } catch (error) {
      console.log(`  • ${key} (corrupted)`)
    }
  })
  
  return keys.length
}