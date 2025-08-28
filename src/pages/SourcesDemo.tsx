import React from "react";
import Layout from "@/components/Layout";
import SourcesWizardSimple from "@/components/SourcesWizardSimple";

const SourcesDemo = () => {
  return (
    <Layout>
      <div>
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Lead Sources</h1>
          <p className="text-muted-foreground mt-1">Configure your lead ingestion sources and integrations.</p>
        </header>
        <SourcesWizardSimple />
      </div>
    </Layout>
  );
};

export default SourcesDemo;
