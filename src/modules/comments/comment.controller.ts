import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { AuthorizedGuard } from '../../common/guards';
import { AllowedLimits, CurrentUserId, OptionalAuthorization } from '../../common/decorators';
import { TokenLimits } from '../../common/enums';
import { ValidateMongoId } from '../../common/pipes';
import { IsString, MinLength, MaxLength } from 'class-validator';

class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}

@Controller({ path: 'tasks/:taskId/comments', version: '1' })
export class CommentController {
  constructor(private readonly commentService: CommentService) { }

  @Get()
  @OptionalAuthorization()
  async getComments(
    @Param('taskId', ValidateMongoId) taskId: string,
    @CurrentUserId() userId: string | null,
  ) {
    return this.commentService.getComments(taskId, userId || undefined);
  }

  @Post()
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async createComment(
    @Param('taskId', ValidateMongoId) taskId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.createComment(taskId, userId, dto.text);
  }

  @Delete('/:commentId')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  @HttpCode(204)
  async deleteComment(
    @Param('taskId', ValidateMongoId) taskId: string,
    @Param('commentId', ValidateMongoId) commentId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.commentService.deleteComment(taskId, commentId, userId, false);
  }
}
