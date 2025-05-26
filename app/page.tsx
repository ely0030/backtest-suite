import { ChartContainer } from "@/components/chart-container"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function Page() {
  return (
    <main className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Crypto Chart</h1>
        <ThemeToggle />
      </div>
      <ChartContainer />
    </main>
  )
}
