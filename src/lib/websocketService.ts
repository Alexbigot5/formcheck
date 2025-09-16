import { toast } from 'sonner';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onLeadUpdate?: (leadData: any) => void;
  onFormSubmission?: (submissionData: any) => void;
  onAnalyticsUpdate?: (analyticsData: any) => void;
  onCrmSync?: (syncData: any) => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private handlers: WebSocketEventHandlers = {};
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Use environment variable or default to localhost
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host.replace(':5173', ':4000')}`;
    this.url = `${wsHost}/ws`;
  }

  connect(handlers: WebSocketEventHandlers = {}) {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.handlers = handlers;
    this.isConnecting = true;

    try {
      console.log('Connecting to WebSocket:', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = (event) => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Authenticate with JWT token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          this.send({
            type: 'authenticate',
            data: { token },
            timestamp: new Date().toISOString()
          });
        }

        this.handlers.onConnect?.();
        toast.success('Real-time updates connected', { duration: 2000 });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          // Route message to specific handlers
          switch (message.type) {
            case 'lead_update':
              this.handlers.onLeadUpdate?.(message.data);
              break;
            case 'form_submission':
              this.handlers.onFormSubmission?.(message.data);
              toast.success('New form submission received!');
              break;
            case 'analytics_update':
              this.handlers.onAnalyticsUpdate?.(message.data);
              break;
            case 'crm_sync':
              this.handlers.onCrmSync?.(message.data);
              break;
            case 'pong':
              // Heartbeat response
              break;
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }

          // Call general message handler
          this.handlers.onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        
        this.handlers.onDisconnect?.();
        
        // Don't show toast for normal closure or if user is navigating away
        if (event.code !== 1000 && event.code !== 1001) {
          toast.error('Real-time updates disconnected', { duration: 3000 });
        }

        // Attempt to reconnect unless it was a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.handlers.onError?.(error);
        toast.error('Real-time connection error', { duration: 3000 });
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      toast.error('Failed to establish real-time connection', { duration: 3000 });
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        console.log(`Reconnect attempt ${this.reconnectAttempts}`);
        this.connect(this.handlers);
      }
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          data: {},
          timestamp: new Date().toISOString()
        });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }

  disconnect() {
    console.log('Disconnecting WebSocket');
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Subscribe to specific event types
  subscribeToLeads() {
    this.send({
      type: 'subscribe',
      data: { events: ['lead_update', 'form_submission'] },
      timestamp: new Date().toISOString()
    });
  }

  subscribeToAnalytics() {
    this.send({
      type: 'subscribe',
      data: { events: ['analytics_update'] },
      timestamp: new Date().toISOString()
    });
  }

  subscribeToCrmSync() {
    this.send({
      type: 'subscribe',
      data: { events: ['crm_sync'] },
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

// Hook for React components to use WebSocket
export function useWebSocket(handlers: WebSocketEventHandlers) {
  const connect = () => websocketService.connect(handlers);
  const disconnect = () => websocketService.disconnect();
  const isConnected = () => websocketService.isConnected();
  const send = (message: WebSocketMessage) => websocketService.send(message);

  return {
    connect,
    disconnect,
    isConnected,
    send,
    subscribeToLeads: () => websocketService.subscribeToLeads(),
    subscribeToAnalytics: () => websocketService.subscribeToAnalytics(),
    subscribeToCrmSync: () => websocketService.subscribeToCrmSync()
  };
}

export default websocketService;
