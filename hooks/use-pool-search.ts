import { useState, useEffect, useCallback } from 'react'
import { APIService } from '@/lib/api-service'

export interface SearchResult {
  id: string
  address: string
  name: string
  baseSymbol: string
  quoteSymbol: string
  baseTokenAddress: string
  quoteTokenAddress: string
  dexName: string
  volume24h: string
  priceChange24h: string
  reserveUsd: string
}

export function usePoolSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced search function
  const searchPools = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await APIService.searchPools(searchQuery, {
        network: 'solana', // Focus on Solana for now
        limit: 10
      })

      // Transform the response to our SearchResult format
      const transformedResults: SearchResult[] = response.data.map(pool => {
        // Find base and quote tokens in included data
        const baseToken = response.included?.find(
          item => item.id === pool.relationships.base_token.data.id && item.type === 'token'
        )
        const quoteToken = response.included?.find(
          item => item.id === pool.relationships.quote_token.data.id && item.type === 'token'
        )
        const dex = response.included?.find(
          item => item.id === pool.relationships.dex.data.id && item.type === 'dex'
        )

        return {
          id: pool.id,
          address: pool.attributes.address,
          name: pool.attributes.name,
          baseSymbol: baseToken?.attributes.symbol || 'Unknown',
          quoteSymbol: quoteToken?.attributes.symbol || 'Unknown',
          baseTokenAddress: baseToken?.attributes.address || '',
          quoteTokenAddress: quoteToken?.attributes.address || '',
          dexName: dex?.attributes?.name || 'Unknown DEX',
          volume24h: pool.attributes.volume_usd?.h24 || '0',
          priceChange24h: pool.attributes.price_change_percentage?.h24 || '0',
          reserveUsd: pool.attributes.reserve_in_usd || '0'
        }
      })

      setResults(transformedResults)
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce the search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPools(query)
    }, 500) // 500ms debounce - longer delay for better UX

    return () => clearTimeout(timeoutId)
  }, [query, searchPools])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
  }, [])

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearSearch
  }
} 