export type ChartDataPoint = {
  timestamp: number;
  value: number;
};

export function getChartData(): ChartDataPoint[] {
  // Sample data - replace with real data source
  return [
    { timestamp: 1737590400, value: 42000 },
    { timestamp: 1737676800, value: 45000 },
    { timestamp: 1737763200, value: 41000 },
  ].sort((a, b) => a.timestamp - b.timestamp);
}
