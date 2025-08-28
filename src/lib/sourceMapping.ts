import { 
  Globe, 
  Mail, 
  Instagram, 
  Linkedin, 
  Webhook,
  Youtube,
  Calendar,
  FileText,
  MessageSquare,
  ShoppingBag,
  Zap,
  Users,
  Phone,
  Video,
  Rss,
  Star,
  TrendingUp,
  type LucideIcon
} from "lucide-react";

export interface SourceConfig {
  icon: LucideIcon;
  color: string;
  label: string;
  category: 'form' | 'social' | 'email' | 'meeting' | 'ecommerce' | 'communication' | 'content' | 'other';
  description: string;
  webhookSupported: boolean;
  setupComplexity: 'easy' | 'medium' | 'complex';
}

export const SOURCE_CONFIG: Record<string, SourceConfig> = {
  // Forms & Website
  'website-form': { 
    icon: Globe, 
    color: '#3B82F6', 
    label: 'Website Form',
    category: 'form',
    description: 'Embed forms directly on your website',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'typeform': { 
    icon: FileText, 
    color: '#262627', 
    label: 'Typeform',
    category: 'form',
    description: 'Form responses via webhook',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'gravity-forms': { 
    icon: FileText, 
    color: '#FF6900', 
    label: 'Gravity Forms',
    category: 'form',
    description: 'WordPress form submissions',
    webhookSupported: true,
    setupComplexity: 'medium'
  },
  'jotform': { 
    icon: FileText, 
    color: '#FF6100', 
    label: 'JotForm',
    category: 'form',
    description: 'Online form builder submissions',
    webhookSupported: true,
    setupComplexity: 'easy'
  },

  // Email & Newsletter
  'shared-inbox': { 
    icon: Mail, 
    color: '#10B981', 
    label: 'Shared Inbox',
    category: 'email',
    description: 'Monitor your leads email inbox',
    webhookSupported: false,
    setupComplexity: 'medium'
  },
  'mailchimp': { 
    icon: Mail, 
    color: '#FFE01B', 
    label: 'Mailchimp',
    category: 'email',
    description: 'Newsletter subscribers via webhook',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'convertkit': { 
    icon: Mail, 
    color: '#FB7E14', 
    label: 'ConvertKit',
    category: 'email',
    description: 'Email marketing subscribers',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'constant-contact': { 
    icon: Mail, 
    color: '#335EF7', 
    label: 'Constant Contact',
    category: 'email',
    description: 'Email marketing platform integration',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'aweber': { 
    icon: Mail, 
    color: '#77B82F', 
    label: 'AWeber',
    category: 'email',
    description: 'Email autoresponder subscribers',
    webhookSupported: true,
    setupComplexity: 'easy'
  },

  // Social Media
  'instagram-dms': { 
    icon: Instagram, 
    color: '#E1306C', 
    label: 'Instagram DMs',
    category: 'social',
    description: 'Capture leads from Instagram direct messages',
    webhookSupported: true,
    setupComplexity: 'complex'
  },
  'linkedin-csv': { 
    icon: Linkedin, 
    color: '#0077B5', 
    label: 'LinkedIn CSV',
    category: 'social',
    description: 'Import leads from LinkedIn Sales Navigator',
    webhookSupported: false,
    setupComplexity: 'easy'
  },
  'linkedin-leads': { 
    icon: Linkedin, 
    color: '#0077B5', 
    label: 'LinkedIn Lead Gen',
    category: 'social',
    description: 'LinkedIn Lead Gen Form submissions',
    webhookSupported: true,
    setupComplexity: 'medium'
  },
  'facebook-leads': { 
    icon: Users, 
    color: '#1877F2', 
    label: 'Facebook Lead Ads',
    category: 'social',
    description: 'Facebook Lead Ad form submissions',
    webhookSupported: true,
    setupComplexity: 'medium'
  },
  'twitter': { 
    icon: MessageSquare, 
    color: '#1DA1F2', 
    label: 'Twitter/X',
    category: 'social',
    description: 'Mentions and DMs from Twitter/X',
    webhookSupported: true,
    setupComplexity: 'complex'
  },

  // Content & Media
  'youtube': { 
    icon: Youtube, 
    color: '#FF0000', 
    label: 'YouTube',
    category: 'content',
    description: 'New subscribers and comments',
    webhookSupported: false,
    setupComplexity: 'complex'
  },
  'newsletter': { 
    icon: Rss, 
    color: '#10B981', 
    label: 'Newsletter',
    category: 'content',
    description: 'RSS feed and content subscribers',
    webhookSupported: false,
    setupComplexity: 'medium'
  },

  // Meeting & Calendar
  'calendly': { 
    icon: Calendar, 
    color: '#006BFF', 
    label: 'Calendly',
    category: 'meeting',
    description: 'New meeting bookings as leads',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'acuity': { 
    icon: Calendar, 
    color: '#FF6900', 
    label: 'Acuity Scheduling',
    category: 'meeting',
    description: 'Appointment bookings via webhook',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'zoom': { 
    icon: Video, 
    color: '#2D8CFF', 
    label: 'Zoom',
    category: 'meeting',
    description: 'Meeting registrations and webinars',
    webhookSupported: true,
    setupComplexity: 'medium'
  },

  // Communication & Chat
  'intercom': { 
    icon: MessageSquare, 
    color: '#1F8DED', 
    label: 'Intercom',
    category: 'communication',
    description: 'Live chat conversations',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'drift': { 
    icon: MessageSquare, 
    color: '#FF6B35', 
    label: 'Drift',
    category: 'communication',
    description: 'Conversational marketing leads',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'zendesk': { 
    icon: MessageSquare, 
    color: '#03363D', 
    label: 'Zendesk Chat',
    category: 'communication',
    description: 'Support chat conversations',
    webhookSupported: true,
    setupComplexity: 'medium'
  },
  'crisp': { 
    icon: MessageSquare, 
    color: '#0066FF', 
    label: 'Crisp',
    category: 'communication',
    description: 'Customer messaging platform',
    webhookSupported: true,
    setupComplexity: 'easy'
  },

  // E-commerce
  'shopify': { 
    icon: ShoppingBag, 
    color: '#96BF47', 
    label: 'Shopify',
    category: 'ecommerce',
    description: 'New customers and abandoned carts',
    webhookSupported: true,
    setupComplexity: 'easy'
  },
  'woocommerce': { 
    icon: ShoppingBag, 
    color: '#96588A', 
    label: 'WooCommerce',
    category: 'ecommerce',
    description: 'WordPress e-commerce orders',
    webhookSupported: true,
    setupComplexity: 'medium'
  },
  'stripe': { 
    icon: ShoppingBag, 
    color: '#635BFF', 
    label: 'Stripe',
    category: 'ecommerce',
    description: 'Payment and customer webhooks',
    webhookSupported: true,
    setupComplexity: 'easy'
  },

  // Other/Generic
  'webhook': { 
    icon: Webhook, 
    color: '#8B5CF6', 
    label: 'Generic Webhook',
    category: 'other',
    description: 'Connect any external service via webhook',
    webhookSupported: true,
    setupComplexity: 'medium'
  },
  'zapier': { 
    icon: Zap, 
    color: '#FF4A00', 
    label: 'Zapier',
    category: 'other',
    description: 'Automation platform integrations',
    webhookSupported: true,
    setupComplexity: 'easy'
  }
};

// Helper functions
export const getSourceConfig = (sourceId: string): SourceConfig => {
  return SOURCE_CONFIG[sourceId] || SOURCE_CONFIG['webhook'];
};

export const getSourcesByCategory = (category: SourceConfig['category']) => {
  return Object.entries(SOURCE_CONFIG)
    .filter(([_, config]) => config.category === category)
    .map(([id, config]) => ({ id, ...config }));
};

export const getWebhookSupportedSources = () => {
  return Object.entries(SOURCE_CONFIG)
    .filter(([_, config]) => config.webhookSupported)
    .map(([id, config]) => ({ id, ...config }));
};

export const getSourceIcon = (sourceId: string) => {
  const config = getSourceConfig(sourceId);
  return config.icon;
};

export const getSourceColor = (sourceId: string) => {
  const config = getSourceConfig(sourceId);
  return config.color;
};

export const getSourceLabel = (sourceId: string) => {
  const config = getSourceConfig(sourceId);
  return config.label;
};

// Popular sources for quick setup
export const POPULAR_SOURCES = [
  'website-form',
  'mailchimp',
  'calendly',
  'typeform',
  'intercom',
  'shopify',
  'linkedin-leads',
  'facebook-leads'
];

// Categories for organization
export const SOURCE_CATEGORIES = [
  { id: 'form', label: 'Forms & Website', icon: FileText },
  { id: 'email', label: 'Email & Newsletter', icon: Mail },
  { id: 'social', label: 'Social Media', icon: Instagram },
  { id: 'meeting', label: 'Meeting & Calendar', icon: Calendar },
  { id: 'communication', label: 'Chat & Communication', icon: MessageSquare },
  { id: 'ecommerce', label: 'E-commerce', icon: ShoppingBag },
  { id: 'content', label: 'Content & Media', icon: Youtube },
  { id: 'other', label: 'Other', icon: Webhook }
] as const;
