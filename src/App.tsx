import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DemoBanner } from "@/components/DemoBanner";
import { AuthProvider } from "@/hooks/useAuth";
import { ScrollToTop } from "@/hooks/useScrollToTop";
import { Loader2 } from "lucide-react";
import { GuideProvider } from "@/components/guide/GuideProvider";

// Route-level code splitting keeps the initial bundle small — the landing
// page shouldn't have to download the recharts-heavy liquidity timeline.
const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Login = lazy(() => import("./pages/Login"));
const CrisisWizard = lazy(() => import("./pages/CrisisWizard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ForAdvisors = lazy(() => import("./pages/ForAdvisors"));
const AdvisorReferrals = lazy(() => import("./pages/AdvisorReferrals"));
const AdvisorProfile = lazy(() => import("./pages/AdvisorProfile"));
const LiquidityTimeline = lazy(() => import("./pages/LiquidityTimeline"));
const LiquidityPlanner = lazy(() => import("./pages/LiquidityPlanner"));
const KBRModule = lazy(() => import("./pages/KBRModule"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminInbox = lazy(() => import("./pages/AdminInbox"));
const AdminOverview = lazy(() => import("./pages/AdminOverview"));
const DashboardParticipants = lazy(() => import("./pages/DashboardParticipants"));
const InvitationAccept = lazy(() => import("./pages/InvitationAccept"));
const DashboardAudit = lazy(() => import("./pages/DashboardAudit"));
const PractitionerCases = lazy(() => import("./pages/PractitionerCases"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers"));
const AdminApplications = lazy(() => import("./pages/AdminApplications"));
const AdminCompanies = lazy(() => import("./pages/AdminCompanies"));
const AdminAdvisors = lazy(() => import("./pages/AdminAdvisors"));
const AdminStats = lazy(() => import("./pages/AdminStats"));
const AdminAnalysis = lazy(() => import("./pages/AdminAnalysis"));
const AdminLogs = lazy(() => import("./pages/AdminLogs"));
const DashboardDocuments = lazy(() => import("./pages/DashboardDocuments"));
const DashboardSamtal = lazy(() => import("./pages/DashboardSamtal"));
const DashboardAlternativ = lazy(() => import("./pages/DashboardAlternativ"));
const SharedCase = lazy(() => import("./pages/SharedCase"));
const DashboardMessages = lazy(() => import("./pages/DashboardMessages"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const CreditDossierPage = lazy(() => import("./pages/CreditDossierPage"));
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
            {/* Guiden ligger innanför routern - den byter vy - men
                utanför Suspense, så att en pågående rundtur överlever
                att nästa sida laddar sin kodbit. */}
            <GuideProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/om" element={<About />} />
                {/* Två innehåll, samma sida: identisk form, och de ska
                    inte kunna glida isär. */}
                <Route path="/integritetspolicy" element={<LegalPage kind="integritet" />} />
                <Route path="/villkor" element={<LegalPage kind="villkor" />} />
                <Route path="/kunskap" element={<Knowledge />} />
                <Route path="/api" element={<ApiDocs />} />
                <Route path="/kunskap/:slug" element={<Knowledge />} />
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
                  path="/dashboard/samtal"
                  element={
                    <ProtectedRoute>
                      <DashboardSamtal />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/alternativ"
                  element={
                    <ProtectedRoute>
                      <DashboardAlternativ />
                    </ProtectedRoute>
                  }
                />
                {/* Live ärendelänken: publik - skyddet ligger i länken
                    (tidsbegränsad, återkallbar, loggad), inte i inloggningen. */}
                <Route path="/lank/:token" element={<SharedCase />} />
                <Route
                  path="/dashboard/meddelanden"
                  element={
                    <ProtectedRoute>
                      <DashboardMessages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/kreditunderlag"
                  element={
                    <ProtectedRoute>
                      <CreditDossierPage />
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
                <Route
                  path="/dashboard/deltagare"
                  element={
                    <ProtectedRoute>
                      <DashboardParticipants />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/handelser"
                  element={
                    <ProtectedRoute>
                      <DashboardAudit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/arenden"
                  element={
                    <ProtectedRoute>
                      <PractitionerCases />
                    </ProtectedRoute>
                  }
                />
                {/* Acceptsidan är publik: den ska kunna förklara läget för en
                    utloggad mottagare i stället för att studsa till login. */}
                <Route path="/inbjudan/:id" element={<InvitationAccept />} />
                <Route path="/likviditetsplan" element={<LiquidityPlanner />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/for-radgivare" element={<ForAdvisors />} />
                <Route path="/mina-forfragningar" element={<AdvisorReferrals />} />
                <Route path="/byraprofil" element={<AdvisorProfile />} />
                <Route path="/kontakt" element={<Contact />} />
                {/* Driftinkorgen. ProtectedRoute kräver bara inloggning -
                    behörighetsprövningen görs i sidan och, det som räknas, av
                    RLS på public.contact_messages. */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminOverview />
                    </ProtectedRoute>
                  }
                />
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
                <Route
                  path="/admin/foretag"
                  element={
                    <ProtectedRoute>
                      <AdminCompanies />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/radgivare"
                  element={
                    <ProtectedRoute>
                      <AdminAdvisors />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/statistik"
                  element={
                    <ProtectedRoute>
                      <AdminStats />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/analys"
                  element={
                    <ProtectedRoute>
                      <AdminAnalysis />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/loggar"
                  element={
                    <ProtectedRoute>
                      <AdminLogs />
                    </ProtectedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </GuideProvider>
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
