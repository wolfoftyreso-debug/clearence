import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DemoBanner } from "@/components/DemoBanner";
import { AuthProvider } from "@/hooks/useAuth";
import { ScrollToTop } from "@/hooks/useScrollToTop";
import { Loader2 } from "lucide-react";

// Route-level code splitting keeps the initial bundle small — the landing
// page shouldn't have to download the recharts-heavy liquidity timeline.
const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const Login = lazy(() => import("./pages/Login"));
const CrisisWizard = lazy(() => import("./pages/CrisisWizard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ForAdvisors = lazy(() => import("./pages/ForAdvisors"));
const AdvisorReferrals = lazy(() => import("./pages/AdvisorReferrals"));
const LiquidityTimeline = lazy(() => import("./pages/LiquidityTimeline"));
const LiquidityPlanner = lazy(() => import("./pages/LiquidityPlanner"));
const KBRModule = lazy(() => import("./pages/KBRModule"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminInbox = lazy(() => import("./pages/AdminInbox"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers"));
const AdminApplications = lazy(() => import("./pages/AdminApplications"));
const DashboardDocuments = lazy(() => import("./pages/DashboardDocuments"));
const DashboardMessages = lazy(() => import("./pages/DashboardMessages"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="w-6 h-6 animate-spin text-accent" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            {/* Varje ny sida börjar överst. Ligger innanför routern,
                utanför Suspense: den ska köra även när nästa sida
                fortfarande laddar sin kodbit. */}
            <ScrollToTop />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/om" element={<About />} />
                <Route path="/login" element={<Login />} />
                <Route path="/wizard" element={<CrisisWizard />} />
                <Route path="/kbr" element={<KBRModule />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/liquidity"
                  element={
                    <ProtectedRoute>
                      <LiquidityTimeline />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/dokument"
                  element={
                    <ProtectedRoute>
                      <DashboardDocuments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/meddelanden"
                  element={
                    <ProtectedRoute>
                      <DashboardMessages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/installningar"
                  element={
                    <ProtectedRoute>
                      <DashboardSettings />
                    </ProtectedRoute>
                  }
                />
                <Route path="/likviditetsplan" element={<LiquidityPlanner />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/for-radgivare" element={<ForAdvisors />} />
                <Route path="/mina-forfragningar" element={<AdvisorReferrals />} />
                <Route path="/kontakt" element={<Contact />} />
                {/* Driftinkorgen. ProtectedRoute kräver bara inloggning -
                    behörighetsprövningen görs i sidan och, det som räknas, av
                    RLS på public.contact_messages. */}
                <Route
                  path="/admin/inkorg"
                  element={
                    <ProtectedRoute>
                      <AdminInbox />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/kunder"
                  element={
                    <ProtectedRoute>
                      <AdminCustomers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/ansokningar"
                  element={
                    <ProtectedRoute>
                      <AdminApplications />
                    </ProtectedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            {/* Inside AuthProvider: the banner links to the demo sign-in only
                while signed out, so it needs the auth context. */}
            <DemoBanner />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
