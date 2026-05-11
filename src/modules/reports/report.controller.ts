import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { AuthorizedGuard } from '../../common/guards';
import { AllowedLimits, CurrentUserId } from '../../common/decorators';
import { TokenLimits } from '../../common/enums';
import { ValidateMongoId } from '../../common/pipes';
import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';

class CreateReportDto {
  @IsString() @MinLength(10) @MaxLength(1000) reason: string;
}

class UpdateReportStatusDto {
  @IsEnum(['resolved', 'dismissed']) status: 'resolved' | 'dismissed';
}

@Controller({ version: '1' })
export class ReportController {
  constructor(private readonly reportService: ReportService) { }

  @Post('/tasks/:taskId/reports')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async createReport(
    @Param('taskId', ValidateMongoId) taskId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportService.createReport(taskId, userId, dto.reason);
  }

  @Get('/reports')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.ROOT])
  async getReports() {
    return this.reportService.getReports();
  }

  @Put('/reports/:reportId/status')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.ROOT])
  async updateReportStatus(
    @Param('reportId', ValidateMongoId) reportId: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportService.updateReportStatus(reportId, dto.status);
  }
}
