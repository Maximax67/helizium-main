import { Injectable } from '@nestjs/common';
import { ServerResponse } from 'http';

@Injectable()
export class ChatSseService {
  private readonly clients = new Map<string, ServerResponse>();

  addClient(userId: string, res: ServerResponse): void {
    this.clients.set(userId, res);
  }

  removeClient(userId: string): void {
    this.clients.delete(userId);
  }

  emit(userId: string, event: string, data: unknown): void {
    const client = this.clients.get(userId);
    if (client && !client.destroyed) {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  hasClient(userId: string): boolean {
    return this.clients.has(userId);
  }
}
