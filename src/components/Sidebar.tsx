import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Eye, 
  Inbox, 
  Target, 
  Mail, 
  Settings, 
  Database,
  PlusCircle,
  BarChart3,
  Send,
  Building2,
  TrendingUp
} from "lucide-react";

const sidebarItems = [
  {
    title: "Create New Form",
    href: "/forms/new",
    icon: PlusCircle,
    variant: "default" as const,
  },
  {
    title: "View Forms",
    href: "/forms",
    icon: Eye,
  },
  {
    title: "Lead Inbox",
    href: "/leads",
    icon: Inbox,
  },
  {
    title: "Lead Scoring",
    href: "/lead-scoring",
    icon: Target,
  },
  {
    title: "Email Templates",
    href: "/email-templates",
    icon: Mail,
  },
  {
    title: "CRM Integrations",
    href: "/integrations/crm",
    icon: Database,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Lead Sources",
    href: "/sources",
    icon: BarChart3,
  },
  {
    title: "Outbound Campaigns",
    href: "/outbound-campaigns",
    icon: Send,
  },
  {
    title: "CRM Hub",
    href: "/crm",
    icon: Building2,
  },
  {
    title: "Source Analytics",
    href: "/source-analytics",
    icon: TrendingUp,
  },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <a href="/" className="text-lg font-semibold text-foreground">
          SmartForms AI
        </a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {sidebarItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.href}
              variant={item.variant || (isActive ? "secondary" : "ghost")}
              className={cn(
                "w-full justify-start gap-3 h-10 px-3",
                isActive && "bg-secondary text-secondary-foreground font-medium"
              )}
              onClick={() => navigate(item.href)}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
