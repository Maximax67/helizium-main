import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage } from './schemas/message.schema';
import { Collections } from '../../common/enums';
import { User } from '../users/schemas';
import { ChatWsService } from './chat-ws.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Collections.MESSAGES)
    private readonly messageModel: Model<ChatMessage>,

    @InjectModel(Collections.USERS)
    private readonly userModel: Model<User>,

    private readonly chatWsService: ChatWsService,
  ) {}

  private toOid(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    return new Types.ObjectId(id);
  }

  async getChats(userId: string): Promise<any[]> {
    const userOid = this.toOid(userId);

    // Get all messages involving this user
    const messages = await this.messageModel
      .find({
        $or: [{ from: userOid }, { to: userOid }],
      })
      .sort({ createdAt: -1 })
      .lean();

    // Group by conversation partner
    const chatMap = new Map<string, any>();

    for (const msg of messages as any[]) {
      const contactId =
        msg.from.toString() === userId ? msg.to.toString() : msg.from.toString();

      if (!chatMap.has(contactId)) {
        chatMap.set(contactId, {
          contactId,
          lastMessage: msg.message,
          lastMessageTime: msg.createdAt?.toISOString(),
          unreadCount: 0,
        });
      }

      // Count unread messages TO this user FROM this contact
      if (msg.to.toString() === userId && !msg.readAt) {
        chatMap.get(contactId)!.unreadCount++;
      }
    }

    // Fetch usernames for all contacts
    const contactIds = [...chatMap.keys()].map((id) => new Types.ObjectId(id));
    const users = await this.userModel
      .find({ _id: { $in: contactIds }, isBanned: false })
      .select('_id username')
      .lean();

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u.username]));

    const result: any[] = [];
    for (const [contactId, chat] of chatMap.entries()) {
      const username = userMap.get(contactId);
      if (!username) continue; // skip banned users
      result.push({ ...chat, contactUsername: username });
    }

    // Sort: unread first, then by last message time
    result.sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return result;
  }

  async getMessages(userId: string, contactId: string): Promise<any[]> {
    const userOid = this.toOid(userId);
    const contactOid = this.toOid(contactId);

    const messages = await this.messageModel
      .find({
        $or: [
          { from: userOid, to: contactOid },
          { from: contactOid, to: userOid },
        ],
      })
      .sort({ createdAt: 1 })
      .lean();

    // Mark messages to this user as read
    await this.messageModel.updateMany(
      { from: contactOid, to: userOid, readAt: null },
      { $set: { readAt: new Date() } },
    );

    // Get username for contact
    const contact = await this.userModel.findById(contactId).select('username').lean();

    return (messages as any[]).map((msg) => ({
      id: msg._id.toString(),
      from: msg.from.toString(),
      to: msg.to.toString(),
      message: msg.message,
      postedAt: msg.createdAt?.toISOString(),
      readAt: msg.readAt?.toISOString() || null,
      fromUsername:
        msg.from.toString() === userId
          ? 'me'
          : (contact as any)?.username || 'Unknown',
    }));
  }

  async sendMessage(userId: string, contactId: string, message: string): Promise<any> {
    const userOid = this.toOid(userId);
    const contactOid = this.toOid(contactId);

    if (userId === contactId) throw new BadRequestException('Cannot message yourself');

    // Verify contact exists and is not banned
    const contact = await this.userModel
      .findOne({ _id: contactOid, isDeleted: false, isBanned: false })
      .select('_id username')
      .lean();

    if (!contact) throw new BadRequestException('Contact not found or banned');

    const msg = await this.messageModel.create({
      from: userOid,
      to: contactOid,
      message,
    });

    const senderPayload = {
      id: msg._id.toString(),
      from: userId,
      to: contactId,
      message: msg.message,
      postedAt: (msg as any).createdAt?.toISOString(),
      readAt: null,
      fromUsername: 'me',
    };

    const recipientPayload = {
      ...senderPayload,
      fromUsername: (contact as any).username,
    };

    // Push real-time events via SSE (history stays in MongoDB)
    this.chatWsService.emit(userId, 'new-message', senderPayload);
    this.chatWsService.emit(contactId, 'new-message', recipientPayload);
    this.chatWsService.emit(contactId, 'chat-updated', {
      contactId: userId,
      lastMessage: message,
    });

    return senderPayload;
  }

  async markRead(userId: string, contactId: string): Promise<void> {
    const userOid = this.toOid(userId);
    const contactOid = this.toOid(contactId);

    await this.messageModel.updateMany(
      { from: contactOid, to: userOid, readAt: null },
      { $set: { readAt: new Date() } },
    );
  }
}
