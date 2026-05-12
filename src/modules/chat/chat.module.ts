import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessageSchema } from './schemas/message.schema';
import { ChatService } from './chat.service';
import { ChatWsService } from './chat-ws.service';
import { ChatController } from './chat.controller';
import { Collections } from '../../common/enums';
import { UserSchema } from '../users/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collections.MESSAGES, schema: ChatMessageSchema },
      { name: Collections.USERS, schema: UserSchema },
    ]),
  ],
  providers: [ChatService, ChatWsService],
  controllers: [ChatController],
})
export class ChatModule {}
