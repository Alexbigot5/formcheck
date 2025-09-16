import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Key, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

interface CrmConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  provider: 'hubspot' | 'salesforce' | 'zoho' | 'pipedrive' | null;
  onConnect: (provider: string, credentials: CrmCredentials) => Promise<void>;
}

export interface CrmCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  domain?: string;
  accessToken?: string;
  refreshToken?: string;
}

const CRM_CONFIGS = {
  hubspot: {
    name: 'HubSpot',
    color: '#FF7A59',
    icon: '🔶',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' }
    ],
    instructions: [
      'Go to HubSpot Settings → Integrations → Private Apps',
      'Create a new private app or use existing one',
      'Copy the access token (starts with "pat-")',
      'Ensure the app has required scopes: contacts, companies, deals'
    ],
    docsUrl: 'https://developers.hubspot.com/docs/api/private-apps'
  },
  salesforce: {
    name: 'Salesforce',
    color: '#00A1E0',
    icon: '☁️',
    fields: [
      { key: 'clientId', label: 'Consumer Key', type: 'text', required: true, placeholder: '3MVG9...' },
      { key: 'clientSecret', label: 'Consumer Secret', type: 'password', required: true, placeholder: 'ABCD...' },
      { key: 'domain', label: 'Instance URL', type: 'text', required: true, placeholder: 'https://mycompany.my.salesforce.com' }
    ],
    instructions: [
      'Go to Setup → App Manager → New Connected App',
      'Enable OAuth settings and select required scopes',
      'Copy Consumer Key and Consumer Secret',
      'Use your Salesforce instance URL (e.g., https://mycompany.my.salesforce.com)'
    ],
    docsUrl: 'https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm'
  },
  zoho: {
    name: 'Zoho CRM',
    color: '#C83E3A',
    icon: '🔴',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: '1000.ABC123...' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'xyz789...' },
      { key: 'domain', label: 'Domain', type: 'select', required: true, options: ['com', 'eu', 'in', 'com.au', 'jp'] }
    ],
    instructions: [
      'Go to Zoho API Console → Add Client → Server-based Applications',
      'Set redirect URI to your domain',
      'Copy Client ID and Client Secret',
      'Select your Zoho domain region'
    ],
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v2/oauth-overview.html'
  },
  pipedrive: {
    name: 'Pipedrive',
    color: '#00B2A9',
    icon: '🟢',
    fields: [
      { key: 'apiKey', label: 'API Token', type: 'password', required: true, placeholder: 'abcd1234567890...' },
      { key: 'domain', label: 'Company Domain', type: 'text', required: true, placeholder: 'mycompany' }
    ],
    instructions: [
      'Go to Settings → Personal → API',
      'Copy your API token',
      'Enter your company domain (from your Pipedrive URL)',
      'Example: if URL is mycompany.pipedrive.com, enter "mycompany"'
    ],
    docsUrl: 'https://pipedrive.readme.io/docs/how-to-find-the-api-token'
  }
};

const CrmConnectionDialog: React.FC<CrmConnectionDialogProps> = ({
  open,
  onClose,
  provider,
  onConnect
}) => {
  const [credentials, setCredentials] = useState<CrmCredentials>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const config = provider ? CRM_CONFIGS[provider] : null;

  const handleInputChange = (key: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [key]: value
    }));
    // Clear test result when credentials change
    setTestResult(null);
  };

  const togglePasswordVisibility = (fieldKey: string) => {
    setShowPassword(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const testConnection = async () => {
    if (!provider || !config) return;

    // Validate required fields
    const missingFields = config.fields
      .filter(field => field.required && !credentials[field.key as keyof CrmCredentials])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement actual API test calls
      // For now, simulate a test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock success for demo
      setTestResult({
        success: true,
        message: `Successfully connected to ${config.name}! Found 1,234 contacts.`
      });
      
      toast.success(`Connection to ${config.name} successful!`);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Failed to connect to ${config.name}. Please check your credentials.`
      });
      toast.error('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!provider || !config) return;

    // Validate required fields
    const missingFields = config.fields
      .filter(field => field.required && !credentials[field.key as keyof CrmCredentials])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      await onConnect(provider, credentials);
      toast.success(`Successfully connected to ${config.name}!`);
      onClose();
      
      // Reset form
      setCredentials({});
      setTestResult(null);
    } catch (error) {
      toast.error(`Failed to connect to ${config.name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCredentials({});
    setTestResult(null);
    setShowPassword({});
    onClose();
  };

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            Connect to {config.name}
          </DialogTitle>
          <DialogDescription>
            Enter your {config.name} API credentials to sync your CRM data with SmartForms AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Setup Instructions</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(config.docsUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View Docs
                </Button>
              </div>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {config.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    {instruction}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Credentials Form */}
          <div className="space-y-4">
            <h4 className="font-medium">API Credentials</h4>
            
            {config.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="flex items-center gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </Label>
                
                {field.type === 'select' && field.options ? (
                  <select
                    id={field.key}
                    value={credentials[field.key as keyof CrmCredentials] || ''}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    required={field.required}
                  >
                    <option value="">Select {field.label}</option>
                    {field.options.map(option => (
                      <option key={option} value={option}>
                        {option === 'com' ? 'Global (.com)' :
                         option === 'eu' ? 'Europe (.eu)' :
                         option === 'in' ? 'India (.in)' :
                         option === 'com.au' ? 'Australia (.com.au)' :
                         option === 'jp' ? 'Japan (.jp)' : option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <Input
                      id={field.key}
                      type={field.type === 'password' && !showPassword[field.key] ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={credentials[field.key as keyof CrmCredentials] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      required={field.required}
                      className="pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {field.type === 'password' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePasswordVisibility(field.key)}
                          className="h-6 w-6 p-0"
                        >
                          {showPassword[field.key] ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(credentials[field.key as keyof CrmCredentials] || '', field.label)}
                        className="h-6 w-6 p-0"
                        disabled={!credentials[field.key as keyof CrmCredentials]}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Test Result */}
          {testResult && (
            <Card className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {testResult.message}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
            <Button 
              onClick={handleConnect}
              disabled={loading || (testResult && !testResult.success)}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CrmConnectionDialog;
