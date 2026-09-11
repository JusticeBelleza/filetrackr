/* eslint-disable react-refresh/only-export-components */
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

// Keep AppLayout static so the sidebar/shell renders instantly!
import AppLayout from './components/layout/AppLayout';
import './index.css';
import GlobalErrorBoundary from './components/system/GlobalErrorBoundary';

// 1. DYNAMIC IMPORTS: Only load the page code when the user navigates to it
const Dashboard = lazy(() => import('./routes/dashboard'));
const Processing = lazy(() => import('./routes/processing'));
const History = lazy(() => import('./routes/history'));
const Admin = lazy(() => import('./routes/admin'));
const Settings = lazy(() => import('./routes/settings'));
const Login = lazy(() => import('./routes/login'));

// Initialize React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

// 2. INVISIBLE ROUTE LOADER
// This prevents the "double loader" clash by letting the individual pages 
// handle their own data-loading spinners (the green circles).
const PageSkeleton = () => (
  <div className="w-full h-full min-h-[60vh] bg-transparent"></div>
);

// 3. SETUP REACT ROUTER WITH SUSPENSE WRAPPERS
const router = createBrowserRouter([
  // Public Route (No Sidebar/Navigation)
  {
    path: '/login',
    element: <Suspense fallback={<PageSkeleton />}><Login /></Suspense>,
    errorElement: <GlobalErrorBoundary />, // Catch chunk errors on the login page
  },
  // Private Routes (Wrapped in static AppLayout)
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <GlobalErrorBoundary />, // Catch chunk errors inside the app
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense> },
      { path: 'processing', element: <Suspense fallback={<PageSkeleton />}><Processing /></Suspense> },
      { path: 'history', element: <Suspense fallback={<PageSkeleton />}><History /></Suspense> },
      { path: 'admin', element: <Suspense fallback={<PageSkeleton />}><Admin /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<PageSkeleton />}><Settings /></Suspense> },
    ],
  },
  // Fallback redirect for unknown routes
  {
    path: '*',
    element: <Navigate to="/login" replace />
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>
);