# Crypto Chart Application - Developer Documentation

This `init/` folder contains comprehensive documentation for understanding and working with the cryptocurrency charting application. This documentation is designed to help developers quickly understand the codebase architecture, implementation details, and development workflows.

## Documentation Overview

### 📋 [01-project-overview.md](./01-project-overview.md)
**What this application does and why it exists**
- Core features and functionality
- Technology stack overview
- Key architectural decisions
- Project goals and scope

### 🏗️ [02-component-architecture.md](./02-component-architecture.md)
**Detailed breakdown of React components and their relationships**
- Main application components
- shadcn/ui component library usage
- Component patterns and conventions
- State management strategies

### 🔄 [03-data-flow-apis.md](./03-data-flow-apis.md)
**API integration and data processing pipeline**
- GeckoTerminal API integration
- Data transformation processes
- State management and data flow
- Performance optimization strategies

### 📊 [04-technical-analysis.md](./04-technical-analysis.md)
**Financial indicators and trading logic implementation**
- RSI (Relative Strength Index) calculation
- Chaikin Volatility implementation
- Signal generation algorithms
- Trading strategy logic

### 🔍 [05-optimization-algorithms.md](./05-optimization-algorithms.md)
**Parameter optimization and hill climbing algorithms**
- Hill climbing implementation
- Multi-restart strategies
- Real-time optimization feedback
- Performance evaluation metrics

### 🎨 [06-ui-styling-system.md](./06-ui-styling-system.md)
**Design system, theming, and styling implementation**
- Tailwind CSS configuration
- shadcn/ui component customization
- CSS variables and theming
- Responsive design patterns

### ⚙️ [07-development-workflow.md](./07-development-workflow.md)
**Development setup, best practices, and workflows**
- Environment setup instructions
- Code quality standards
- Performance optimization techniques
- Testing and debugging strategies

### 🔧 [08-troubleshooting-guide.md](./08-troubleshooting-guide.md)
**Common issues and their solutions**
- Chart rendering problems
- API integration issues
- Optimization algorithm debugging
- Performance and memory issues

## Quick Start for New Developers

### 1. First Time Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to localhost:3000
```

### 2. Essential Files to Understand
1. **`/components/chart-container.tsx`** - Main application logic
2. **`/app/page.tsx`** - Entry point and layout
3. **`/lib/data.ts`** - Data management utilities
4. **`/types/chart.ts`** - TypeScript type definitions

### 3. Key Concepts to Grasp
- **Real-time Data**: Application fetches live cryptocurrency data
- **Technical Analysis**: Implements RSI and Chaikin Volatility indicators
- **Optimization**: Uses hill climbing to find optimal trading parameters
- **Interactive Charts**: Built with TradingView's lightweight-charts

### 4. Development Commands
```bash
npm run dev     # Development server with hot reload
npm run build   # Production build
npm run lint    # Code quality checks
```

## Architecture at a Glance

```
User Interface (React + shadcn/ui)
    ↓
Chart Container (Main Component)
    ↓
├── GeckoTerminal API (Data Source)
├── Technical Analysis (RSI + Chaikin Volatility)
├── Signal Generation (Buy/Sell Logic)
├── Optimization Engine (Hill Climbing)
└── Chart Visualization (TradingView Charts)
```

## Key Technologies

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui, CSS Variables
- **Charts**: TradingView Lightweight Charts
- **Data**: GeckoTerminal API (real-time crypto data)
- **Optimization**: Custom hill climbing algorithms

## Development Philosophy

This project prioritizes:
1. **Developer Experience**: Fast hot reload, TypeScript support, clean architecture
2. **Performance**: Efficient chart rendering, optimized data processing
3. **User Experience**: Real-time feedback, smooth interactions
4. **Maintainability**: Clear component structure, comprehensive documentation

## Getting Help

### Documentation Order for New Developers
1. Start with **Project Overview** for big picture understanding
2. Read **Component Architecture** to understand code structure  
3. Review **Development Workflow** for practical development setup
4. Dive into specific areas (APIs, Technical Analysis, etc.) as needed
5. Keep **Troubleshooting Guide** handy for issue resolution

### Additional Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [Tailwind CSS](https://tailwindcss.com/)

This documentation provides everything needed to understand, modify, and extend the cryptocurrency charting application effectively.