import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Navigation } from "@/components/navigation";
import { BusinessBranchSelectorModal } from "@/components/business-branch-selector";
import ProductsPage from "@/pages/products";
import ProductDetailPage from "@/pages/product-detail";
import SalesPage from "@/pages/sales";
import ReportsPage from "@/pages/reports";
import BusinessesPage from "@/pages/businesses";
import UsersPage from "@/pages/users";
import BranchesPage from "@/pages/branches";
import SettingsPage from "@/pages/settings";
import AuditPage from "@/pages/audit";
import LoginPage from "@/pages/login";
import InvitePage from "@/pages/invite";
import PricingPage from "@/pages/pricing";
import RegisterPage from "@/pages/register";
import BillingPage from "@/pages/billing";
import AdminPlansPage from "@/pages/admin-plans";
import AdminFeatureFlagsPage from "@/pages/admin-feature-flags";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function RedirectIfAuthenticated({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <RedirectIfAuthenticated component={LoginPage} />
      </Route>
      <Route path="/pricing" component={PricingPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/">
        <ProtectedRoute component={SalesPage} />
      </Route>
      <Route path="/stock">
        <ProtectedRoute component={ProductsPage} />
      </Route>
      <Route path="/products/:id">
        <ProtectedRoute component={ProductDetailPage} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={ReportsPage} />
      </Route>
      <Route path="/users">
        <AdminRoute component={UsersPage} />
      </Route>
      <Route path="/businesses">
        <AdminRoute component={BusinessesPage} />
      </Route>
      <Route path="/branches">
        <AdminRoute component={BranchesPage} />
      </Route>
      <Route path="/settings">
        <AdminRoute component={SettingsPage} />
      </Route>
      <Route path="/audit">
        <AdminRoute component={AuditPage} />
      </Route>
      <Route path="/billing">
        <AdminRoute component={BillingPage} />
      </Route>
      <Route path="/admin/plans">
        <AdminRoute component={AdminPlansPage} />
      </Route>
      <Route path="/admin/feature-flags">
        <AdminRoute component={AdminFeatureFlagsPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {user && <Navigation />}
      {user && <BusinessBranchSelectorModal />}
      <main>
        <Router />
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
