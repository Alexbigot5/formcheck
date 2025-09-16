import React, { useState } from "react";
import Layout from "@/components/Layout";
import CrmTabs from "@/components/crm/CrmTabs";
import ContactsTab from "@/components/crm/ContactsTab";
import PipelineTab from "@/components/crm/PipelineTab";
import TasksTab from "@/components/crm/TasksTab";
import CommunicationTab from "@/components/crm/CommunicationTab";
import ReportingTab from "@/components/crm/ReportingTab";
import AdminTab from "@/components/crm/AdminTab";

// Mock data types
export interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  owner: string;
  tags: string[];
  phone?: string;
  title?: string;
  activities: Activity[];
}

export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  owner: string;
  stage: string;
  probability: number;
  closeDate: string;
}

export interface Task {
  id: string;
  type: 'Call' | 'Email' | 'Meeting' | 'To-do';
  title: string;
  dueDate: string;
  owner: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Completed';
}

export interface Message {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
  thread: MessageThread[];
}

export interface MessageThread {
  id: string;
  from: string;
  content: string;
  timestamp: string;
  type: 'sent' | 'received';
}

export interface Activity {
  id: string;
  type: 'Email' | 'Task' | 'Note' | 'Call';
  description: string;
  date: string;
  user: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'SDR' | 'AE' | 'Manager';
  avatar?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  details: string;
}

const CrmHub = () => {
  const [activeTab, setActiveTab] = useState("contacts");
  const [loading, setLoading] = useState(false);

  // TODO: Replace with real API calls to CRM backend
  // Mock data (to be replaced with real API integration)
  const [contacts] = useState<Contact[]>([
    {
      id: "1",
      name: "John Smith",
      email: "john@acme.com",
      company: "Acme Corp",
      owner: "Sarah Chen",
      tags: ["Hot Lead", "Enterprise"],
      phone: "+1 (555) 123-4567",
      title: "CTO",
      activities: [
        { id: "a1", type: "Email", description: "Sent product demo", date: "2024-01-15", user: "Sarah Chen" },
        { id: "a2", type: "Call", description: "Discovery call completed", date: "2024-01-10", user: "Sarah Chen" },
        { id: "a3", type: "Note", description: "Interested in enterprise features", date: "2024-01-08", user: "Sarah Chen" }
      ]
    },
    {
      id: "2",
      name: "Emma Johnson",
      email: "emma@techstart.io",
      company: "TechStart",
      owner: "Mike Johnson",
      tags: ["Qualified", "SaaS"],
      phone: "+1 (555) 987-6543",
      title: "VP Marketing",
      activities: [
        { id: "a4", type: "Email", description: "Follow-up on pricing", date: "2024-01-12", user: "Mike Johnson" },
        { id: "a5", type: "Task", description: "Schedule demo", date: "2024-01-09", user: "Mike Johnson" }
      ]
    },
    {
      id: "3",
      name: "David Chen",
      email: "david@innovate.com",
      company: "Innovate Labs",
      owner: "Emma Davis",
      tags: ["New", "SMB"],
      phone: "+1 (555) 456-7890",
      title: "Founder",
      activities: [
        { id: "a6", type: "Note", description: "Initial contact made", date: "2024-01-14", user: "Emma Davis" }
      ]
    },
    {
      id: "4",
      name: "Lisa Rodriguez",
      email: "lisa@growthco.com",
      company: "Growth Co",
      owner: "Alex Rodriguez",
      tags: ["Proposal", "Mid-Market"],
      phone: "+1 (555) 321-0987",
      title: "Head of Sales",
      activities: [
        { id: "a7", type: "Email", description: "Proposal sent", date: "2024-01-13", user: "Alex Rodriguez" },
        { id: "a8", type: "Call", description: "Negotiation call", date: "2024-01-11", user: "Alex Rodriguez" }
      ]
    },
    {
      id: "5",
      name: "Michael Brown",
      email: "michael@enterprise.com",
      company: "Enterprise Solutions",
      owner: "Sarah Chen",
      tags: ["Champion", "Enterprise"],
      phone: "+1 (555) 654-3210",
      title: "IT Director",
      activities: [
        { id: "a9", type: "Call", description: "Technical deep dive", date: "2024-01-16", user: "Sarah Chen" }
      ]
    }
  ]);

  const [deals] = useState<Deal[]>([
    { id: "d1", title: "Acme Corp - Enterprise License", company: "Acme Corp", value: 50000, owner: "Sarah Chen", stage: "Qualified", probability: 75, closeDate: "2024-02-15" },
    { id: "d2", title: "TechStart - SaaS Platform", company: "TechStart", value: 25000, owner: "Mike Johnson", stage: "Meeting", probability: 60, closeDate: "2024-01-30" },
    { id: "d3", title: "Innovate Labs - Starter Plan", company: "Innovate Labs", value: 5000, owner: "Emma Davis", stage: "New", probability: 20, closeDate: "2024-03-01" },
    { id: "d4", title: "Growth Co - Scale Package", company: "Growth Co", value: 35000, owner: "Alex Rodriguez", stage: "Proposal", probability: 80, closeDate: "2024-02-01" },
    { id: "d5", title: "Enterprise Solutions - Custom", company: "Enterprise Solutions", value: 75000, owner: "Sarah Chen", stage: "Negotiation", probability: 90, closeDate: "2024-01-25" }
  ]);

  const [tasks] = useState<Task[]>([
    { id: "t1", type: "Call", title: "Follow up with Acme Corp", dueDate: "2024-01-18", owner: "Sarah Chen", priority: "High", status: "Open" },
    { id: "t2", type: "Email", title: "Send proposal to Growth Co", dueDate: "2024-01-17", owner: "Alex Rodriguez", priority: "High", status: "Completed" },
    { id: "t3", type: "Meeting", title: "Demo for TechStart", dueDate: "2024-01-19", owner: "Mike Johnson", priority: "Medium", status: "Open" },
    { id: "t4", type: "To-do", title: "Update CRM records", dueDate: "2024-01-16", owner: "Emma Davis", priority: "Low", status: "Open" },
    { id: "t5", type: "Call", title: "Discovery call with new lead", dueDate: "2024-01-20", owner: "Sarah Chen", priority: "Medium", status: "Open" }
  ]);

  const [messages] = useState<Message[]>([
    {
      id: "m1",
      from: "john@acme.com",
      subject: "Re: Product Demo Follow-up",
      snippet: "Thanks for the demo yesterday. We're very interested in moving forward...",
      date: "2024-01-16",
      isRead: false,
      thread: [
        { id: "mt1", from: "sarah@company.com", content: "Hi John, thanks for your time yesterday. Here's the demo recording...", timestamp: "2024-01-15 10:00", type: "sent" },
        { id: "mt2", from: "john@acme.com", content: "Thanks for the demo yesterday. We're very interested in moving forward with the enterprise package.", timestamp: "2024-01-16 09:30", type: "received" }
      ]
    },
    {
      id: "m2",
      from: "emma@techstart.io",
      subject: "Pricing Question",
      snippet: "Could you clarify the pricing for the mid-tier plan?",
      date: "2024-01-15",
      isRead: true,
      thread: [
        { id: "mt3", from: "emma@techstart.io", content: "Could you clarify the pricing for the mid-tier plan?", timestamp: "2024-01-15 14:20", type: "received" },
        { id: "mt4", from: "mike@company.com", content: "Sure! The mid-tier plan is $299/month and includes...", timestamp: "2024-01-15 15:45", type: "sent" }
      ]
    }
  ]);

  const [users] = useState<User[]>([
    { id: "u1", name: "Sarah Chen", email: "sarah@company.com", role: "AE" },
    { id: "u2", name: "Mike Johnson", email: "mike@company.com", role: "SDR" },
    { id: "u3", name: "Emma Davis", email: "emma@company.com", role: "SDR" },
    { id: "u4", name: "Alex Rodriguez", email: "alex@company.com", role: "AE" },
    { id: "u5", name: "David Wilson", email: "david@company.com", role: "Manager" }
  ]);

  const [auditLogs] = useState<AuditLog[]>([
    { id: "al1", user: "Alex Rodriguez", action: "Stage Change", timestamp: "2024-01-16 10:30", details: "Changed Deal 'Growth Co - Scale Package' from Qualified to Proposal" },
    { id: "al2", user: "Sarah Chen", action: "Contact Update", timestamp: "2024-01-16 09:15", details: "Updated contact John Smith - added phone number" },
    { id: "al3", user: "Mike Johnson", action: "Task Created", timestamp: "2024-01-15 16:45", details: "Created task 'Demo for TechStart'" },
    { id: "al4", user: "Emma Davis", action: "Note Added", timestamp: "2024-01-15 14:20", details: "Added note to contact David Chen" }
  ]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "contacts":
        return <ContactsTab contacts={contacts} />;
      case "pipeline":
        return <PipelineTab deals={deals} />;
      case "tasks":
        return <TasksTab tasks={tasks} />;
      case "communication":
        return <CommunicationTab messages={messages} />;
      case "reporting":
        return <ReportingTab contacts={contacts} deals={deals} />;
      case "admin":
        return <AdminTab users={users} auditLogs={auditLogs} />;
      default:
        return <ContactsTab contacts={contacts} />;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">CRM Hub</h1>
          <p className="text-muted-foreground mt-1">
            Unified customer relationship management platform
          </p>
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              📝 Note: Currently displaying demo data. Connect your CRM integration to see real data.
            </p>
          </div>
        </header>

        <CrmTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="bg-white rounded-xl border shadow-sm min-h-[600px]">
          {renderTabContent()}
        </div>
      </div>
    </Layout>
  );
};

export default CrmHub;
