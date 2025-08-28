import React from 'react';
import { BaseSourceWizard, WizardStep, CodeBlock, ExternalLink, WarningBox } from './BaseSourceWizard';

interface IntercomWizardProps {
  onClose: () => void;
  onComplete: (sourceId: string) => void;
}

export const IntercomWizard: React.FC<IntercomWizardProps> = ({
  onClose,
  onComplete
}) => {
  const webhookUrl = `${window.location.origin}/api/webhooks/intercom`;

  return (
    <BaseSourceWizard
      sourceId="intercom"
      onClose={onClose}
      onComplete={onComplete}
    >
      <div className="space-y-6">
        <WizardStep number={1} title="Access Intercom Developer Hub">
          <p>Navigate to your Intercom Developer Hub:</p>
          <p><strong>Settings → Developer Hub → Webhooks</strong></p>
          <ExternalLink href="https://developers.intercom.com/building-apps/docs/webhooks">
            Open Intercom Developer Hub
          </ExternalLink>
        </WizardStep>

        <WizardStep number={2} title="Create New Webhook">
          <p>Click "New webhook" and configure:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Webhook URL:</strong> Use the webhook URL above</li>
            <li><strong>Topics:</strong> Select the events you want to track</li>
            <li><strong>Webhook secret:</strong> Leave empty or generate one</li>
          </ul>
        </WizardStep>

        <WizardStep number={3} title="Select Webhook Topics">
          <p>Choose these topics to capture leads and conversations:</p>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-900 text-sm">✅ conversation.user.created</div>
              <div className="text-xs text-green-700">New visitor starts conversation - creates lead</div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-900 text-sm">✅ conversation.user.replied</div>
              <div className="text-xs text-green-700">User replies to conversation - updates lead</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-blue-900 text-sm">⚪ user.created</div>
              <div className="text-xs text-blue-700">New user profile created - creates lead</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-blue-900 text-sm">⚪ user.email.updated</div>
              <div className="text-xs text-blue-700">User email changed - updates lead</div>
            </div>
          </div>
        </WizardStep>

        <WarningBox>
          <strong>Admin Access Required:</strong> Only Intercom admins can create and manage webhooks. 
          Contact your Intercom admin if you don't have access.
        </WarningBox>

        <WizardStep number={4} title="Test the Integration">
          <p>To verify the webhook is working:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Start a test conversation on your website's Intercom chat</li>
            <li>Provide an email address when prompted</li>
            <li>Check FormCheck leads inbox for the new conversation lead</li>
            <li>Verify the lead includes conversation context</li>
          </ol>
        </WizardStep>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Expected Lead Data</h4>
          <p className="text-sm text-green-700 mb-2">
            FormCheck will receive these fields from Intercom:
          </p>
          <CodeBlock
            code={`{
  "email": "visitor@example.com",
  "name": "John Doe", // if provided
  "source": "intercom",
  "conversationId": "conv_123456",
  "userId": "user_789",
  "firstMessage": "Hi, I'm interested in your product",
  "userAgent": "Mozilla/5.0...",
  "location": {
    "city": "San Francisco",
    "country": "United States"
  },
  "customAttributes": {
    "company": "Acme Corp",
    "plan": "Enterprise",
    "signup_date": "2024-01-01"
  },
  "tags": ["website-visitor", "product-inquiry"],
  "conversationUrl": "https://widget.intercom.io/...",
  "createdAt": "2024-01-15T14:30:00Z"
}`}
            language="json"
            copyLabel="Sample payload"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">🚀 Advanced Features</h4>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>Conversation Context:</strong> Full chat history is captured for lead context.</p>
            <p><strong>User Attributes:</strong> Custom user data from Intercom is included in the lead.</p>
            <p><strong>Real-time:</strong> Leads appear instantly when conversations start.</p>
            <p><strong>Qualification:</strong> Leads are auto-scored based on conversation length and engagement.</p>
          </div>
        </div>
      </div>
    </BaseSourceWizard>
  );
};
