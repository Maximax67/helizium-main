import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import {
  CategoryDto,
  CategoryFullInfoDto,
  CreateCategoryDto,
  EditCategoryDto,
  RestoreCategoryDto,
} from './dtos';
import { AuthorizedGuard, ForbidApiTokensGuard } from '../../common/guards';
import { TokenLimits } from '../../common/enums';
import { ValidateMongoId } from '../../common/pipes';
import { AllowedLimits, CurrentUserId } from '../../common/decorators';
import { Serialize } from '../../common/interceptors';

@Controller({ path: 'categories', version: '1' })
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  async create(
    @CurrentUserId() userId: string,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    await this.categoryService.create(userId, createCategoryDto);
  }

  @Get()
  @Serialize(CategoryFullInfoDto)
  async getRoot() {
    return this.categoryService.getRootFullInfo();
  }

  @Get('/:id')
  @Serialize(CategoryFullInfoDto)
  async get(@Param('id', ValidateMongoId) categoryId: string) {
    return this.categoryService.getFullInfo(categoryId, null);
  }

  @Get('/:id/info')
  @Serialize(CategoryDto)
  async getInfo(@Param('id', ValidateMongoId) categoryId: string) {
    return this.categoryService.get(categoryId, null);
  }

  @Get('/:id/permissions')
  async getPermissions(@Param('id', ValidateMongoId) categoryId: string) {
    return this.categoryService.getPermissions(categoryId, null);
  }

  @Put('/:id')
  @UseGuards(AuthorizedGuard, ForbidApiTokensGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  @HttpCode(204)
  async edit(
    @CurrentUserId() userId: string,
    @Param('id', ValidateMongoId) categoryId: string,
    @Body() editCategoryDto: EditCategoryDto,
  ) {
    await this.categoryService.edit(categoryId, userId, editCategoryDto);
  }

  @Delete('/:id')
  @UseGuards(AuthorizedGuard, ForbidApiTokensGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  @HttpCode(204)
  async delete(
    @CurrentUserId() userId: string,
    @Param('id', ValidateMongoId) categoryId: string,
  ) {
    await this.categoryService.delete(categoryId, userId);
  }

  @Put('/:id/pin')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  @HttpCode(204)
  async pin(
    @CurrentUserId() userId: string,
    @Param('id', ValidateMongoId) categoryId: string,
  ) {
    await this.categoryService.pin(categoryId, userId);
  }

  @Put('/:id/unpin')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  @HttpCode(204)
  async unpin(
    @CurrentUserId() userId: string,
    @Param('id', ValidateMongoId) categoryId: string,
  ) {
    await this.categoryService.unpin(categoryId, userId);
  }

  @Post('/:id/restore')
  @UseGuards(AuthorizedGuard)
  @AllowedLimits([TokenLimits.DEFAULT, TokenLimits.ROOT])
  @HttpCode(204)
  async restore(
    @CurrentUserId() userId: string,
    @Param('id', ValidateMongoId) categoryId: string,
    @Body() restoreCategoryDto: RestoreCategoryDto,
  ) {
    await this.categoryService.restore(
      categoryId,
      userId,
      restoreCategoryDto.restoreInner,
    );
  }
}
