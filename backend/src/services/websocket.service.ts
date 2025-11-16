import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

interface WebSocketClient {
  userId: string;
  connection: WebSocket;
}

export class WebSocketService {
  private clients: Map<string, WebSocketClient[]> = new Map();
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Register a new WebSocket client
   */
  registerClient(userId: string, connection: WebSocket) {
    const client: WebSocketClient = { userId, connection };
    
    const userClients = this.clients.get(userId) || [];
    userClients.push(client);
    this.clients.set(userId, userClients);

    this.fastify.log.info(`WebSocket client registered for user ${userId}`);

    // Set up ping/pong to keep connection alive
    const pingInterval = setInterval(() => {
      if (connection.readyState === connection.OPEN) {
        connection.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

    // Handle connection close
    connection.on('close', () => {
      this.unregisterClient(userId, connection);
      clearInterval(pingInterval);
    });

    connection.on('error', (error: Error) => {
      this.fastify.log.error({ error }, `WebSocket error for user ${userId}`);
      this.unregisterClient(userId, connection);
      clearInterval(pingInterval);
    });
  }

  /**
   * Unregister a WebSocket client
   */
  private unregisterClient(userId: string, connection: WebSocket) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const updated = userClients.filter(c => c.connection !== connection);
      if (updated.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, updated);
      }
      this.fastify.log.info(`WebSocket client unregistered for user ${userId}`);
    }
  }

  /**
   * Notify a specific user about data changes
   */
  notifyUser(userId: string, event: { type: string; data?: any }) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) {
      return;
    }

    const message = JSON.stringify(event);
    
    userClients.forEach(client => {
      if (client.connection.readyState === client.connection.OPEN) {
        try {
          client.connection.send(message);
        } catch (error: unknown) {
          this.fastify.log.error({ error }, `Failed to send WebSocket message to user ${userId}`);
        }
      }
    });
  }

  /**
   * Notify about button changes
   */
  notifyButtonChange(userId: string, operation: 'create' | 'update' | 'delete', buttonId: string) {
    this.notifyUser(userId, {
      type: 'button_change',
      data: { operation, buttonId, timestamp: Date.now() }
    });
  }

  /**
   * Notify about timelog changes
   */
  notifyTimeLogChange(userId: string, operation: 'create' | 'update' | 'delete', timeLogId: string) {
    this.notifyUser(userId, {
      type: 'timelog_change',
      data: { operation, timeLogId, timestamp: Date.now() }
    });
  }

  /**
   * Notify about target changes
   */
  notifyTargetChange(userId: string, operation: 'create' | 'update' | 'delete', targetId: string) {
    this.notifyUser(userId, {
      type: 'target_change',
      data: { operation, targetId, timestamp: Date.now() }
    });
  }

  /**
   * Notify about sync needed (general notification)
   */
  notifySyncNeeded(userId: string) {
    this.notifyUser(userId, {
      type: 'sync_needed',
      data: { timestamp: Date.now() }
    });
  }

  /**
   * Get number of connected clients for a user
   */
  getClientCount(userId: string): number {
    return this.clients.get(userId)?.length || 0;
  }

  /**
   * Get total number of connected clients
   */
  getTotalClientCount(): number {
    let total = 0;
    this.clients.forEach(userClients => {
      total += userClients.length;
    });
    return total;
  }
}
