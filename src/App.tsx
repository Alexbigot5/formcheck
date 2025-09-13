import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Import critical pages directly (needed for initial load)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy load all other pages to reduce initial bundle size
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const LeadScoring = lazy(() => import("./pages/LeadScoring"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const CrmIntegrations = lazy(() => import("./pages/CrmIntegrations"));
const Settings = lazy(() => import("./pages/Settings"));
const SavedEmailTemplates = lazy(() => import("./pages/SavedEmailTemplates"));
const MultiIntakeSettings = lazy(() => import("./pages/MultiIntakeSettings"));
const ViewForms = lazy(() => import("./pages/ViewForms"));
const SourcesDemo = lazy(() => import("./pages/SourcesDemo"));
const LeadsInboxPage = lazy(() => import("./pages/LeadsInboxPage"));
const LeadsWorkspaceDemo = lazy(() => import("./pages/LeadsWorkspaceDemo"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const OutboundCampaigns = lazy(() => import("./pages/OutboundCampaigns"));
const CrmHub = lazy(() => import("./pages/CrmHub"));
const SourceAnalytics = lazy(() => import("./pages/SourceAnalytics"));
const UniboxPage = lazy(() => import("./pages/UniboxPage"));
const SmartRecommendationsHub = lazy(() => import("./pages/SmartRecommendationsHub"));
const IntelligenceJourneys = lazy(() => import("./pages/IntelligenceJourneys"));
const IntelligenceRevenue = lazy(() => import("./pages/IntelligenceRevenue"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);
const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Critical pages loaded immediately */}
          <Route path="/" element={<Index />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          
          {/* All other pages lazy loaded */}
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/forms/new" element={<FormBuilder />} />
          <Route path="/forms" element={<ViewForms />} />
          <Route path="/forms/edit/:id" element={<FormBuilder />} />
          <Route path="/leads" element={<LeadsInboxPage />} />
          <Route path="/leads-workspace" element={<LeadsWorkspaceDemo />} />
          <Route path="/lead-scoring" element={<LeadScoring />} />
          <Route path="/email-templates" element={<EmailTemplates />} />
          <Route path="/email-templates/saved" element={<SavedEmailTemplates />} />
          <Route path="/integrations/crm" element={<CrmIntegrations />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/multi-intake" element={<MultiIntakeSettings />} />
          <Route path="/sources" element={<SourcesDemo />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/outbound-campaigns" element={<OutboundCampaigns />} />
          <Route path="/crm" element={<CrmHub />} />
          <Route path="/source-analytics" element={<SourceAnalytics />} />
          <Route path="/recommendations" element={<SmartRecommendationsHub />} />
          <Route path="/intelligence/journeys" element={<IntelligenceJourneys />} />
          <Route path="/intelligence/revenue" element={<IntelligenceRevenue />} />
          <Route path="/intelligence/funnel" element={<SmartRecommendationsHub />} />
          <Route path="/intelligence/predictive" element={<SmartRecommendationsHub />} />
          <Route path="/intelligence/competitive" element={<SmartRecommendationsHub />} />
          <Route path="/intelligence/persona" element={<SmartRecommendationsHub />} />
          <Route path="/unibox" element={<ErrorBoundary><UniboxPage /></ErrorBoundary>} />
          <Route path="/unibox-full" element={<UniboxPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
