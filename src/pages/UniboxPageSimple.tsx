import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const UniboxPageSimple: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'unassigned' | 'mine' | 'all'>('unassigned');

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-semibold">Unibox</h1>
            
            {/* Tab counters */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="unassigned" className="relative">
                  Unassigned
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    5
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="mine" className="relative">
                  Assigned to Me
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    3
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="all" className="relative">
                  All
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    12
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex gap-6">
          <div className="w-full">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    Conversations (0)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <div className="text-muted-foreground">
                    <h3 className="text-lg font-medium mb-2">Unibox is Working!</h3>
                    <p>This is a simplified version to test the basic layout.</p>
                    <p className="mt-4 text-sm">Active Tab: {activeTab}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UniboxPageSimple;
