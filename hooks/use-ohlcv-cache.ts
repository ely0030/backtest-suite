import { useState, useCallback, useEffect } from 'react'
import { OHLCVDataPoint } from '@/lib/api-service'

interface CacheEntry {
  data: OHLCVDataPoint[]
  timestamp: number
  interval: string
  poolAddress: string
  dataPoints: number
}

interface CacheKey {
  poolAddress: string
  interval: string
  limit?: number
}

const CACHE_KEY_PREFIX = 'ohlcv-cache-'
const CACHE_EXPIRY_MINUTES = {
  '1m': 5,    // 1-minute candles expire after 5 minutes
  '5m': 15,   // 5-minute candles expire after 15 minutes
  '15m': 30,  // 15-minute candles expire after 30 minutes
  '1h': 60,   // 1-hour candles expire after 1 hour
  '4h': 240,  // 4-hour candles expire after 4 hours
  '1d': 1440  // Daily candles expire after 24 hours
}

export function useOHLCVCache() {
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    totalCached: 0
  })

  // Initialize cache stats on mount and update stats function 
  const updateCacheStats = useCallback(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX))
    setCacheStats(prev => ({ ...prev, totalCached: keys.length }))
  }, [])

  // Initialize cache stats on mount and log cache status
  useEffect(() => {
    console.log('🚀 CACHE INITIALIZATION STARTING...')
    
    // Get ALL localStorage keys for debugging
    const allKeys = Object.keys(localStorage)
    console.log(`🔍 Total localStorage keys: ${allKeys.length}`)
    console.log('🔍 All localStorage keys:', allKeys)
    
    // Filter for our cache keys
    const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_KEY_PREFIX))
    console.log(`🔄 Cache initialized: Found ${cacheKeys.length} cached OHLCV entries`)
    console.log('🔍 Cache key list:', cacheKeys)
    
    if (cacheKeys.length > 0) {
      console.log('📊 DETAILED CACHE INVENTORY:')
      cacheKeys.forEach((key, index) => {
        try {
          const rawData = localStorage.getItem(key)
          console.log(`  ${index + 1}. Key: ${key}`)
          console.log(`     Raw data size: ${rawData?.length || 0} chars`)
          
          const data = JSON.parse(rawData || '{}')
          const ageMinutes = Math.round((Date.now() - data.timestamp) / (1000 * 60))
          const expiryMinutes = CACHE_EXPIRY_MINUTES[data.interval as keyof typeof CACHE_EXPIRY_MINUTES] || 60
          const isExpired = ageMinutes >= expiryMinutes
          
          console.log(`     Pool: ${data.poolAddress?.slice(0, 8)}...${data.poolAddress?.slice(-4)}`)
          console.log(`     Interval: ${data.interval}`)
          console.log(`     Data points: ${data.dataPoints}`)
          console.log(`     Age: ${ageMinutes} minutes (expires after ${expiryMinutes}m)`)
          console.log(`     Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`)
          console.log(`     Timestamp: ${data.timestamp} (${new Date(data.timestamp).toLocaleString()})`)
        } catch (error) {
          console.log(`     ❌ CORRUPTED ENTRY: ${error}`)
        }
      })
      console.log('✅ Cache persistence confirmed - data survived dev server restart!')
    } else {
      console.log('ℹ️ No cached data found (first run or cache cleared)')
    }
    
    // Log cache expiry settings
    console.log('⏰ Cache expiry settings:', CACHE_EXPIRY_MINUTES)
    
    updateCacheStats()
    console.log('🏁 CACHE INITIALIZATION COMPLETE')
  }, [])

  // Generate cache key
  const getCacheKey = useCallback((key: CacheKey): string => {
    return `${CACHE_KEY_PREFIX}${key.poolAddress}-${key.interval}-${key.limit || 'default'}`
  }, [])

  // Check if cache entry is still valid
  const isCacheValid = useCallback((entry: CacheEntry, interval: string): boolean => {
    const now = Date.now()
    const expiryMinutes = CACHE_EXPIRY_MINUTES[interval as keyof typeof CACHE_EXPIRY_MINUTES] || 60
    const expiryMs = expiryMinutes * 60 * 1000
    
    return (now - entry.timestamp) < expiryMs
  }, [])

  // Get data from cache
  const getFromCache = useCallback((key: CacheKey): OHLCVDataPoint[] | null => {
    console.log(`🔍 CACHE LOOKUP STARTING:`)
    console.log(`   Request: ${key.poolAddress?.slice(0, 8)}...${key.poolAddress?.slice(-4)} ${key.interval} (limit: ${key.limit})`)
    
    try {
      // First try exact match
      const exactCacheKey = getCacheKey(key)
      console.log(`   Exact key: ${exactCacheKey}`)
      const exactStored = localStorage.getItem(exactCacheKey)
      console.log(`   Exact match found: ${!!exactStored}`)
      
      if (exactStored) {
        console.log(`   Exact entry size: ${exactStored.length} chars`)
        const entry: CacheEntry = JSON.parse(exactStored)
        const ageMinutes = Math.round((Date.now() - entry.timestamp) / (1000 * 60))
        const expiryMinutes = CACHE_EXPIRY_MINUTES[key.interval as keyof typeof CACHE_EXPIRY_MINUTES] || 60
        
        console.log(`   Entry details:`)
        console.log(`     Age: ${ageMinutes} minutes`)
        console.log(`     Expires after: ${expiryMinutes} minutes`)
        console.log(`     Data points: ${entry.dataPoints}`)
        console.log(`     Timestamp: ${new Date(entry.timestamp).toLocaleString()}`)
        
        // Check if cache is still valid
        const isValid = isCacheValid(entry, key.interval)
        console.log(`   Cache validity: ${isValid ? '✅ VALID' : '❌ EXPIRED'}`)
        
        if (isValid) {
          console.log(`✅ EXACT CACHE HIT for ${key.poolAddress?.slice(0, 8)}... ${key.interval} (${entry.dataPoints} points)`)
          setCacheStats(prev => {
            const newStats = { ...prev, hits: prev.hits + 1 }
            // Store hit/miss stats for rate limit monitor
            localStorage.setItem('cache-hit-rate-stats', JSON.stringify(newStats))
            return newStats
          })
          
          // If we need fewer points than cached, return only what's needed
          if (key.limit && key.limit < entry.data.length) {
            console.log(`   Slicing data: ${entry.data.length} → ${key.limit} points`)
            return entry.data.slice(-key.limit)
          }
          
          return entry.data
        } else {
          console.log(`   ⏰ Cache expired, removing entry`)
          localStorage.removeItem(exactCacheKey)
        }
      }

      // If no exact match or expired, try to find any cache entry for this pool/interval
      // that has enough data points
      console.log(`   🔄 Trying flexible cache matching...`)
      if (key.limit) {
        const pattern = `${CACHE_KEY_PREFIX}${key.poolAddress}-${key.interval}-`
        const flexibleKeys = Object.keys(localStorage).filter(k => k.startsWith(pattern))
        console.log(`   Found ${flexibleKeys.length} potential flexible matches:`, flexibleKeys)
        
        for (const cacheKey of flexibleKeys) {
          console.log(`   Checking flexible key: ${cacheKey}`)
          const stored = localStorage.getItem(cacheKey)
          if (!stored) {
            console.log(`     ❌ No data for key`)
            continue
          }
          
          try {
            const entry: CacheEntry = JSON.parse(stored)
            const ageMinutes = Math.round((Date.now() - entry.timestamp) / (1000 * 60))
            const expiryMinutes = CACHE_EXPIRY_MINUTES[key.interval as keyof typeof CACHE_EXPIRY_MINUTES] || 60
            const isValid = isCacheValid(entry, key.interval)
            
            console.log(`     Entry: ${entry.dataPoints} points, ${ageMinutes}m old, ${isValid ? 'valid' : 'expired'}`)
            
            // Check if cache is still valid and has enough data
            if (isValid && entry.dataPoints >= key.limit) {
              console.log(`✅ FLEXIBLE CACHE HIT for ${key.poolAddress?.slice(0, 8)}... ${key.interval} (found ${entry.dataPoints} points, needed ${key.limit})`)
              setCacheStats(prev => {
                const newStats = { ...prev, hits: prev.hits + 1 }
                // Store hit/miss stats for rate limit monitor
                localStorage.setItem('cache-hit-rate-stats', JSON.stringify(newStats))
                return newStats
              })
              
              // Return the requested amount of data
              return entry.data.slice(-key.limit)
            } else if (!isValid) {
              console.log(`     ⏰ Entry expired, removing`)
              localStorage.removeItem(cacheKey)
            } else {
              console.log(`     ❌ Not enough data points (need ${key.limit}, have ${entry.dataPoints})`)
            }
          } catch (error) {
            console.log(`     ❌ Corrupted entry, removing: ${error}`)
            localStorage.removeItem(cacheKey)
            continue
          }
        }
      }

      // No suitable cache found
      console.log(`❌ CACHE MISS for ${key.poolAddress?.slice(0, 8)}... ${key.interval}`)
      setCacheStats(prev => {
        const newStats = { ...prev, misses: prev.misses + 1 }
        // Store hit/miss stats for rate limit monitor
        localStorage.setItem('cache-hit-rate-stats', JSON.stringify(newStats))
        return newStats
      })
      return null
    } catch (error) {
      console.error('Cache read error:', error)
      setCacheStats(prev => {
        const newStats = { ...prev, misses: prev.misses + 1 }
        // Store hit/miss stats for rate limit monitor
        localStorage.setItem('cache-hit-rate-stats', JSON.stringify(newStats))
        return newStats
      })
      return null
    }
  }, [getCacheKey, isCacheValid])

  // Save data to cache
  const saveToCache = useCallback((key: CacheKey, data: OHLCVDataPoint[]): void => {
    console.log(`💾 CACHE SAVE STARTING:`)
    console.log(`   Pool: ${key.poolAddress?.slice(0, 8)}...${key.poolAddress?.slice(-4)}`)
    console.log(`   Interval: ${key.interval}`)
    console.log(`   Data points: ${data.length}`)
    console.log(`   Limit: ${key.limit}`)
    
    try {
      const cacheKey = getCacheKey(key)
      console.log(`   Cache key: ${cacheKey}`)
      
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        interval: key.interval,
        poolAddress: key.poolAddress,
        dataPoints: data.length
      }
      
      const entrySize = JSON.stringify(entry).length
      console.log(`   Entry size: ${entrySize} characters`)
      
      // Before saving, check if we should clean up smaller entries for the same pool/interval
      if (key.limit) {
        const pattern = `${CACHE_KEY_PREFIX}${key.poolAddress}-${key.interval}-`
        const existingKeys = Object.keys(localStorage).filter(k => k.startsWith(pattern))
        console.log(`   Found ${existingKeys.length} existing entries for cleanup check:`, existingKeys)
        
        existingKeys.forEach(existingKey => {
          if (existingKey === cacheKey) {
            console.log(`     Skipping ${existingKey} (same as new entry)`)
            return // Don't remove the one we're about to save
          }
          
          try {
            const existingEntry = JSON.parse(localStorage.getItem(existingKey) || '{}')
            console.log(`     Checking ${existingKey}: ${existingEntry.dataPoints} points`)
            
            // Remove entries with fewer data points than what we're saving
            if (existingEntry.dataPoints && existingEntry.dataPoints <= data.length) {
              localStorage.removeItem(existingKey)
              console.log(`     🧹 Removed redundant entry: ${existingKey} (${existingEntry.dataPoints} ≤ ${data.length} points)`)
            } else {
              console.log(`     ✅ Keeping entry: ${existingKey} (${existingEntry.dataPoints} > ${data.length} points)`)
            }
          } catch (error) {
            console.log(`     ❌ Error checking ${existingKey}, removing: ${error}`)
            localStorage.removeItem(existingKey)
          }
        })
      }
      
      console.log(`   Attempting to save to localStorage...`)
      localStorage.setItem(cacheKey, JSON.stringify(entry))
      
      // Verify the save was successful
      const saved = localStorage.getItem(cacheKey)
      if (saved) {
        const savedSize = saved.length
        console.log(`💾 ✅ CACHE SAVE SUCCESS!`)
        console.log(`   Key: ${cacheKey}`)
        console.log(`   Size: ${savedSize} characters`)
        console.log(`   Pool: ${key.poolAddress?.slice(0, 8)}...${key.poolAddress?.slice(-4)}`)
        console.log(`   Interval: ${key.interval}`)
        console.log(`   Data points: ${data.length}`)
        console.log(`   Timestamp: ${new Date(entry.timestamp).toLocaleString()}`)
        console.log(`   🔄 PERSISTS ACROSS DEV SERVER RESTARTS`)
      } else {
        console.error(`💾 ❌ CACHE SAVE FAILED for ${key.poolAddress?.slice(0, 8)}... ${key.interval}`)
      }
      
      // Update cache stats
      updateCacheStats()
    } catch (error) {
      console.error('Cache write error:', error)
      // If localStorage is full, try to clear old entries
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        clearOldCacheEntries()
        // Try again
        try {
          const cacheKey = getCacheKey(key)
          localStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now(),
            interval: key.interval,
            poolAddress: key.poolAddress,
            dataPoints: data.length
          }))
        } catch (retryError) {
          console.error('Cache write failed after cleanup:', retryError)
        }
      }
    }
  }, [getCacheKey])

  // Clear old cache entries
  const clearOldCacheEntries = useCallback(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX))
    const entries: Array<{ key: string; timestamp: number }> = []
    
    keys.forEach(key => {
      try {
        const entry = JSON.parse(localStorage.getItem(key) || '{}')
        if (entry.timestamp) {
          entries.push({ key, timestamp: entry.timestamp })
        }
      } catch (error) {
        // Remove corrupted entries
        localStorage.removeItem(key)
      }
    })
    
    // Sort by timestamp (oldest first) and remove oldest 25%
    entries.sort((a, b) => a.timestamp - b.timestamp)
    const toRemove = Math.ceil(entries.length * 0.25)
    
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key)
    }
    
    console.log(`🧹 Cleared ${toRemove} old cache entries`)
  }, [])


  // Clear all cache
  const clearAllCache = useCallback(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX))
    keys.forEach(key => localStorage.removeItem(key))
    setCacheStats({ hits: 0, misses: 0, totalCached: 0 })
    console.log('🧹 Cleared all OHLCV cache')
  }, [])

  // Get cache size in bytes
  const getCacheSize = useCallback((): number => {
    let totalSize = 0
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX))
    
    keys.forEach(key => {
      const value = localStorage.getItem(key)
      if (value) {
        totalSize += key.length + value.length
      }
    })
    
    return totalSize * 2 // Approximate UTF-16 encoding
  }, [])

  // Get comprehensive cache debug info
  const getCacheDebugInfo = useCallback(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX))
    const debugInfo = {
      totalEntries: keys.length,
      totalSize: getCacheSize(),
      entries: keys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          const ageMinutes = Math.round((Date.now() - data.timestamp) / (1000 * 60))
          const expiryMinutes = CACHE_EXPIRY_MINUTES[data.interval as keyof typeof CACHE_EXPIRY_MINUTES] || 60
          const isExpired = ageMinutes >= expiryMinutes
          
          return {
            key,
            poolAddress: data.poolAddress,
            interval: data.interval,
            dataPoints: data.dataPoints,
            ageMinutes,
            expiryMinutes,
            isExpired,
            timestamp: data.timestamp,
            size: localStorage.getItem(key)?.length || 0
          }
        } catch (error) {
          return {
            key,
            error: error instanceof Error ? error.message : 'Unknown error',
            corrupted: true
          }
        }
      })
    }
    
    console.log('🔍 CACHE DEBUG INFO:', debugInfo)
    return debugInfo
  }, [getCacheSize])

  return {
    getFromCache,
    saveToCache,
    clearAllCache,
    clearOldCacheEntries,
    getCacheSize,
    cacheStats,
    updateCacheStats,
    getCacheDebugInfo
  }
} 