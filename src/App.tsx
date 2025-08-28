import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import FormBuilder from "./pages/FormBuilder";
import LeadScoring from "./pages/LeadScoring";
import EmailTemplates from "./pages/EmailTemplates";
import CrmIntegrations from "./pages/CrmIntegrations";
import Settings from "./pages/Settings";
import SavedEmailTemplates from "./pages/SavedEmailTemplates";
import MultiIntakeSettings from "./pages/MultiIntakeSettings";
import ViewForms from "./pages/ViewForms";
import SourcesDemo from "./pages/SourcesDemo";
import LeadsInboxPage from "./pages/LeadsInboxPage";
import LeadsWorkspaceDemo from "./pages/LeadsWorkspaceDemo";
import LeadDetail from "./pages/LeadDetail";
import IntegrationsPage from "./pages/IntegrationsPage";
import OAuthCallback from "./pages/OAuthCallback";
import AnalyticsPage from "./pages/AnalyticsPage";
import OutboundCampaigns from "./pages/OutboundCampaigns";
import CrmHub from "./pages/CrmHub";
import SourceAnalytics from "./pages/SourceAnalytics";
import UniboxPage from "./pages/UniboxPage";
import UniboxPageSimple from "./pages/UniboxPageSimple";
import UniboxPageWithStore from "./pages/UniboxPageWithStore";
import ErrorBoundary from "./components/ErrorBoundary";
const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
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
        <Route path="/unibox" element={<ErrorBoundary><UniboxPage /></ErrorBoundary>} />
        <Route path="/unibox-full" element={<UniboxPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
