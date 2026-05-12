import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'ws';
import type WebSocket from 'ws';
import { ChatWsService } from './chat-ws.service';

@WebSocketGateway({ path: '/chat-ws' })
export class ChatWsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly pendingAuth = new Map<WebSocket, NodeJS.Timeout>();
  private readonly wsToUser = new Map<WebSocket, string>();

  constructor(private readonly chatWsService: ChatWsService) {}

  handleConnection(client: WebSocket): void {
    const timeout = setTimeout(() => {
      if (client.readyState === client.OPEN) {
        client.close(4001, 'Auth timeout');
      }
    }, 10_000);
    this.pendingAuth.set(client, timeout);
  }

  @SubscribeMessage('auth')
  handleAuth(client: WebSocket, payload: { token: string }): void {
    const userId = this.chatWsService.consumeToken(payload.token);
    if (!userId) {
      client.close(4001, 'Invalid or expired token');
      return;
    }

    clearTimeout(this.pendingAuth.get(client));
    this.pendingAuth.delete(client);

    this.wsToUser.set(client, userId);
    this.chatWsService.addClient(userId, client);

    client.send(JSON.stringify({ type: 'connected' }));
  }

  handleDisconnect(client: WebSocket): void {
    clearTimeout(this.pendingAuth.get(client));
    this.pendingAuth.delete(client);

    const userId = this.wsToUser.get(client);
    if (userId) {
      this.chatWsService.removeClient(userId);
      this.wsToUser.delete(client);
    }
  }
}
