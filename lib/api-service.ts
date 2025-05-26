/**
 * API Service for GeckoTerminal integration
 * Handles data fetching and transformation for Solana pools
 */


export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  baseSymbol?: string;
  quoteSymbol?: string;
}

export interface OHLCVDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class APIService {
  private static readonly BASE_URL = 'https://api.geckoterminal.com/api/v2/networks/solana/pools';
  private static readonly RATE_LIMIT_DELAY = 100; // ms

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get OHLCV parameters for different intervals with optional custom limit
   */
  private static getOhlcvParams(interval: string, customLimit?: number) {
    // GeckoTerminal API has a maximum limit of 1000 data points
    const MAX_API_LIMIT = 1000;
    
    const defaultLimits = {
      "1m": Math.min(60 * 24 * 7, MAX_API_LIMIT),      // 7 days max for 1m (10080 -> 1000)
      "5m": Math.min(12 * 24 * 30, MAX_API_LIMIT),     // 30 days max for 5m (8640 -> 1000)  
      "15m": Math.min((60 / 15) * 24 * 90, MAX_API_LIMIT), // 90 days max for 15m (8640 -> 1000)
      "1h": Math.min(24 * 42, MAX_API_LIMIT),          // 42 days max for 1h (1008 -> 1000)
      "4h": Math.min((24 / 4) * 166, MAX_API_LIMIT),   // 166 days max for 4h (996 -> 996)
      "1d": Math.min(365 * 2, MAX_API_LIMIT)          // 2 years max for 1d (730 -> 730)
    };

    switch (interval) {
      case "1m":
        return { timeframeParam: "minute", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1m"], MAX_API_LIMIT) };
      case "5m":
        return { timeframeParam: "minute", aggregateParam: "5", limit: Math.min(customLimit || defaultLimits["5m"], MAX_API_LIMIT) };
      case "15m":
        return { timeframeParam: "minute", aggregateParam: "15", limit: Math.min(customLimit || defaultLimits["15m"], MAX_API_LIMIT) };
      case "1h":
        return { timeframeParam: "hour", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1h"], MAX_API_LIMIT) };
      case "4h":
        return { timeframeParam: "hour", aggregateParam: "4", limit: Math.min(customLimit || defaultLimits["4h"], MAX_API_LIMIT) };
      case "1d":
        return { timeframeParam: "day", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1d"], MAX_API_LIMIT) };
      default:
        return { timeframeParam: "hour", aggregateParam: "1", limit: Math.min(customLimit || defaultLimits["1h"], MAX_API_LIMIT) };
    }
  }

  /**
   * Fetch pool information with included token data
   */
  static async fetchPoolWithTokens(poolAddress: string): Promise<TokenInfo> {
    try {
      const poolInfoUrl = `${this.BASE_URL}/${poolAddress}?include=base_token,quote_token`;
      
      
      const response = await fetch(poolInfoUrl);
      
      if (!response.ok) {
        throw new Error(`Pool info request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const poolAttributes = data.data.attributes;
      
      // Try to get token symbols from included data first
      let baseSymbol = 'Unknown';
      let quoteSymbol = 'Unknown';
      
      if (data.included && Array.isArray(data.included)) {
        // Find base token in included array
        const baseTokenId = data.data.relationships?.base_token?.data?.id;
        const quoteTokenId = data.data.relationships?.quote_token?.data?.id;
        
        const baseToken = data.included.find((item: any) => item.id === baseTokenId);
        const quoteToken = data.included.find((item: any) => item.id === quoteTokenId);
        
        if (baseToken?.attributes?.symbol) {
          baseSymbol = baseToken.attributes.symbol;
        }
        if (quoteToken?.attributes?.symbol) {
          quoteSymbol = quoteToken.attributes.symbol;
        }
      }
      
      // Fallback to parsing pool name if symbols not found in included data
      if (baseSymbol === 'Unknown' || quoteSymbol === 'Unknown') {
        const poolName = poolAttributes.name || poolAttributes.pool_name;
        if (poolName) {
          const parts = poolName.split(' / ');
          if (parts.length === 2) {
            baseSymbol = parts[0].trim();
            quoteSymbol = parts[1].trim();
          }
        }
      }

      return {
        symbol: baseSymbol,
        name: poolAttributes.name || poolAttributes.pool_name || `${baseSymbol}/${quoteSymbol}`,
        address: poolAddress,
        baseSymbol: baseSymbol,
        quoteSymbol: quoteSymbol
      };
    } catch (error) {
      console.error('Failed to fetch pool with tokens:', error);
      // Try the basic fetch as fallback
      return this.fetchTokenInfo(poolAddress);
    }
  }

  /**
   * Fetch token information from pool data
   */
  static async fetchTokenInfo(poolAddress: string): Promise<TokenInfo> {
    try {
      const poolInfoUrl = `${this.BASE_URL}/${poolAddress}`;
      
      
      const response = await fetch(poolInfoUrl);
      
      if (!response.ok) {
        throw new Error(`Pool info request failed: ${response.status} ${response.statusText}`);
      }

      const poolData = await response.json();
      const attributes = poolData.data.attributes;

      // Extract token symbols from pool name (format: "BASE / QUOTE")
      let baseSymbol = 'Unknown';
      let quoteSymbol = 'Unknown';
      
      if (attributes.name || attributes.pool_name) {
        const poolName = attributes.name || attributes.pool_name;
        const parts = poolName.split(' / ');
        if (parts.length === 2) {
          baseSymbol = parts[0].trim();
          quoteSymbol = parts[1].trim();
        }
      }

      return {
        symbol: baseSymbol,
        name: attributes.name || attributes.pool_name || `${baseSymbol}/${quoteSymbol}`,
        address: poolAddress,
        baseSymbol: baseSymbol,
        quoteSymbol: quoteSymbol
      };
    } catch (error) {
      console.error('Failed to fetch token info:', error);
      // Fallback to basic info
      return {
        symbol: 'Unknown',
        name: 'Unknown Token',
        address: poolAddress,
        baseSymbol: 'Unknown',
        quoteSymbol: 'Unknown'
      };
    }
  }

  /**
   * Fetch OHLCV data from GeckoTerminal API
   */
  static async fetchOHLCVData(
    poolAddress: string, 
    interval: string
  ): Promise<OHLCVDataPoint[]> {
    try {
      const { timeframeParam, aggregateParam, limit } = this.getOhlcvParams(interval);
      
      const ohlcvUrl = `${this.BASE_URL}/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregateParam}&limit=${limit}`;
      
      
      const response = await fetch(ohlcvUrl);
      
      if (!response.ok) {
        throw new Error(`OHLCV request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data?.data?.attributes?.ohlcv_list) {
        throw new Error('Invalid OHLCV response structure');
      }

                   // Transform GeckoTerminal data to our format
      const transformedData = data.data.attributes.ohlcv_list
        .map(([timestamp, open, high, low, close, volume]: [number, string, string, string, string, string]) => ({
          time: timestamp as number,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume)
        }))
        .sort((a: OHLCVDataPoint, b: OHLCVDataPoint) => a.time - b.time) // Ensure chronological order
        .filter((item: OHLCVDataPoint, index: number, array: OHLCVDataPoint[]) => {
          // Remove duplicates - keep only the first occurrence of each timestamp
          return index === 0 || item.time !== array[index - 1].time;
        });

      return transformedData;
    } catch (error) {
      console.error('Failed to fetch OHLCV data:', error);
      throw error;
    }
  }

  /**
   * Fetch complete chart data (token info + OHLCV data)
   */
  static async fetchChartData(
    poolAddress: string, 
    interval: string
  ): Promise<{
    tokenInfo: TokenInfo;
    ohlcvData: OHLCVDataPoint[];
  }> {
    try {
      // Fetch token information first (with included token data for better accuracy)
      const tokenInfo = await this.fetchPoolWithTokens(poolAddress);
      
      // Add rate limiting delay
      await this.delay(this.RATE_LIMIT_DELAY);
      
      // Then fetch OHLCV data
      const ohlcvData = await this.fetchOHLCVData(poolAddress, interval);
      
      return {
        tokenInfo,
        ohlcvData
      };
    } catch (error) {
      console.error("Chart data fetch error:", error);
      throw error;
    }
  }

  /**
   * Fetch complete chart data with custom limit
   */
  static async fetchChartDataWithLimit(
    poolAddress: string, 
    interval: string,
    customLimit?: number
  ): Promise<{
    tokenInfo: TokenInfo;
    ohlcvData: OHLCVDataPoint[];
  }> {
    try {
      // Fetch token information first (with included token data for better accuracy)
      const tokenInfo = await this.fetchPoolWithTokens(poolAddress);
      
      // Add rate limiting delay
      await this.delay(this.RATE_LIMIT_DELAY);
      
      // Then fetch OHLCV data with custom limit
      const ohlcvData = await this.fetchOHLCVDataWithRange(poolAddress, interval, { limit: customLimit });
      
      return {
        tokenInfo,
        ohlcvData
      };
    } catch (error) {
      console.error("Chart data fetch error:", error);
      throw error;
    }
  }

  /**
   * Fetch OHLCV data with custom date range
   */
  static async fetchOHLCVDataWithRange(
    poolAddress: string, 
    interval: string,
    options?: {
      limit?: number;
      beforeTimestamp?: number; // Unix timestamp
      afterTimestamp?: number;  // Unix timestamp
    }
  ): Promise<OHLCVDataPoint[]> {
    try {
      const { timeframeParam, aggregateParam, limit } = this.getOhlcvParams(interval, options?.limit);
      
      let ohlcvUrl = `${this.BASE_URL}/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregateParam}&limit=${limit}`;
      
      // Add timestamp parameters if provided
      if (options?.beforeTimestamp) {
        ohlcvUrl += `&before_timestamp=${options.beforeTimestamp}`;
      }
      if (options?.afterTimestamp) {
        ohlcvUrl += `&after_timestamp=${options.afterTimestamp}`;
      }
      
      
      const response = await fetch(ohlcvUrl);
      
      if (!response.ok) {
        throw new Error(`OHLCV request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data?.data?.attributes?.ohlcv_list) {
        throw new Error('Invalid OHLCV response structure');
      }

      // Transform GeckoTerminal data to our format
      const transformedData = data.data.attributes.ohlcv_list
        .map(([timestamp, open, high, low, close, volume]: [number, string, string, string, string, string]) => ({
          time: timestamp as number,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume)
        }))
        .sort((a: OHLCVDataPoint, b: OHLCVDataPoint) => a.time - b.time) // Ensure chronological order
        .filter((item: OHLCVDataPoint, index: number, array: OHLCVDataPoint[]) => {
          // Remove duplicates - keep only the first occurrence of each timestamp
          return index === 0 || item.time !== array[index - 1].time;
        });

      return transformedData;
    } catch (error) {
      console.error('Failed to fetch OHLCV data with range:', error);
      throw error;
    }
  }

  /**
   * Search for pools by token name, symbol, or address
   */
  static async searchPools(
    query: string,
    options?: {
      network?: string;
      limit?: number;
      page?: number;
    }
  ): Promise<{
    data: Array<{
      id: string;
      type: string;
      attributes: {
        name: string;
        address: string;
        base_token_price_usd: string;
        quote_token_price_usd: string;
        base_token_price_native_currency: string;
        quote_token_price_native_currency: string;
        pool_created_at: string;
        reserve_in_usd: string;
        fdv_usd: string;
        market_cap_usd: string;
        price_change_percentage: {
          h1: string;
          h24: string;
        };
        transactions: {
          h1: { buys: number; sells: number; buyers: number; sellers: number };
          h24: { buys: number; sells: number; buyers: number; sellers: number };
        };
        volume_usd: {
          h1: string;
          h24: string;
        };
      };
      relationships: {
        base_token: { data: { id: string; type: string } };
        quote_token: { data: { id: string; type: string } };
        dex: { data: { id: string; type: string } };
      };
    }>;
    included?: Array<{
      id: string;
      type: string;
      attributes: {
        symbol: string;
        name: string;
        address: string;
        decimals: number;
        total_supply: string;
        coingecko_coin_id: string;
      };
    }>;
  }> {
    try {
      let searchUrl = `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(query)}&include=base_token,quote_token,dex`;
      
      // Add optional parameters
      if (options?.network) {
        searchUrl += `&network=${options.network}`;
      }
      if (options?.limit) {
        searchUrl += `&limit=${Math.min(options.limit, 100)}`; // API typically limits to 100
      }
      if (options?.page) {
        searchUrl += `&page=${options.page}`;
      }
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`Search request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data?.data) {
        throw new Error('Invalid search response structure');
      }

      return data;
    } catch (error) {
      console.error('Failed to search pools:', error);
      throw error;
    }
  }
}