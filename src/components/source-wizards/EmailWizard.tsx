import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, Gmail, Server, Shield, CheckCircle, AlertTriangle } from "lucide-react";

interface EmailWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (sourceId: string) => void;
}

export const EmailWizard: React.FC<EmailWizardProps> = ({
  open,
  onClose,
  onComplete
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'imap' | 'outlook'>('gmail');
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    imapHost: '',
    imapPort: '993',
    secure: true
  });
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      // Make actual API call to test email connection
      const response = await fetch('/api/integrations/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        },
        body: JSON.stringify({
          provider: selectedProvider,
          credentials
        })
      });

      if (response.ok) {
        setTestStatus('success');
        toast.success('Email connection successful!');
      } else {
        setTestStatus('error');
        toast.error('Email connection failed');
      }
    } catch (error) {
      setTestStatus('error');
      toast.error('Email connection failed');
    }
  };

  const handleComplete = async () => {
    if (testStatus === 'success') {
      try {
        // Save the email integration
        const response = await fetch('/api/integrations/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
          },
          body: JSON.stringify({
            provider: selectedProvider,
            credentials,
            enabled: true
          })
        });

        if (response.ok) {
          onComplete('shared-inbox');
          toast.success('Email integration configured successfully!');
          onClose();
        } else {
          toast.error('Failed to save email integration');
        }
      } catch (error) {
        toast.error('Failed to save email integration');
      }
    } else {
      toast.error('Please test the connection first');
    }
  };

  const gmailInstructions = [
    {
      step: 1,
      title: "Enable App Passwords",
      description: "Go to Google Account settings and enable 2-factor authentication, then create an App Password"
    },
    {
      step: 2,
      title: "Generate App Password",
      description: "In Security settings, select 'App passwords' and generate a password for 'Mail'"
    },
    {
      step: 3,
      title: "Use App Password",
      description: "Use your Gmail address and the generated App Password (not your regular password)"
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-500" />
            Connect Email Integration
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
        <div className="text-center">
          <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Connect Your Email</h3>
          <p className="text-sm text-muted-foreground">
            Automatically process lead emails and forward them to your inbox
          </p>
        </div>

        <Tabs value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gmail" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Gmail
            </TabsTrigger>
            <TabsTrigger value="outlook" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Outlook
            </TabsTrigger>
            <TabsTrigger value="imap" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              IMAP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gmail" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                For Gmail, you'll need to use an App Password instead of your regular password for security.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {gmailInstructions.map((instruction) => (
                <WizardStep key={instruction.step} number={instruction.step} title={instruction.title}>
                  <p>{instruction.description}</p>
                </WizardStep>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Gmail Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="gmail-email">Gmail Address</Label>
                  <Input
                    id="gmail-email"
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={credentials.email}
                    onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="gmail-password">App Password</Label>
                  <Input
                    id="gmail-password"
                    type="password"
                    placeholder="16-character app password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <ExternalLink href="https://support.google.com/accounts/answer/185833">
                  How to create Gmail App Password
                </ExternalLink>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outlook" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                For Outlook/Hotmail, you may need to enable "Less secure app access" or use OAuth.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Outlook Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="outlook-email">Outlook Email</Label>
                  <Input
                    id="outlook-email"
                    type="email"
                    placeholder="your-email@outlook.com"
                    value={credentials.email}
                    onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="outlook-password">Password</Label>
                  <Input
                    id="outlook-password"
                    type="password"
                    placeholder="Your Outlook password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  <p><strong>IMAP Settings:</strong></p>
                  <p>Host: outlook.office365.com</p>
                  <p>Port: 993 (SSL)</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imap" className="space-y-4">
            <Alert>
              <Server className="h-4 w-4" />
              <AlertDescription>
                Configure any IMAP-compatible email provider with custom settings.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">IMAP Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="imap-email">Email Address</Label>
                  <Input
                    id="imap-email"
                    type="email"
                    placeholder="your-email@domain.com"
                    value={credentials.email}
                    onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="imap-password">Password</Label>
                  <Input
                    id="imap-password"
                    type="password"
                    placeholder="Your email password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="imap-host">IMAP Host</Label>
                    <Input
                      id="imap-host"
                      placeholder="imap.domain.com"
                      value={credentials.imapHost}
                      onChange={(e) => setCredentials(prev => ({ ...prev, imapHost: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="imap-port">Port</Label>
                    <Input
                      id="imap-port"
                      placeholder="993"
                      value={credentials.imapPort}
                      onChange={(e) => setCredentials(prev => ({ ...prev, imapPort: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Test Connection */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Test Connection</h4>
                <p className="text-sm text-muted-foreground">
                  Verify your email settings before saving
                </p>
              </div>
              <div className="flex items-center gap-2">
                {testStatus === 'success' && (
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
                {testStatus === 'error' && (
                  <Badge variant="outline" className="text-red-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Failed
                  </Badge>
                )}
                <Button
                  onClick={handleTest}
                  disabled={testStatus === 'testing' || !credentials.email || !credentials.password}
                  variant="outline"
                  size="sm"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Complete Setup */}
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={testStatus !== 'success'}
          >
            Complete Setup
          </Button>
        </div>

        {testStatus === 'success' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Email integration configured successfully! New emails will automatically appear in your Unibox.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete}
            disabled={testStatus !== 'success'}
          >
            Complete Setup
          </Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
};
