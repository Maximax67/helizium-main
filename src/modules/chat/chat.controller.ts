import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthorizedGuard, ForbidApiTokensGuard } from '../../common/guards';
import { AllowedLimits, CurrentUserId } from '../../common/decorators';
import { TokenLimits } from '../../common/enums';
import { ValidateMongoId } from '../../common/pipes';
import { IsString, MinLength, MaxLength } from 'class-validator';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}

@Controller({ path: 'chat', version: '1' })
@UseGuards(AuthorizedGuard, ForbidApiTokensGuard)
@AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Get()
  async getChats(@CurrentUserId() userId: string) {
    return this.chatService.getChats(userId);
  }

  @Get('/:contactId')
  async getMessages(
    @CurrentUserId() userId: string,
    @Param('contactId', ValidateMongoId) contactId: string,
  ) {
    return this.chatService.getMessages(userId, contactId);
  }

  @Post('/:contactId')
  async sendMessage(
    @CurrentUserId() userId: string,
    @Param('contactId', ValidateMongoId) contactId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, contactId, dto.message);
  }

  @Put('/:contactId/read')
  @HttpCode(204)
  async markRead(
    @CurrentUserId() userId: string,
    @Param('contactId', ValidateMongoId) contactId: string,
  ) {
    await this.chatService.markRead(userId, contactId);
  }
}
