# 🚀 AI Assistant Quick Start Guide

> **For comprehensive documentation, see the [`init/` folder](./init/) with detailed guides.**

This cryptocurrency charting application uses Next.js 14 with real-time data and technical analysis. This file serves as a rapid orientation guide for AI assistants working with the codebase.

## 📂 Documentation Structure

### 📋 **Essential Reading** (Start Here)
- **[`init/README.md`](./init/README.md)** - Complete overview & navigation guide
- **[`init/01-project-overview.md`](./init/01-project-overview.md)** - What this app does & why
- **[`init/02-component-architecture.md`](./init/02-component-architecture.md)** - React structure & patterns

### 🔧 **Deep Dive Documentation**
- **[`init/03-data-flow-apis.md`](./init/03-data-flow-apis.md)** - API integration & data pipeline
- **[`init/04-technical-analysis.md`](./init/04-technical-analysis.md)** - Trading algorithms (RSI, Chaikin)
- **[`init/05-optimization-algorithms.md`](./init/05-optimization-algorithms.md)** - Hill climbing implementation
- **[`init/06-ui-styling-system.md`](./init/06-ui-styling-system.md)** - Tailwind & shadcn/ui setup
- **[`init/07-development-workflow.md`](./init/07-development-workflow.md)** - Best practices & setup
- **[`init/08-troubleshooting-guide.md`](./init/08-troubleshooting-guide.md)** - Common issues & fixes

## ⚡ Quick Start Commands

```bash
npm run dev     # Development server (localhost:3000)
npm run build   # Production build
npm run lint    # Code quality checks
```

## 🎯 Key Files (Priority Order)

| Priority | File | Purpose |
|----------|------|---------|
| **🔴 HIGH** | `components/chart-container.tsx` | Main component (⚠️ infinite loop risk) |
| **🟡 MED** | `app/page.tsx` | Application entry point |
| **🟡 MED** | `lib/technical-analysis.ts` | Trading signal calculations |
| **🟡 MED** | `hooks/use-optimization.ts` | Parameter optimization logic |
| **🟢 LOW** | `types/chart.ts` | TypeScript definitions |
| **🟢 LOW** | `lib/api-service.ts` | GeckoTerminal API integration |

## 🚨 Critical Warnings

### ⚠️ Chart Re-render Loops
**MOST COMMON ISSUE**: Infinite re-renders in `chart-container.tsx`
- **Cause**: useEffect dependencies including callbacks that change on every render
- **Fix**: Separate chart creation from data updates in different useEffect hooks
- **Pattern**: Always use primitive dependencies only

### ⚠️ TradingView Type Issues
**Chart library quirks**: Use `as any` for time/position properties
```typescript
time: signal.time as any // Required for lightweight-charts
position: signal.position as any
```

## 🗺️ Project Structure (Quick Reference)

```
├── init/                  # 📚 Complete documentation
├── components/
│   ├── chart-container.tsx # 🎯 MAIN COMPONENT
│   └── ui/                # shadcn/ui components (50+)
├── lib/
│   ├── technical-analysis.ts # 🧮 RSI & Chaikin calculations
│   ├── api-service.ts     # 🌐 API integration
│   └── chart-config.ts    # Configuration constants
├── hooks/
│   └── use-optimization.ts # Hill climbing algorithm
├── types/
│   └── chart.ts          # TypeScript interfaces
└── app/                  # Next.js 14 App Router
```

## 🔄 Development Workflow

1. **🔍 Read First**: Check `init/` docs for the area you're working on
2. **⚡ Start Fast**: Use `npm run dev` for hot reload
3. **🎯 Focus**: Work on specific areas using the priority file list
4. **🚨 Test**: Watch for infinite re-render loops during development
5. **✅ Verify**: Run `npm run lint` before finishing

## 💡 Getting Help

**For detailed explanations of any concept, algorithm, or implementation pattern, refer to the comprehensive documentation in the [`init/` folder](./init/)**. Each file covers specific aspects in depth with code examples and troubleshooting guides.