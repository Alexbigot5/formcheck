import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getSourceConfig } from '@/lib/sourceMapping';

interface BaseSourceWizardProps {
  sourceId: string;
  onClose: () => void;
  onComplete: (sourceId: string) => void;
  children: React.ReactNode;
}

export const BaseSourceWizard: React.FC<BaseSourceWizardProps> = ({
  sourceId,
  onClose,
  onComplete,
  children
}) => {
  const config = getSourceConfig(sourceId);
  const IconComponent = config.icon;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const webhookUrl = `${window.location.origin}/api/webhooks/${sourceId}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${config.color}20` }}
              >
                <IconComponent className="w-6 h-6" style={{ color: config.color }} />
              </div>
              <div>
                <CardTitle className="text-xl">Connect {config.label}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {config.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      config.setupComplexity === 'easy' ? 'text-green-600 border-green-200' :
                      config.setupComplexity === 'medium' ? 'text-yellow-600 border-yellow-200' :
                      'text-red-600 border-red-200'
                    }`}
                  >
                    {config.setupComplexity} setup
                  </Badge>
                  {config.webhookSupported && (
                    <Badge variant="secondary" className="text-xs">Webhook</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {config.webhookSupported && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-2">Webhook URL</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Use this URL in {config.label} to send leads to FormCheck:
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-white border border-blue-200 rounded">
                    <code className="flex-1 text-xs text-blue-800 break-all">
                      {webhookUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                      className="shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {children}

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => onComplete(sourceId)} className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Connected
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Reusable components for wizards
export const WizardStep: React.FC<{
  number: number;
  title: string;
  children: React.ReactNode;
  completed?: boolean;
}> = ({ number, title, children, completed = false }) => (
  <div className="flex gap-4">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
      completed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {completed ? <CheckCircle className="w-4 h-4" /> : number}
    </div>
    <div className="flex-1">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-2">
        {children}
      </div>
    </div>
  </div>
);

export const CodeBlock: React.FC<{
  code: string;
  language?: string;
  copyLabel?: string;
}> = ({ code, language = 'text', copyLabel = 'Code' }) => (
  <div className="relative">
    <pre className="bg-gray-50 border rounded-lg p-3 text-sm overflow-x-auto">
      <code className={`language-${language}`}>{code}</code>
    </pre>
    <Button
      size="sm"
      variant="outline"
      className="absolute top-2 right-2"
      onClick={() => {
        navigator.clipboard.writeText(code);
        toast.success(`${copyLabel} copied!`);
      }}
    >
      <Copy className="w-3 h-3" />
    </Button>
  </div>
);

export const ExternalLink: React.FC<{
  href: string;
  children: React.ReactNode;
}> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
  >
    {children}
    <ExternalLink className="w-3 h-3" />
  </a>
);

export const WarningBox: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
    <div className="flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
      <div className="text-sm text-yellow-800">
        {children}
      </div>
    </div>
  </div>
);
