# UI & Styling System

## Overview

The application uses a modern, component-based styling system built on Tailwind CSS with shadcn/ui components. The design system emphasizes accessibility, consistency, and developer experience with a comprehensive theming system.

## Styling Architecture

### Core Technologies
- **Tailwind CSS**: Utility-first CSS framework
- **CSS Variables**: Dynamic theming support
- **shadcn/ui**: High-quality component library
- **Class Variance Authority (CVA)**: Type-safe variant management
- **Radix UI**: Accessible component primitives

### Design System Structure
```
Styling System
├── CSS Variables (theme tokens)
├── Tailwind Configuration (design system)
├── Component Variants (CVA patterns)
├── Global Styles (base layer)
└── Component Library (shadcn/ui)
```

## Theming System

### CSS Variables Definition (`/app/globals.css`)
```css
@layer base {
  :root {
    /* Base Colors */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Interactive Colors */
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;

    /* State Colors */
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    /* Border & Input */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    /* Chart Colors */
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;

    /* Radius */
    --radius: 0.5rem;
  }

  .dark {
    /* Dark mode color overrides */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    /* ... additional dark mode variables */
  }
}
```

### Tailwind Configuration (`/tailwind.config.ts`)
```typescript
const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        // ... extensive color system
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
```

## Component Styling Patterns

### Class Variance Authority (CVA) Pattern
```typescript
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  // Base classes
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
```

### Component Implementation Pattern
```typescript
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

## Key UI Components

### Card System
```typescript
// Card container
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
)

// Card composition
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
)

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
```

### Form Controls
```typescript
// Input component
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

// Button Group (custom component)
const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("inline-flex rounded-lg border border-input p-1", className)}
      {...props}
    />
  )
)
```

### Alert System
```typescript
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
)
```

## Chart-Specific Styling

### Chart Container Styles
```typescript
// Chart configuration
const chartConfig = {
  layout: {
    background: { type: ColorType.Solid, color: "transparent" },
    textColor: "rgba(0, 0, 0, 0.9)",
  },
  grid: {
    vertLines: { color: "rgba(0, 0, 0, 0.1)" },
    horzLines: { color: "rgba(0, 0, 0, 0.1)" },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
  },
  rightPriceScale: {
    autoScale: true,
    borderVisible: true,
    scaleMargins: { top: 0.2, bottom: 0.2 },
    format: {
      type: 'price',
      precision: 6,
      minMove: 0.000001,
    },
  },
  crosshair: {
    mode: 1,
    vertLine: { width: 1, color: 'rgba(0, 0, 0, 0.3)', style: 3 },
    horzLine: { width: 1, color: 'rgba(0, 0, 0, 0.3)', style: 3 },
  },
}
```

### Tooltip Styling
```typescript
// Dynamic tooltip creation
const toolTip = document.createElement('div');
toolTip.style.display = 'none';
toolTip.style.position = 'absolute';
toolTip.style.padding = '8px';
toolTip.style.boxSizing = 'border-box';
toolTip.style.fontSize = '12px';
toolTip.style.color = 'rgba(0, 0, 0, 0.9)';
toolTip.style.background = 'white';
toolTip.style.border = '1px solid rgba(0, 0, 0, 0.2)';
toolTip.style.borderRadius = '4px';
toolTip.style.zIndex = '1000';
```

## Layout System

### Main Application Layout
```typescript
// Global layout structure
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Page Layout Pattern
```typescript
// Chart page layout
export default function Page() {
  return (
    <main className="container mx-auto p-4">
      <ChartContainer />
    </main>
  )
}
```

### Chart Container Layout
```typescript
// Main chart layout structure
<Card>
  <CardHeader>
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <CardTitle>{chartTitle}</CardTitle>
        <ButtonGroup variant="outline" size="sm">
          {/* Timeframe buttons */}
        </ButtonGroup>
      </div>
      
      <form className="flex justify-center items-center gap-2 max-w-xl mx-auto w-full">
        {/* Search form */}
      </form>
    </div>
  </CardHeader>
  
  <CardContent>
    <div className="flex gap-4">
      <div className="flex-1">
        {/* Chart area */}
      </div>
      <div className="w-64 space-y-6 p-4 border rounded-lg">
        {/* Controls sidebar */}
      </div>
    </div>
  </CardContent>
</Card>
```

## Responsive Design

### Breakpoint System
```css
/* Tailwind default breakpoints */
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### Mobile Optimization
```typescript
// Custom mobile hook
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)")
    const onChange = () => {
      setIsMobile(window.innerWidth < 768)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < 768)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
```

## Utility Functions

### Class Name Utilities
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Usage Pattern
```typescript
// Conditional class application
<div className={cn(
  "base-classes",
  variant === "primary" && "primary-classes",
  disabled && "disabled-classes",
  className
)} />
```

## Accessibility Features

### Focus Management
```css
/* Focus styles */
.focus-visible:outline-none
.focus-visible:ring-2
.focus-visible:ring-ring
.focus-visible:ring-offset-2
```

### Screen Reader Support
```typescript
// ARIA attributes in components
<div role="alert" aria-live="polite">
<button aria-label="Hill Climb Optimization">
<input aria-describedby="helper-text">
```

### Color Contrast
- Meets WCAG AA standards
- High contrast ratios for text
- Sufficient color differentiation for states

## Theme Switching

### Dark Mode Implementation
```typescript
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-[1.5rem] w-[1.3rem] dark:hidden" />
      <Moon className="hidden h-5 w-5 dark:block" />
    </Button>
  )
}
```

This styling system provides a comprehensive, maintainable, and accessible design foundation that scales well with the application's complexity while ensuring consistent user experience across all components.