import { useState, useCallback, useEffect } from 'react'

interface ApiCall {
  timestamp: number
  endpoint: string
  poolAddress: string
  interval?: string
}

interface RateLimitStats {
  callsLast1Min: number
  callsLast5Min: number
  callsLast1Hour: number
  callsToday: number
  totalCalls: number
  cacheHitRate: number
  estimatedSavings: number
}

// Conservative estimates for GeckoTerminal free tier limits
const ESTIMATED_LIMITS = {
  perMinute: 30,     // Conservative estimate
  per5Minutes: 100,  // Conservative estimate  
  perHour: 1000,     // Conservative estimate
  perDay: 10000      // Conservative estimate
}

const STORAGE_KEY = 'gecko-api-calls'
const MAX_STORED_CALLS = 1000 // Keep last 1000 calls for analysis

export function useRateLimitMonitor() {
  const [stats, setStats] = useState<RateLimitStats>({
    callsLast1Min: 0,
    callsLast5Min: 0,
    callsLast1Hour: 0,
    callsToday: 0,
    totalCalls: 0,
    cacheHitRate: 0,
    estimatedSavings: 0
  })

  // Load stored API calls from localStorage
  const loadApiCalls = useCallback((): ApiCall[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []
      
      const calls: ApiCall[] = JSON.parse(stored)
      // Filter out calls older than 24 hours to keep storage clean
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
      return calls.filter(call => call.timestamp > oneDayAgo)
    } catch (error) {
      console.error('Error loading API calls:', error)
      return []
    }
  }, [])

  // Save API calls to localStorage
  const saveApiCalls = useCallback((calls: ApiCall[]) => {
    try {
      // Keep only the most recent calls to prevent localStorage bloat
      const recentCalls = calls.slice(-MAX_STORED_CALLS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentCalls))
    } catch (error) {
      console.error('Error saving API calls:', error)
    }
  }, [])

  // Record a new API call
  const recordApiCall = useCallback((endpoint: string, poolAddress: string, interval?: string) => {
    const newCall: ApiCall = {
      timestamp: Date.now(),
      endpoint,
      poolAddress,
      interval
    }

    const existingCalls = loadApiCalls()
    const updatedCalls = [...existingCalls, newCall]
    saveApiCalls(updatedCalls)

    console.log(`📡 API CALL RECORDED: ${endpoint} (Pool: ${poolAddress?.slice(0, 8)}...)`)
    
    // Update stats immediately
    updateStats()
  }, [loadApiCalls, saveApiCalls])

  // Calculate current statistics
  const updateStats = useCallback(() => {
    const calls = loadApiCalls()
    const now = Date.now()
    
    // Time boundaries
    const oneMinuteAgo = now - (1 * 60 * 1000)
    const fiveMinutesAgo = now - (5 * 60 * 1000)
    const oneHourAgo = now - (60 * 60 * 1000)
    const oneDayAgo = now - (24 * 60 * 60 * 1000)

    // Count calls in different time periods
    const callsLast1Min = calls.filter(call => call.timestamp > oneMinuteAgo).length
    const callsLast5Min = calls.filter(call => call.timestamp > fiveMinutesAgo).length
    const callsLast1Hour = calls.filter(call => call.timestamp > oneHourAgo).length
    const callsToday = calls.filter(call => call.timestamp > oneDayAgo).length

    // Get cache stats from localStorage (if available)
    const cacheStatsStr = localStorage.getItem('cache-hit-rate-stats')
    let cacheHitRate = 0
    let estimatedSavings = 0
    
    try {
      if (cacheStatsStr) {
        const cacheStats = JSON.parse(cacheStatsStr)
        const totalRequests = cacheStats.hits + cacheStats.misses
        cacheHitRate = totalRequests > 0 ? Math.round((cacheStats.hits / totalRequests) * 100) : 0
        estimatedSavings = cacheStats.hits || 0
      }
    } catch (error) {
      // Ignore cache stats errors
    }

    const newStats: RateLimitStats = {
      callsLast1Min,
      callsLast5Min,
      callsLast1Hour,
      callsToday,
      totalCalls: calls.length,
      cacheHitRate,
      estimatedSavings
    }

    setStats(newStats)
    
    console.log('📊 RATE LIMIT STATS UPDATED:', newStats)
  }, [loadApiCalls])

  // Get rate limit status with color coding
  const getRateLimitStatus = useCallback(() => {
    const minutePercent = (stats.callsLast1Min / ESTIMATED_LIMITS.perMinute) * 100
    const fiveMinPercent = (stats.callsLast5Min / ESTIMATED_LIMITS.per5Minutes) * 100
    const hourPercent = (stats.callsLast1Hour / ESTIMATED_LIMITS.perHour) * 100
    const dayPercent = (stats.callsToday / ESTIMATED_LIMITS.perDay) * 100

    const maxPercent = Math.max(minutePercent, fiveMinPercent, hourPercent, dayPercent)

    let status: 'safe' | 'warning' | 'danger' = 'safe'
    let color = 'green'
    let message = 'Safe usage'

    if (maxPercent > 80) {
      status = 'danger'
      color = 'red'
      message = 'Approaching limits!'
    } else if (maxPercent > 60) {
      status = 'warning'
      color = 'orange'
      message = 'Moderate usage'
    }

    return {
      status,
      color,
      message,
      percentUsed: Math.round(maxPercent),
      breakdown: {
        minute: Math.round(minutePercent),
        fiveMinute: Math.round(fiveMinPercent),
        hour: Math.round(hourPercent),
        day: Math.round(dayPercent)
      }
    }
  }, [stats])

  // Initialize stats on mount
  useEffect(() => {
    updateStats()
    
    // Set up periodic updates every 10 seconds
    const interval = setInterval(updateStats, 10000)
    
    return () => clearInterval(interval)
  }, [updateStats])

  // Clear old API call records
  const clearOldRecords = useCallback(() => {
    const calls = loadApiCalls()
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
    const recentCalls = calls.filter(call => call.timestamp > oneDayAgo)
    saveApiCalls(recentCalls)
    updateStats()
    console.log('🧹 Cleared old API call records')
  }, [loadApiCalls, saveApiCalls, updateStats])

  // Get detailed breakdown for debugging
  const getDetailedBreakdown = useCallback(() => {
    const calls = loadApiCalls()
    const now = Date.now()
    
    // Group by endpoint
    const byEndpoint = calls.reduce((acc, call) => {
      const endpoint = call.endpoint
      acc[endpoint] = (acc[endpoint] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by time periods
    const last5Minutes = calls.filter(call => call.timestamp > now - (5 * 60 * 1000))
    const byPool = last5Minutes.reduce((acc, call) => {
      const pool = call.poolAddress?.slice(0, 8) + '...'
      acc[pool] = (acc[pool] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalCalls: calls.length,
      byEndpoint,
      byPool,
      recentActivity: last5Minutes.length,
      oldestCall: calls.length > 0 ? new Date(calls[0].timestamp).toLocaleString() : 'None',
      newestCall: calls.length > 0 ? new Date(calls[calls.length - 1].timestamp).toLocaleString() : 'None'
    }
  }, [loadApiCalls])

  return {
    stats,
    recordApiCall,
    updateStats,
    getRateLimitStatus,
    clearOldRecords,
    getDetailedBreakdown,
    estimatedLimits: ESTIMATED_LIMITS
  }
}