import { FastifyPluginAsync } from 'fastify';
import { WebSocketService } from '../services/websocket.service.js';

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  const wsService = new WebSocketService(fastify);
  
  // Store the service instance on the fastify instance so it can be accessed elsewhere
  fastify.decorate('wsService', wsService);

  // WebSocket route for sync notifications
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    // Check if user is authenticated
    const userId = request.session?.userId;
    
    if (!userId) {
      connection.close(4001, 'Unauthorized');
      return;
    }

    // Register the client
    wsService.registerClient(userId, connection);

    // Send initial connection success message
    connection.send(JSON.stringify({
      type: 'connected',
      data: { userId, timestamp: Date.now() }
    }));

    // Handle incoming messages (if needed for future features)
    connection.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle ping from client
        if (data.type === 'ping') {
          connection.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        
        // Add other message handlers as needed
      } catch (error: unknown) {
        fastify.log.error({ error }, 'Error parsing WebSocket message');
      }
    });
  });
};

// Type augmentation for fastify
declare module 'fastify' {
  interface FastifyInstance {
    wsService: WebSocketService;
  }
}
