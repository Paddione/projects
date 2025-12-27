import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { ShortcutsOverlay } from '@/components/shortcuts/shortcuts-overlay';
import ErrorBoundary from '@/components/ErrorBoundary';
import Home from '@/pages/home';
import AdminErrorsPage from '@/pages/admin-errors';
import DuplicatesPage from '@/pages/duplicates';
import TagsPage from '@/pages/tags';
import AnalyticsPage from '@/pages/analytics';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/duplicates" component={DuplicatesPage} />
      <Route path="/tags" component={TagsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/admin/errors" component={AdminErrorsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <ShortcutsOverlay />
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
