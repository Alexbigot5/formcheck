import React from "react";
import Layout from "@/components/Layout";
import LeadsWorkspace from "@/components/LeadsWorkspace";

const LeadsInboxPage = () => {
  return (
    <Layout>
      <LeadsWorkspace 
        currentUser={{ 
          id: 'ava', 
          name: 'Ava Chen', 
          role: 'sdr' 
        }}
      />
    </Layout>
  );
};

export default LeadsInboxPage;
