export interface OHLCVData {
  time: number // Changed to number for Unix timestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ChartProps {
  network?: string
  poolAddress?: string
}

export interface APIResponse {
  data: {
    attributes: {
      ohlcv_list: [number, string, string, string, string, string][]
    }
  }
}

