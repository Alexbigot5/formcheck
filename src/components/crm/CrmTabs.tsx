import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  TrendingUp, 
  CheckSquare, 
  MessageSquare, 
  BarChart3, 
  Settings 
} from "lucide-react";

interface CrmTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const CrmTabs: React.FC<CrmTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "pipeline", label: "Pipeline", icon: TrendingUp },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "communication", label: "Communication", icon: MessageSquare },
    { id: "reporting", label: "Reporting", icon: BarChart3 },
    { id: "admin", label: "Admin", icon: Settings }
  ];

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-6 bg-gray-100 rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
};

export default CrmTabs;
