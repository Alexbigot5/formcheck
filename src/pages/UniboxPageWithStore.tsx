import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { uniboxStore } from '@/store/uniboxStore';
import { Conversation } from '@/lib/types';

const CURRENT_USER = {
  id: 'u-alex',
  name: 'Alex Thompson'
};

const UniboxPageWithStore: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'unassigned' | 'mine' | 'all'>('unassigned');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState({ unassigned: 0, mine: 0, all: 0 });
  const [error, setError] = useState<string | null>(null);

  // Load data function
  const loadData = () => {
    try {
      console.log('Loading data...');
      const convs = uniboxStore.list(activeTab, 'all', '', CURRENT_USER.id);
      const cnts = uniboxStore.counts(CURRENT_USER.id);
      
      console.log('Conversations:', convs);
      console.log('Counts:', cnts);
      
      setConversations(convs);
      setCounts(cnts);
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Load data on mount and tab change
  useEffect(() => {
    loadData();
    
    // Subscribe to store changes
    const unsubscribe = uniboxStore.subscribe(() => {
      console.log('Store changed, reloading data...');
      loadData();
    });
    
    return unsubscribe;
  }, [activeTab]);

  if (error) {
    return (
      <Layout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-800">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-semibold">Unibox (With Store)</h1>
            
            {/* Tab counters */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="unassigned" className="relative">
                  Unassigned
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    {counts.unassigned}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="mine" className="relative">
                  Assigned to Me
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    {counts.mine}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="all" className="relative">
                  All
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    {counts.all}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={loadData}>
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
                    Conversations ({conversations.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {conversations.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground">
                      <h3 className="text-lg font-medium mb-2">Store Working!</h3>
                      <p>Found {conversations.length} conversations for tab: {activeTab}</p>
                      <div className="mt-4 text-sm">
                        <p>Counts: Unassigned: {counts.unassigned}, Mine: {counts.mine}, All: {counts.all}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <div key={conv.id} className="p-3 border rounded-lg">
                        <h4 className="font-medium">{conv.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          {conv.contactName} • {conv.channel}
                          {conv.assigneeName && ` • Assigned to: ${conv.assigneeName}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UniboxPageWithStore;
