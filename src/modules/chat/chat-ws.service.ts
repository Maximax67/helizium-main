import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type WebSocket from 'ws';

interface PendingToken {
  userId: string;
  expiresAt: number;
}

@Injectable()
export class ChatWsService {
  private readonly clients = new Map<string, WebSocket>();
  private readonly pendingTokens = new Map<string, PendingToken>();

  generateToken(userId: string): string {
    const token = randomUUID();
    this.pendingTokens.set(token, {
      userId,
      expiresAt: Date.now() + 30_000,
    });
    return token;
  }

  consumeToken(token: string): string | null {
    const entry = this.pendingTokens.get(token);
    if (!entry) return null;
    this.pendingTokens.delete(token);
    if (Date.now() > entry.expiresAt) return null;
    return entry.userId;
  }

  addClient(userId: string, ws: WebSocket): void {
    this.clients.set(userId, ws);
  }

  removeClient(userId: string): void {
    this.clients.delete(userId);
  }

  emit(userId: string, type: string, data: unknown): void {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }
}
