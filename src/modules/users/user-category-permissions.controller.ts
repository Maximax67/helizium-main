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
import { UserCategoryPermissionsService } from './user-category-permissions.service';
import { AuthorizedGuard, ForbidApiTokensGuard } from '../../common/guards';
import { CurrentUserId } from '../../common/decorators';
import { ValidateMongoId } from '../../common/pipes';
import { UserCategoryPermissionsArrayDto } from './dtos';
import { Serialize } from '../../common/interceptors';
import { CategoryPermissionsFullDto } from '../categories/dtos';

@Controller({ path: 'u/:userId/p/c/:categoryId', version: '1' })
@UseGuards(AuthorizedGuard)
export class UserCategoryPermissionsController {
  constructor(
    private readonly userCategoryPermissionsService: UserCategoryPermissionsService,
  ) {}

  @Get()
  @Serialize(UserCategoryPermissionsArrayDto)
  async get(
    @Param('userId', ValidateMongoId) userId: string,
    @Param('categoryId', ValidateMongoId) categoryId: string,
    @CurrentUserId() currentUserId: string,
  ) {
    const result = await this.userCategoryPermissionsService.getIfAllowed(
      userId,
      categoryId,
      currentUserId,
    );

    return {
      permissions: result,
    };
  }

  @Post()
  @UseGuards(ForbidApiTokensGuard)
  async set(
    @Param('userId', ValidateMongoId) userId: string,
    @Param('categoryId', ValidateMongoId) categoryId: string,
    @CurrentUserId() currentUserId: string,
    @Body() setPermissionsDto: CategoryPermissionsFullDto,
  ) {
    const {
      categoriesGranted,
      categoriesRevoked,
      topicsGranted,
      topicsRevoked,
    } = setPermissionsDto;

    await this.userCategoryPermissionsService.setIfAllowed(
      userId,
      categoryId,
      currentUserId,
      categoriesGranted,
      categoriesRevoked,
      topicsGranted,
      topicsRevoked,
    );
  }

  @Delete()
  @UseGuards(ForbidApiTokensGuard)
  @HttpCode(204)
  async delete(
    @Param('userId', ValidateMongoId) userId: string,
    @Param('categoryId', ValidateMongoId) categoryId: string,
    @CurrentUserId() currentUserId: string,
  ) {
    await this.userCategoryPermissionsService.revokeAllIfAllowed(
      userId,
      categoryId,
      currentUserId,
    );
  }
}
