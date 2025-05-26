import { useState, useEffect, useCallback } from 'react'

export interface PoolHistoryItem {
  address: string
  baseSymbol: string
  quoteSymbol: string
  name: string
  lastVisited: number
}

const STORAGE_KEY = 'crypto-chart-pool-history'
const MAX_HISTORY_ITEMS = 10

export function usePoolHistory() {
  const [history, setHistory] = useState<PoolHistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false); // Track if initial load is complete

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      console.log('🔍 Loading pool history from localStorage...')
      const stored = localStorage.getItem(STORAGE_KEY)
      console.log('🔍 Raw stored data:', stored)
      if (stored) {
        const parsed = JSON.parse(stored) as PoolHistoryItem[]
        console.log('🔍 Parsed data:', parsed)
        // Sort by lastVisited descending
        const sorted = parsed.sort((a, b) => b.lastVisited - a.lastVisited)
        const limited = sorted.slice(0, MAX_HISTORY_ITEMS)
        console.log('🔍 Setting history to:', limited)
        setHistory(limited)
      } else {
        console.log('🔍 No stored pool history found')
      }
    } catch (error) {
      console.error('Failed to load pool history:', error)
    } finally {
      setIsLoaded(true); // Mark as loaded regardless of outcome
    }
  }, [])

  // Save history to localStorage whenever it changes, BUT ONLY AFTER INITIAL LOAD
  useEffect(() => {
    if (!isLoaded) {
      console.log('💾 Skipping save to localStorage: Initial load not complete.')
      return; // Don't save if we haven't loaded from localStorage yet
    }
    try {
      console.log('💾 Saving pool history to localStorage:', history)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
      console.log('💾 Successfully saved to localStorage')
    } catch (error) {
      console.error('Failed to save pool history:', error)
    }
  }, [history, isLoaded]) // Add isLoaded to dependency array

  // Add a new item to history
  const addToHistory = useCallback((item: Omit<PoolHistoryItem, 'lastVisited'>) => {
    console.log('➕ Adding to history:', item)
    setHistory(prev => {
      // Check if this pool already exists
      const existingIndex = prev.findIndex(h => h.address === item.address)
      console.log('➕ Existing index:', existingIndex, 'Previous history:', prev)
      
      const newItem: PoolHistoryItem = {
        ...item,
        lastVisited: Date.now()
      }

      let newHistory: PoolHistoryItem[]
      
      if (existingIndex >= 0) {
        // Update existing item
        console.log('➕ Updating existing item')
        newHistory = [...prev]
        newHistory[existingIndex] = newItem
      } else {
        // Add new item
        console.log('➕ Adding new item')
        newHistory = [newItem, ...prev]
      }

      // Sort by lastVisited and limit to MAX_HISTORY_ITEMS
      const result = newHistory
        .sort((a, b) => b.lastVisited - a.lastVisited)
        .slice(0, MAX_HISTORY_ITEMS)
      
      console.log('➕ New history result:', result)
      return result
    })
  }, [])

  // Remove an item from history
  const removeFromHistory = useCallback((address: string) => {
    setHistory(prev => prev.filter(item => item.address !== address))
  }, [])

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory
  }
} 