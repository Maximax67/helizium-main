import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Post, Put, Query, Request, UseGuards,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dtos/create-task.dto';
import { EditTaskDto } from './dtos/edit-task.dto';
import { AuthorizedGuard } from '../../common/guards';
import {
  AllowedLimits, CurrentUserId, OptionalAuthorization,
} from '../../common/decorators';
import { AuthorizedRequest } from '../../common/interfaces';
import { TokenLimits } from '../../common/enums';
import { ValidateMongoId } from '../../common/pipes';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

class TaskQueryDto {
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsNumber() @Min(1) limit?: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Transform(({ value }) => parseFloat(value)) @IsNumber() minPrice?: number;
  @IsOptional() @Transform(({ value }) => parseFloat(value)) @IsNumber() maxPrice?: number;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() sortDir?: string;
  @IsOptional() @IsString() authorId?: string;
  @IsOptional() @IsString() performerId?: string;
  @IsOptional() @IsString() status?: string;
}

class SubmitWorkDto { @IsString() workResult: string; }
class RejectWorkDto { @IsString() rejectionMessage: string; }
class CompleteTaskDto { @IsOptional() @IsString() contractTxHash?: string; }
class ApproveApplicantDto { @IsOptional() @IsString() contractTxHash?: string; }
class RateTaskDto { @IsNumber() @Min(1) rating: number; }
class RaiseDisputeDto { @IsOptional() @IsString() contractTxHash?: string; }
class ResolveDisputeDto {
  @IsBoolean() favorFreelancer: boolean;
  @IsOptional() @IsString() contractTxHash?: string;
}

@Controller({ path: 'tasks', version: '1' })
export class TaskController {
  constructor(private readonly taskService: TaskService) { }

  private isAdmin(req: AuthorizedRequest): boolean {
    return (
      req.auth?.limits === TokenLimits.ROOT ||
      req.auth?.limits === TokenLimits.BANNED_ROOT
    );
  }

  @Get()
  @OptionalAuthorization()
  async listTasks(@Query() query: TaskQueryDto) {
    return this.taskService.listTasks({
      page: query.page || 1,
      limit: Math.min(query.limit || 10, 50),
      categoryId: query.categoryId,
      search: query.search,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      fromDate: query.fromDate,
      toDate: query.toDate,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      authorId: query.authorId,
      performerId: query.performerId,
      status: query.status,
    });
  }

  @Get('/my-stats')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async getMyStats(@CurrentUserId() userId: string) {
    return this.taskService.getMyStats(userId);
  }

  @Get('/:id')
  @OptionalAuthorization()
  async getTask(@Param('id', ValidateMongoId) id: string) {
    return this.taskService.getTask(id);
  }

  @Post()
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async createTask(@CurrentUserId() userId: string, @Body() dto: CreateTaskDto) {
    return this.taskService.createTask(userId, dto);
  }

  @Put('/:id')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async editTask(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Body() dto: EditTaskDto,
  ) {
    return this.taskService.editTask(id, userId, dto);
  }

  @Delete('/:id')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  @HttpCode(204)
  async deleteTask(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Request() req: AuthorizedRequest,
  ) {
    await this.taskService.deleteTask(id, userId, this.isAdmin(req));
  }

  @Post('/:id/apply')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async apply(@Param('id', ValidateMongoId) id: string, @CurrentUserId() userId: string) {
    return this.taskService.applyForTask(id, userId);
  }

  @Post('/:id/reject/:applicantId')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async rejectApplicant(
    @Param('id', ValidateMongoId) id: string,
    @Param('applicantId', ValidateMongoId) applicantId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.taskService.rejectApplicant(id, applicantId, userId);
  }

  @Post('/:id/approve/:applicantId')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async approveApplicant(
    @Param('id', ValidateMongoId) id: string,
    @Param('applicantId', ValidateMongoId) applicantId: string,
    @CurrentUserId() userId: string,
    @Body() dto: ApproveApplicantDto,
  ) {
    return this.taskService.approveApplicant(id, applicantId, userId, dto.contractTxHash);
  }

  @Post('/:id/submit-work')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async submitWork(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Body() dto: SubmitWorkDto,
  ) {
    return this.taskService.submitWork(id, userId, dto.workResult);
  }

  @Post('/:id/complete')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async completeTask(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.taskService.completeTask(id, userId, dto.contractTxHash);
  }

  @Post('/:id/reject-work')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async rejectWork(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Body() dto: RejectWorkDto,
  ) {
    return this.taskService.rejectWork(id, userId, dto.rejectionMessage);
  }

  @Post('/:id/discard-freelancer')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async discardFreelancer(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.taskService.discardFreelancer(id, userId, true);
  }

  @Post('/:id/rate')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async rateTask(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Body() dto: RateTaskDto,
  ) {
    return this.taskService.rateTask(id, userId, dto.rating);
  }

  @Post('/:id/raise-dispute')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async raiseDispute(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Request() req: AuthorizedRequest,
    @Body() _dto: RaiseDisputeDto,
  ) {
    return this.taskService.raiseDispute(id, userId, this.isAdmin(req));
  }

  @Post('/:id/resolve-dispute')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async resolveDispute(
    @Param('id', ValidateMongoId) id: string,
    @CurrentUserId() userId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.taskService.resolveDispute(id, userId, dto.favorFreelancer, dto.contractTxHash);
  }
}
