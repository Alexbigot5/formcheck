import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { BaseSourceWizard, WizardStep, CopyableField } from "./BaseSourceWizard";
import { toast } from "sonner";
import { Globe, Code, Eye, Copy, CheckCircle, Palette } from "lucide-react";

interface WebsiteFormWizardProps {
  onClose: () => void;
  onComplete: (sourceId: string) => void;
}

export const WebsiteFormWizard: React.FC<WebsiteFormWizardProps> = ({
  onClose,
  onComplete
}) => {
  const [formConfig, setFormConfig] = useState({
    title: 'Get in Touch',
    description: 'Fill out the form below and we\'ll get back to you soon.',
    fields: ['name', 'email', 'company', 'message'],
    buttonText: 'Send Message',
    successMessage: 'Thank you! We\'ll be in touch soon.',
    theme: 'light'
  });

  const [embedCode, setEmbedCode] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    // Generate webhook URL
    const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    const generatedWebhookUrl = `${baseUrl}/ingest/webhook`;
    setWebhookUrl(generatedWebhookUrl);

    // Generate embed code
    const formId = `sf-form-${Date.now()}`;
    const code = generateEmbedCode(formId, generatedWebhookUrl, formConfig);
    setEmbedCode(code);
  }, [formConfig]);

  const generateEmbedCode = (formId: string, webhookUrl: string, config: typeof formConfig) => {
    return `<!-- SmartForms AI Lead Capture Form -->
<div id="${formId}" class="smartforms-embed"></div>
<script>
(function() {
  var form = document.createElement('form');
  form.className = 'smartforms-form smartforms-theme-${config.theme}';
  form.innerHTML = \`
    <style>
      .smartforms-form {
        max-width: 500px;
        margin: 0 auto;
        padding: 24px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: ${config.theme === 'dark' ? '#1f2937' : '#ffffff'};
        color: ${config.theme === 'dark' ? '#f9fafb' : '#111827'};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .smartforms-form h3 {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
      }
      .smartforms-form p {
        margin: 0 0 24px 0;
        color: ${config.theme === 'dark' ? '#d1d5db' : '#6b7280'};
      }
      .smartforms-form .form-group {
        margin-bottom: 16px;
      }
      .smartforms-form label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
        font-size: 14px;
      }
      .smartforms-form input,
      .smartforms-form textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid ${config.theme === 'dark' ? '#4b5563' : '#d1d5db'};
        border-radius: 6px;
        background: ${config.theme === 'dark' ? '#374151' : '#ffffff'};
        color: ${config.theme === 'dark' ? '#f9fafb' : '#111827'};
        font-size: 14px;
        box-sizing: border-box;
      }
      .smartforms-form input:focus,
      .smartforms-form textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      .smartforms-form button {
        width: 100%;
        padding: 12px 24px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .smartforms-form button:hover {
        background: #2563eb;
      }
      .smartforms-form button:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
      .smartforms-success {
        text-align: center;
        padding: 24px;
        color: #059669;
        font-weight: 500;
      }
    </style>
    <h3>${config.title}</h3>
    <p>${config.description}</p>
    ${config.fields.includes('name') ? '<div class="form-group"><label for="sf-name">Name *</label><input type="text" id="sf-name" name="name" required></div>' : ''}
    ${config.fields.includes('email') ? '<div class="form-group"><label for="sf-email">Email *</label><input type="email" id="sf-email" name="email" required></div>' : ''}
    ${config.fields.includes('company') ? '<div class="form-group"><label for="sf-company">Company</label><input type="text" id="sf-company" name="company"></div>' : ''}
    ${config.fields.includes('phone') ? '<div class="form-group"><label for="sf-phone">Phone</label><input type="tel" id="sf-phone" name="phone"></div>' : ''}
    ${config.fields.includes('message') ? '<div class="form-group"><label for="sf-message">Message</label><textarea id="sf-message" name="message" rows="4"></textarea></div>' : ''}
    <button type="submit">${config.buttonText}</button>
  \`;
  
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var formData = new FormData(form);
    var data = Object.fromEntries(formData.entries());
    
    // Add UTM parameters and page info
    data.source = 'website_form';
    data.page_url = window.location.href;
    data.page_title = document.title;
    data.referrer = document.referrer;
    
    // Add UTM parameters from URL
    var urlParams = new URLSearchParams(window.location.search);
    data.utm_source = urlParams.get('utm_source') || '';
    data.utm_medium = urlParams.get('utm_medium') || '';
    data.utm_campaign = urlParams.get('utm_campaign') || '';
    data.utm_term = urlParams.get('utm_term') || '';
    data.utm_content = urlParams.get('utm_content') || '';
    
    var button = form.querySelector('button');
    button.textContent = 'Sending...';
    button.disabled = true;
    
    fetch('${webhookUrl}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'form.submitted',
        data: data,
        timestamp: Date.now()
      })
    })
    .then(response => response.json())
    .then(data => {
      form.innerHTML = '<div class="smartforms-success">${config.successMessage}</div>';
    })
    .catch(error => {
      console.error('Form submission error:', error);
      button.textContent = '${config.buttonText}';
      button.disabled = false;
      alert('There was an error submitting the form. Please try again.');
    });
  });
  
  document.getElementById('${formId}').appendChild(form);
})();
</script>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success('Embed code copied to clipboard!');
  };

  const handleComplete = () => {
    onComplete('website-form');
    toast.success('Website form integration configured successfully!');
  };

  const availableFields = [
    { id: 'name', label: 'Name', required: true },
    { id: 'email', label: 'Email', required: true },
    { id: 'company', label: 'Company', required: false },
    { id: 'phone', label: 'Phone', required: false },
    { id: 'message', label: 'Message', required: false },
  ];

  return (
    <BaseSourceWizard
      sourceId="website-form"
      onClose={onClose}
      onComplete={onComplete}
    >
      <div className="space-y-6">
        <div className="text-center">
          <Globe className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Website Form Integration</h3>
          <p className="text-sm text-muted-foreground">
            Create and embed lead capture forms on your website
          </p>
        </div>

        <Tabs defaultValue="configure" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="embed">Embed Code</TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Form Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="form-title">Form Title</Label>
                  <Input
                    id="form-title"
                    value={formConfig.title}
                    onChange={(e) => setFormConfig(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="form-description">Description</Label>
                  <Textarea
                    id="form-description"
                    value={formConfig.description}
                    onChange={(e) => setFormConfig(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Form Fields</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {availableFields.map((field) => (
                      <label key={field.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formConfig.fields.includes(field.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormConfig(prev => ({ 
                                ...prev, 
                                fields: [...prev.fields, field.id] 
                              }));
                            } else if (!field.required) {
                              setFormConfig(prev => ({ 
                                ...prev, 
                                fields: prev.fields.filter(f => f !== field.id) 
                              }));
                            }
                          }}
                          disabled={field.required}
                        />
                        <span className="text-sm">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="button-text">Button Text</Label>
                    <Input
                      id="button-text"
                      value={formConfig.buttonText}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, buttonText: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <select
                      id="theme"
                      value={formConfig.theme}
                      onChange={(e) => setFormConfig(prev => ({ ...prev, theme: e.target.value }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="success-message">Success Message</Label>
                  <Input
                    id="success-message"
                    value={formConfig.successMessage}
                    onChange={(e) => setFormConfig(prev => ({ ...prev, successMessage: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Form Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="border rounded-lg p-4"
                  dangerouslySetInnerHTML={{ 
                    __html: embedCode.split('<script>')[0].replace('<!-- SmartForms AI Lead Capture Form -->', '') 
                  }} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4">
            <WizardStep number={1} title="Copy the Embed Code">
              <p>Copy the code below and paste it into your website where you want the form to appear.</p>
            </WizardStep>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Embed Code
                  </span>
                  <Button variant="outline" size="sm" onClick={copyEmbedCode}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={embedCode}
                  readOnly
                  rows={10}
                  className="font-mono text-xs"
                />
              </CardContent>
            </Card>

            <WizardStep number={2} title="Webhook URL">
              <p>Your form will automatically submit to this webhook URL:</p>
              <CopyableField value={webhookUrl} />
            </WizardStep>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                The form will automatically capture UTM parameters, page URL, and referrer information for better lead tracking.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleComplete}>
            Complete Setup
          </Button>
        </div>
      </div>
    </BaseSourceWizard>
  );
};
