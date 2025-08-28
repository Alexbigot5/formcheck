import React from 'react';
import { BaseSourceWizard, WizardStep, CodeBlock, ExternalLink, WarningBox } from './BaseSourceWizard';

interface CalendlyWizardProps {
  onClose: () => void;
  onComplete: (sourceId: string) => void;
}

export const CalendlyWizard: React.FC<CalendlyWizardProps> = ({
  onClose,
  onComplete
}) => {
  const webhookUrl = `${window.location.origin}/api/webhooks/calendly`;

  return (
    <BaseSourceWizard
      sourceId="calendly"
      onClose={onClose}
      onComplete={onComplete}
    >
      <div className="space-y-6">
        <WizardStep number={1} title="Access Calendly Webhooks">
          <p>Log in to your Calendly account and navigate to:</p>
          <p><strong>Account Settings → Developer Tools → Webhooks</strong></p>
          <ExternalLink href="https://calendly.com/app/account/developer_tools">
            Open Calendly Developer Tools
          </ExternalLink>
        </WizardStep>

        <WizardStep number={2} title="Create Webhook Subscription">
          <p>Click "Create Webhook" and configure:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Webhook URL:</strong> Use the webhook URL above</li>
            <li><strong>Scope:</strong> Select "Organization" or specific user</li>
            <li><strong>Events:</strong> Select "Invitee Created" at minimum</li>
          </ul>
        </WizardStep>

        <WizardStep number={3} title="Configure Webhook Events">
          <p>Enable these events to capture all booking activities:</p>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-900 text-sm">✅ invitee.created</div>
              <div className="text-xs text-green-700">New booking made - creates lead</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-blue-900 text-sm">⚪ invitee.canceled</div>
              <div className="text-xs text-blue-700">Booking canceled - updates lead status</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-blue-900 text-sm">⚪ invitee.rescheduled</div>
              <div className="text-xs text-blue-700">Booking rescheduled - adds timeline event</div>
            </div>
          </div>
        </WizardStep>

        <WarningBox>
          <strong>Pro/Premium Required:</strong> Webhooks are only available on Calendly's paid plans. 
          Free accounts cannot create webhook subscriptions.
        </WarningBox>

        <WizardStep number={4} title="Test the Integration">
          <p>After creating the webhook:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Book a test meeting using your Calendly link</li>
            <li>Check FormCheck leads inbox within 1-2 minutes</li>
            <li>Verify the lead includes meeting details and scheduling info</li>
          </ol>
        </WizardStep>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Expected Lead Data</h4>
          <p className="text-sm text-green-700 mb-2">
            FormCheck will receive these fields from Calendly:
          </p>
          <CodeBlock
            code={`{
  "email": "attendee@example.com",
  "name": "John Doe",
  "source": "calendly",
  "eventType": "30 Minute Meeting",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T10:30:00Z",
  "timezone": "America/New_York",
  "meetingUrl": "https://us05web.zoom.us/j/123456789",
  "questions": {
    "company": "Acme Corp",
    "phone": "+1-555-0123",
    "project_details": "Looking for CRM integration"
  },
  "utm_source": "website",
  "utm_campaign": "book-demo"
}`}
            language="json"
            copyLabel="Sample payload"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Lead Scoring Boost</h4>
          <p className="text-sm text-blue-700">
            Calendly leads automatically receive a +20 score boost since they've taken the high-intent 
            action of booking a meeting. They'll be prioritized in your lead queue.
          </p>
        </div>
      </div>
    </BaseSourceWizard>
  );
};
