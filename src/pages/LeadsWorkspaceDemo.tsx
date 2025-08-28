import React, { useState } from "react";
import Layout from "@/components/Layout";
import LeadsWorkspace from "@/components/LeadsWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Crown, Users } from "lucide-react";

const LeadsWorkspaceDemo = () => {
  const [selectedUser, setSelectedUser] = useState('ava');
  const [selectedRole, setSelectedRole] = useState<'sdr' | 'manager'>('sdr');

  const mockUsers = [
    { id: 'ava', name: 'Ava Chen', role: 'sdr' as const },
    { id: 'ben', name: 'Ben Rodriguez', role: 'sdr' as const },
    { id: 'cruz', name: 'Cruz Williams', role: 'sdr' as const },
    { id: 'dana', name: 'Dana Thompson', role: 'sdr' as const },
    { id: 'eli', name: 'Eli Johnson', role: 'sdr' as const },
    { id: 'freya', name: 'Freya Martinez', role: 'sdr' as const },
    { id: 'manager', name: 'Sarah Wilson', role: 'manager' as const },
  ];

  const currentUser = mockUsers.find(u => u.id === selectedUser) || mockUsers[0];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Demo Controls */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Team Leads Workspace Demo</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Experience the redesigned leads management system for teams of 6+ SDRs
                </p>
                <div className="flex items-center space-x-4">
                  <Badge variant="outline" className="bg-white">
                    ✨ Hot Lead Detection
                  </Badge>
                  <Badge variant="outline" className="bg-white">
                    🚀 Fast Claim/Assign
                  </Badge>
                  <Badge variant="outline" className="bg-white">
                    ⏱️ SLA Countdowns
                  </Badge>
                  <Badge variant="outline" className="bg-white">
                    💬 Conversation Drawer
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Switch User:</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-48 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
                            {user.role === 'manager' ? (
                              <Crown className="w-4 h-4 text-yellow-600" />
                            ) : (
                              <User className="w-4 h-4 text-blue-600" />
                            )}
                            <span>{user.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {user.role}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="bg-white"
                >
                  Reset Demo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Features Callout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h3 className="font-medium">Team Inbox</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Unassigned leads that any SDR can claim with one click
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <h3 className="font-medium">My Queue</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Personal leads with next steps, snooze, and due dates
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <h3 className="font-medium">Hot Leads</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Auto-detected high-priority leads with 10m SLA
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <h3 className="font-medium">Smart Routing</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Round-robin assignment with account owner detection
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Workspace */}
        <LeadsWorkspace 
          currentUser={{
            id: currentUser.id,
            name: currentUser.name,
            role: currentUser.role
          }}
        />
      </div>
    </Layout>
  );
};

export default LeadsWorkspaceDemo;
