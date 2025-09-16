import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import { authenticateSupabase } from '../middleware/supabase-auth';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  teamId?: string;
  userId?: string;
  subscriptions?: Set<string>;
}

export interface WebSocketConnection {
  socket: AuthenticatedWebSocket;
  teamId: string;
  userId: string;
  subscriptions: Set<string>;
}

// Store active connections by team
const connectionsByTeam = new Map<string, Set<WebSocketConnection>>();

// Store all connections for broadcast
const allConnections = new Set<WebSocketConnection>();

export default fp(async (fastify: FastifyInstance) => {
  // Register WebSocket plugin
  await fastify.register(websocket);

  // WebSocket route
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
      const socket = connection.socket as AuthenticatedWebSocket;
      
      fastify.log.info('WebSocket connection established');
      
      // Initialize connection properties
      socket.subscriptions = new Set();
      let wsConnection: WebSocketConnection | null = null;

      socket.on('message', async (rawMessage) => {
        try {
          const message: WebSocketMessage = JSON.parse(rawMessage.toString());
          fastify.log.debug('WebSocket message received:', message.type);

          switch (message.type) {
            case 'authenticate':
              await handleAuthentication(socket, message, fastify);
              break;

            case 'subscribe':
              handleSubscription(socket, message);
              break;

            case 'unsubscribe':
              handleUnsubscription(socket, message);
              break;

            case 'ping':
              socket.send(JSON.stringify({
                type: 'pong',
                data: {},
                timestamp: new Date().toISOString()
              }));
              break;

            default:
              fastify.log.warn('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          fastify.log.error('Error processing WebSocket message:', error);
          socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format' },
            timestamp: new Date().toISOString()
          }));
        }
      });

      socket.on('close', () => {
        fastify.log.info('WebSocket connection closed');
        if (wsConnection) {
          removeConnection(wsConnection);
        }
      });

      socket.on('error', (error) => {
        fastify.log.error('WebSocket error:', error);
        if (wsConnection) {
          removeConnection(wsConnection);
        }
      });

      // Helper function to handle authentication
      async function handleAuthentication(socket: AuthenticatedWebSocket, message: WebSocketMessage, fastify: FastifyInstance) {
        try {
          const { token } = message.data;
          
          if (!token) {
            socket.send(JSON.stringify({
              type: 'auth_error',
              data: { message: 'No token provided' },
              timestamp: new Date().toISOString()
            }));
            return;
          }

          // Create a mock request object for authentication
          const mockRequest = {
            headers: { authorization: `Bearer ${token}` }
          } as FastifyRequest;

          const mockReply = {
            code: (statusCode: number) => ({
              send: (data: any) => {
                socket.send(JSON.stringify({
                  type: 'auth_error',
                  data: { message: data.error || 'Authentication failed' },
                  timestamp: new Date().toISOString()
                }));
              }
            })
          };

          try {
            // Use the existing Supabase auth middleware
            await authenticateSupabase(mockRequest as any, mockReply as any);
            
            // If we get here, authentication succeeded
            const teamId = (mockRequest as any).teamId;
            const userId = (mockRequest as any).userId;

            if (teamId && userId) {
              socket.teamId = teamId;
              socket.userId = userId;

              // Create connection object
              wsConnection = {
                socket,
                teamId,
                userId,
                subscriptions: socket.subscriptions || new Set()
              };

              // Add to connection maps
              addConnection(wsConnection);

              socket.send(JSON.stringify({
                type: 'authenticated',
                data: { teamId, userId },
                timestamp: new Date().toISOString()
              }));

              fastify.log.info(`WebSocket authenticated for team ${teamId}, user ${userId}`);
            }
          } catch (authError) {
            fastify.log.error('WebSocket authentication failed:', authError);
            socket.send(JSON.stringify({
              type: 'auth_error',
              data: { message: 'Invalid token' },
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          fastify.log.error('Error during WebSocket authentication:', error);
          socket.send(JSON.stringify({
            type: 'auth_error',
            data: { message: 'Authentication error' },
            timestamp: new Date().toISOString()
          }));
        }
      }
    });
  });

  // Add utility functions to fastify instance
  fastify.decorate('broadcastToTeam', (teamId: string, message: WebSocketMessage) => {
    const connections = connectionsByTeam.get(teamId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      connections.forEach(conn => {
        if (conn.socket.readyState === WebSocket.OPEN) {
          conn.socket.send(messageStr);
        }
      });
    }
  });

  fastify.decorate('broadcastToAll', (message: WebSocketMessage) => {
    const messageStr = JSON.stringify(message);
    allConnections.forEach(conn => {
      if (conn.socket.readyState === WebSocket.OPEN) {
        conn.socket.send(messageStr);
      }
    });
  });

  fastify.decorate('broadcastToSubscribers', (eventType: string, message: WebSocketMessage) => {
    const messageStr = JSON.stringify(message);
    allConnections.forEach(conn => {
      if (conn.socket.readyState === WebSocket.OPEN && conn.subscriptions.has(eventType)) {
        conn.socket.send(messageStr);
      }
    });
  });
});

function handleSubscription(socket: AuthenticatedWebSocket, message: WebSocketMessage) {
  const { events } = message.data;
  if (Array.isArray(events)) {
    events.forEach(event => socket.subscriptions?.add(event));
    
    socket.send(JSON.stringify({
      type: 'subscribed',
      data: { events },
      timestamp: new Date().toISOString()
    }));
  }
}

function handleUnsubscription(socket: AuthenticatedWebSocket, message: WebSocketMessage) {
  const { events } = message.data;
  if (Array.isArray(events)) {
    events.forEach(event => socket.subscriptions?.delete(event));
    
    socket.send(JSON.stringify({
      type: 'unsubscribed',
      data: { events },
      timestamp: new Date().toISOString()
    }));
  }
}

function addConnection(connection: WebSocketConnection) {
  allConnections.add(connection);
  
  if (!connectionsByTeam.has(connection.teamId)) {
    connectionsByTeam.set(connection.teamId, new Set());
  }
  connectionsByTeam.get(connection.teamId)!.add(connection);
}

function removeConnection(connection: WebSocketConnection) {
  allConnections.delete(connection);
  
  const teamConnections = connectionsByTeam.get(connection.teamId);
  if (teamConnections) {
    teamConnections.delete(connection);
    if (teamConnections.size === 0) {
      connectionsByTeam.delete(connection.teamId);
    }
  }
}

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    broadcastToTeam: (teamId: string, message: WebSocketMessage) => void;
    broadcastToAll: (message: WebSocketMessage) => void;
    broadcastToSubscribers: (eventType: string, message: WebSocketMessage) => void;
  }
}
