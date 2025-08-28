import React from 'react';
import { BaseSourceWizard, WizardStep, CodeBlock, ExternalLink } from './BaseSourceWizard';

interface MailchimpWizardProps {
  onClose: () => void;
  onComplete: (sourceId: string) => void;
}

export const MailchimpWizard: React.FC<MailchimpWizardProps> = ({
  onClose,
  onComplete
}) => {
  const webhookUrl = `${window.location.origin}/api/webhooks/mailchimp`;

  return (
    <BaseSourceWizard
      sourceId="mailchimp"
      onClose={onClose}
      onComplete={onComplete}
    >
      <div className="space-y-6">
        <WizardStep number={1} title="Access Mailchimp Webhooks">
          <p>Log in to your Mailchimp account and navigate to:</p>
          <p><strong>Audience → Settings → Webhooks</strong></p>
          <ExternalLink href="https://admin.mailchimp.com/">
            Open Mailchimp Dashboard
          </ExternalLink>
        </WizardStep>

        <WizardStep number={2} title="Create New Webhook">
          <p>Click "Create New Webhook" and configure:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Callback URL:</strong> Use the webhook URL above</li>
            <li><strong>Events:</strong> Select "Subscribes" and "Profile Updates"</li>
            <li><strong>Sources:</strong> Select "API" and "Import"</li>
          </ul>
        </WizardStep>

        <WizardStep number={3} title="Configure Events">
          <p>Enable these webhook events to capture all lead activities:</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
              ✅ Subscribe
            </div>
            <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
              ✅ Profile Update
            </div>
            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs">
              ⚪ Unsubscribe (optional)
            </div>
            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs">
              ⚪ Email Changed (optional)
            </div>
          </div>
        </WizardStep>

        <WizardStep number={4} title="Test the Connection">
          <p>After saving the webhook:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Add a test subscriber to your Mailchimp list</li>
            <li>Check your FormCheck leads inbox for the new lead</li>
            <li>Verify the lead source shows as "Mailchimp"</li>
          </ol>
        </WizardStep>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Expected Lead Data</h4>
          <p className="text-sm text-green-700 mb-2">
            FormCheck will receive these fields from Mailchimp:
          </p>
          <CodeBlock
            code={`{
  "email": "subscriber@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "source": "mailchimp",
  "listId": "abc123",
  "mergeFields": {
    "COMPANY": "Acme Corp",
    "PHONE": "+1-555-0123"
  },
  "tags": ["newsletter", "product-updates"]
}`}
            language="json"
            copyLabel="Sample payload"
          />
        </div>
      </div>
    </BaseSourceWizard>
  );
};
