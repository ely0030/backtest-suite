import { ChartContainer } from "@/components/chart-container"
import { getChartData, ChartDataPoint } from "@/lib/data"

export default function Page() {
  const chartData = getChartData();

  return (
    <main className="container mx-auto p-4">
      <ChartContainer data={chartData} />
    </main>
  )
}
