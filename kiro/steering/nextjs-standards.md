# Next.js 14+ Standards

## Version
- **Next.js 14+** with App Router
- **React 18+** with Server Components
- **TypeScript 5+** strict mode

## Project Structure
```
frontend/
├── src/
│   ├── app/              # App Router pages
│   ├── components/       # Reusable components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and API clients
│   ├── store/           # State management (Zustand)
│   ├── types/           # TypeScript definitions
│   └── styles/          # CSS modules
├── public/              # Static assets
└── package.json
```

## App Router Conventions
- **Pages**: Use `page.tsx` for route components
- **Layouts**: Use `layout.tsx` for shared layouts
- **Loading**: Use `loading.tsx` for loading states
- **Error**: Use `error.tsx` for error boundaries
- **API Routes**: Use `route.ts` in API directories

## Component Standards
```typescript
// Server Component
export default async function DashboardPage() {
  const data = await fetchData();
  return <Dashboard data={data} />;
}

// Client Component
'use client';
export function Dashboard({ data }: DashboardProps) {
  const [state, setState] = useState();
  return (
    <div className="container">
      <Header />
      <MainContent data={data} />
      <Footer />
    </div>
  );
}
```

## Styling
- **CSS Modules**: Component-scoped styles
- **Tailwind**: Utility-first CSS (if configured)
- **Design System**: Consistent spacing, colors, typography
- **Responsive**: Mobile-first approach

## State Management
- **Server State**: React Query or SWR for API data
- **Client State**: Zustand for global client state
- **URL State**: Next.js router for route-based state
- **Form State**: React Hook Form with validation

## API Integration
```typescript
// API client
export const api = {
  async getSubscriptions() {
    const res = await fetch('/api/subscriptions');
    return res.json();
  },
  
  async updateSubscription(id: string, data: UpdateData) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
```

## Performance
- **Images**: Use Next.js Image component
- **Fonts**: Use next/font with variable fonts
- **Code Splitting**: Dynamic imports for large components
- **Caching**: Implement proper cache headers
- **Bundle Size**: Keep under 150KB initial load

## Testing
- **Unit Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright or Cypress
- **Accessibility**: axe-core for a11y testing
- **Performance**: Lighthouse CI

## Deployment
- **Build Optimization**: Use next build with analysis
- **Environment Variables**: Next.js runtime configuration
- **Monitoring**: Error tracking and performance monitoring
- **SEO**: Metadata API for search optimization