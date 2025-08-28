import React, { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  Filter,
  Search,
  Settings
} from "lucide-react";
import { SOURCE_CONFIG, getSourceConfig, SOURCE_CATEGORIES, POPULAR_SOURCES } from "@/lib/sourceMapping";
import { MailchimpWizard } from "@/components/source-wizards/MailchimpWizard";
import { CalendlyWizard } from "@/components/source-wizards/CalendlyWizard";
import { TypeformWizard } from "@/components/source-wizards/TypeformWizard";
import { IntercomWizard } from "@/components/source-wizards/IntercomWizard";

interface LeadSource {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  isConnected: boolean;
  lastSeen?: string;
  status: 'connected' | 'disconnected' | 'pending';
  category: string;
  webhookSupported: boolean;
  setupComplexity: 'easy' | 'medium' | 'complex';
}

const MultiIntakeSettings = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeWizard, setActiveWizard] = useState<string | null>(null);
  
  // Initialize with popular sources + existing ones
  const initializeSources = (): LeadSource[] => {
    const allSourceIds = [
      // Popular webhook-supported sources
      'website-form', 'mailchimp', 'calendly', 'typeform', 'intercom', 'shopify',
      'linkedin-leads', 'facebook-leads', 'convertkit', 'drift', 'stripe',
      // Existing sources
      'shared-inbox', 'instagram-dms', 'linkedin-csv', 'webhook',
      // Additional useful sources
      'youtube', 'twitter', 'zendesk', 'crisp', 'zoom', 'woocommerce'
    ];
    
    return allSourceIds.map(sourceId => {
      const config = getSourceConfig(sourceId);
      return {
        id: sourceId,
        name: config.label,
        description: config.description,
        icon: config.icon,
        isConnected: false,
        status: 'disconnected' as const,
        category: config.category,
        webhookSupported: config.webhookSupported,
        setupComplexity: config.setupComplexity
      };
    });
  };
  
  const [leadSources, setLeadSources] = useState<LeadSource[]>(initializeSources());
  
  // Filter sources based on category and search
  const filteredSources = leadSources.filter(source => {
    const matchesCategory = selectedCategory === 'all' || source.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  const connectedSources = leadSources.filter(source => source.isConnected).length;
  const progressPercentage = (connectedSources / leadSources.length) * 100;
  const webhookSources = leadSources.filter(source => source.webhookSupported).length;

  const handleConnect = (sourceId: string) => {
    // Check if source has a dedicated wizard
    if (['mailchimp', 'calendly', 'typeform', 'intercom'].includes(sourceId)) {
      setActiveWizard(sourceId);
    } else {
      // For sources without wizards, mark as connected directly
      setLeadSources(prev => prev.map(source => 
        source.id === sourceId 
          ? { ...source, isConnected: true, status: 'connected' as const, lastSeen: 'Just now' }
          : source
      ));
      toast.success("Source connected successfully!");
    }
  };

  const handleWizardComplete = (sourceId: string) => {
    setLeadSources(prev => prev.map(source => 
      source.id === sourceId 
        ? { ...source, isConnected: true, status: 'connected' as const, lastSeen: 'Just now' }
        : source
    ));
    setActiveWizard(null);
    toast.success("Source connected successfully!");
  };

  const handleWizardClose = () => {
    setActiveWizard(null);
  };

  const handleSendTest = (sourceName: string) => {
    toast.info(`Sending test to ${sourceName}...`, {
      description: "Check your connected platform for the test message."
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Connected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <section className="container mx-auto px-4 py-10">
          <div className="mb-6 flex items-center gap-4">
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

          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Multi-Intake Settings</h1>
            <p className="text-muted-foreground mt-1">
              Connect all your lead sources to capture every opportunity
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>• {leadSources.length} total sources available</span>
              <span>• {webhookSources} webhook-supported</span>
              <span>• {connectedSources} currently connected</span>
            </div>
          </header>

          {/* Progress Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Lead Source Setup Progress
                <span className="text-sm font-normal text-muted-foreground">
                  {connectedSources} of {leadSources.length} sources connected
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercentage} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                Connect more sources to capture leads from every channel
              </p>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search sources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All ({leadSources.length})
              </Button>
              {SOURCE_CATEGORIES.map(category => {
                const count = leadSources.filter(s => s.category === category.id).length;
                const CategoryIcon = category.icon;
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="gap-1"
                  >
                    <CategoryIcon className="h-3 w-3" />
                    {category.label} ({count})
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Lead Sources */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((source) => {
              const IconComponent = source.icon;
              return (
                <Card key={source.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{source.name}</CardTitle>
                            {source.webhookSupported && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">Webhook</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {source.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                source.setupComplexity === 'easy' ? 'text-green-600 border-green-200' :
                                source.setupComplexity === 'medium' ? 'text-yellow-600 border-yellow-200' :
                                'text-red-600 border-red-200'
                              }`}
                            >
                              {source.setupComplexity} setup
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {source.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {getStatusIcon(source.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status:</span>
                      {getStatusBadge(source.status)}
                    </div>
                    
                    {source.lastSeen && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Last seen:</span>
                        <span className="text-sm text-muted-foreground">{source.lastSeen}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {!source.isConnected ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleConnect(source.id)}
                          className="flex-1"
                        >
                          {['mailchimp', 'calendly', 'typeform', 'intercom'].includes(source.id) ? (
                            <>
                              <Settings className="w-3 h-3 mr-1" />
                              Setup
                            </>
                          ) : (
                            'Connect'
                          )}
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleConnect(source.id)}
                          className="flex-1"
                        >
                          {['mailchimp', 'calendly', 'typeform', 'intercom'].includes(source.id) ? (
                            <>
                              <Settings className="w-3 h-3 mr-1" />
                              Reconfigure
                            </>
                          ) : (
                            'Reconnect'
                          )}
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleSendTest(source.name)}
                        disabled={!source.isConnected}
                        className="flex-1"
                      >
                        Send Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{connectedSources}</div>
                <p className="text-sm text-muted-foreground">Sources Connected</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{webhookSources}</div>
                <p className="text-sm text-muted-foreground">Webhook Supported</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{leadSources.filter(s => s.setupComplexity === 'easy').length}</div>
                <p className="text-sm text-muted-foreground">Easy Setup</p>
              </CardContent>
            </Card>
          </div>

          {/* Popular Sources */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>🔥 Most Popular Sources</CardTitle>
              <p className="text-sm text-muted-foreground">
                Start with these high-converting lead sources
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {POPULAR_SOURCES.slice(0, 8).map(sourceId => {
                  const source = leadSources.find(s => s.id === sourceId);
                  if (!source) return null;
                  const config = getSourceConfig(sourceId);
                  const IconComponent = config.icon;
                  return (
                    <div key={sourceId} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center" 
                        style={{ backgroundColor: `${config.color}20` }}
                      >
                        <IconComponent className="w-4 h-4" style={{ color: config.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {source.isConnected ? '✅ Connected' : '⚪ Available'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Integration Tips */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>💡 Integration Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <strong>Webhook Sources:</strong> Get instant lead notifications with real-time webhook integration
              </div>
              <div className="text-sm">
                <strong>Easy Setup:</strong> Green badges indicate sources that can be connected in under 5 minutes
              </div>
              <div className="text-sm">
                <strong>Popular Combo:</strong> Start with Website Form + Mailchimp + Calendly for 80% coverage
              </div>
              <div className="text-sm">
                <strong>Advanced:</strong> Use Generic Webhook to connect any platform not listed here
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Wizards */}
      {activeWizard === 'mailchimp' && (
        <MailchimpWizard 
          onClose={handleWizardClose} 
          onComplete={handleWizardComplete} 
        />
      )}
      {activeWizard === 'calendly' && (
        <CalendlyWizard 
          onClose={handleWizardClose} 
          onComplete={handleWizardComplete} 
        />
      )}
      {activeWizard === 'typeform' && (
        <TypeformWizard 
          onClose={handleWizardClose} 
          onComplete={handleWizardComplete} 
        />
      )}
      {activeWizard === 'intercom' && (
        <IntercomWizard 
          onClose={handleWizardClose} 
          onComplete={handleWizardComplete} 
        />
      )}
    </div>
  );
};

export default MultiIntakeSettings;
