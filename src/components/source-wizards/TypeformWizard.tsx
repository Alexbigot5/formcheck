import React from 'react';
import { BaseSourceWizard, WizardStep, CodeBlock, ExternalLink } from './BaseSourceWizard';

interface TypeformWizardProps {
  onClose: () => void;
  onComplete: (sourceId: string) => void;
}

export const TypeformWizard: React.FC<TypeformWizardProps> = ({
  onClose,
  onComplete
}) => {
  const webhookUrl = `${window.location.origin}/api/webhooks/typeform`;

  return (
    <BaseSourceWizard
      sourceId="typeform"
      onClose={onClose}
      onComplete={onComplete}
    >
      <div className="space-y-6">
        <WizardStep number={1} title="Access Your Typeform">
          <p>Open the Typeform you want to connect and navigate to:</p>
          <p><strong>Connect → Webhooks</strong></p>
          <ExternalLink href="https://admin.typeform.com/">
            Open Typeform Admin
          </ExternalLink>
        </WizardStep>

        <WizardStep number={2} title="Add Webhook Endpoint">
          <p>In the Webhooks section:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click "Add webhook"</li>
            <li>Paste the webhook URL above</li>
            <li>Leave "Secret" field empty (optional)</li>
            <li>Click "Save webhook"</li>
          </ol>
        </WizardStep>

        <WizardStep number={3} title="Configure Webhook Settings">
          <p>Typeform will automatically send all form submissions to your webhook. The integration will capture:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>All form field responses</li>
            <li>Submission timestamp</li>
            <li>Form metadata and hidden fields</li>
            <li>UTM parameters (if passed via URL)</li>
          </ul>
        </WizardStep>

        <WizardStep number={4} title="Test the Integration">
          <p>To verify the connection:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Submit a test response to your Typeform</li>
            <li>Check FormCheck leads inbox within seconds</li>
            <li>Verify all form fields are captured correctly</li>
          </ol>
        </WizardStep>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Expected Lead Data</h4>
          <p className="text-sm text-green-700 mb-2">
            FormCheck will receive these fields from Typeform:
          </p>
          <CodeBlock
            code={`{
  "email": "user@example.com",
  "name": "John Doe", // from name fields
  "source": "typeform",
  "formId": "abc123xyz",
  "formTitle": "Contact Form",
  "submissionId": "sub_456",
  "answers": {
    "email": "user@example.com",
    "name": "John Doe",
    "company": "Acme Corp",
    "message": "I'm interested in your product",
    "budget": "$10k-50k",
    "timeline": "Within 3 months"
  },
  "hiddenFields": {
    "utm_source": "google",
    "utm_campaign": "brand-search"
  },
  "submittedAt": "2024-01-15T14:30:00Z"
}`}
            language="json"
            copyLabel="Sample payload"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Pro Tips</h4>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>Hidden Fields:</strong> Add UTM parameters as hidden fields to track lead sources.</p>
            <p><strong>Field Mapping:</strong> Use standard field names like "email", "name", "company" for automatic mapping.</p>
            <p><strong>Logic Jumps:</strong> All conditional logic responses are captured, regardless of the path taken.</p>
          </div>
        </div>
      </div>
    </BaseSourceWizard>
  );
};
