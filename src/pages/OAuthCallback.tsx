import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, RefreshCw, ArrowRight } from "lucide-react";
import { integrationsApi, integrationsHelpers } from "@/lib/integrationsApi";

const OAuthCallback = () => {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('/integrations');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    if (!provider) {
      setStatus('error');
      setMessage('Invalid OAuth provider');
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      setStatus('error');
      setMessage(errorDescription || `OAuth error: ${error}`);
      toast.error(`${integrationsHelpers.getProviderName(provider)} connection failed`, {
        description: errorDescription || error
      });
      return;
    }

    // Handle missing code
    if (!code || !state) {
      setStatus('error');
      setMessage('Missing OAuth parameters');
      toast.error('OAuth callback failed', {
        description: 'Missing required parameters'
      });
      return;
    }

    try {
      // Handle the OAuth callback
      const result = await integrationsApi.handleOAuthCallback(provider, code, state);
      
      if (result.success) {
        setStatus('success');
        setMessage(result.message);
        setRedirectUrl(result.redirectUrl);
        
        toast.success(`${integrationsHelpers.getProviderName(provider)} connected successfully!`);
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          navigate(result.redirectUrl);
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.message || 'OAuth callback failed');
        toast.error(`${integrationsHelpers.getProviderName(provider)} connection failed`);
      }
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setMessage(error.message || 'An unexpected error occurred');
      toast.error('OAuth callback failed', {
        description: error.message
      });
    }
  };

  const handleManualRedirect = () => {
    navigate(redirectUrl);
  };

  const handleRetry = () => {
    if (provider) {
      integrationsApi.startOAuth(provider as 'hubspot' | 'salesforce', redirectUrl);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                {/* Status icon */}
                <div className="flex justify-center">
                  {status === 'processing' && (
                    <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
                  )}
                  {status === 'success' && (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  )}
                  {status === 'error' && (
                    <XCircle className="w-12 h-12 text-red-500" />
                  )}
                </div>

                {/* Provider info */}
                <div>
                  <div className="text-2xl mb-2">
                    {provider && integrationsHelpers.getProviderIcon(provider)}
                  </div>
                  <h1 className="text-xl font-semibold">
                    {provider && integrationsHelpers.getProviderName(provider)} Integration
                  </h1>
                </div>

                {/* Status message */}
                <div className="space-y-3">
                  {status === 'processing' && (
                    <div>
                      <p className="text-muted-foreground">
                        Completing your {provider && integrationsHelpers.getProviderName(provider)} connection...
                      </p>
                    </div>
                  )}

                  {status === 'success' && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Success!</strong> {message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {status === 'error' && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Connection Failed</strong><br />
                        {message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  {status === 'success' && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Redirecting automatically in 3 seconds...
                      </p>
                      <Button onClick={handleManualRedirect} className="w-full">
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Continue to Integrations
                      </Button>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="space-y-2">
                      <Button onClick={handleRetry} className="w-full">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                      <Button 
                        onClick={() => navigate('/integrations')} 
                        variant="outline" 
                        className="w-full"
                      >
                        Back to Integrations
                      </Button>
                    </div>
                  )}
                </div>

                {/* Additional info */}
                {status === 'processing' && (
                  <div className="text-xs text-muted-foreground">
                    This may take a few moments while we verify your credentials...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Debug info (only in development) */}
          {import.meta.env.DEV && (
            <Card className="mt-4">
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">Debug Info</h3>
                <div className="text-xs space-y-1 font-mono">
                  <div>Provider: {provider}</div>
                  <div>Code: {searchParams.get('code')?.slice(0, 20)}...</div>
                  <div>State: {searchParams.get('state')?.slice(0, 20)}...</div>
                  <div>Error: {searchParams.get('error') || 'None'}</div>
                  <div>Status: {status}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default OAuthCallback;
