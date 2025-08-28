import React from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showBackButton?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true, showBackButton = true }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isDashboard = location.pathname === "/dashboard";
  const shouldShowBackButton = showBackButton && isAuthenticated && !isDashboard;

  if (!isAuthenticated || !showSidebar) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {shouldShowBackButton && (
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
