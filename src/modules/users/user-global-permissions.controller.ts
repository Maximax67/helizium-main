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
import { UserGlobalPermissionService } from './user-global-permissions.service';
import { AuthorizedGuard, ForbidApiTokensGuard } from '../../common/guards';
import { CurrentUserId } from '../../common/decorators';
import { ValidateMongoId } from '../../common/pipes';
import { SetGlobalPermissionsDto, UserGlobalPermissionsDto } from './dtos';
import { Serialize } from '../../common/interceptors';

@Controller({ path: 'u/:userId/p/g', version: '1' })
@UseGuards(AuthorizedGuard)
export class UserGlobalPermissionsController {
  constructor(
    private readonly userGlobalPermissionsService: UserGlobalPermissionService,
  ) {}

  @Get()
  @Serialize(UserGlobalPermissionsDto)
  async get(
    @Param('userId', ValidateMongoId) userId: string,
    @CurrentUserId() currentUserId: string,
  ) {
    const result = await this.userGlobalPermissionsService.getIfAllowed(
      userId,
      currentUserId,
    );

    return {
      permissions: result.permissions,
      setBy: result.setBy?.toString(),
      timestamp: result.timestamp,
    };
  }

  @Post()
  @UseGuards(ForbidApiTokensGuard)
  async set(
    @Param('userId', ValidateMongoId) userId: string,
    @CurrentUserId() currentUserId: string,
    @Body() setGlobalPermissionsDto: SetGlobalPermissionsDto,
  ) {
    await this.userGlobalPermissionsService.setIfAllowed(
      userId,
      currentUserId,
      setGlobalPermissionsDto.permissions,
    );
  }

  @Delete()
  @UseGuards(ForbidApiTokensGuard)
  @HttpCode(204)
  async delete(
    @Param('userId', ValidateMongoId) userId: string,
    @CurrentUserId() currentUserId: string,
  ) {
    await this.userGlobalPermissionsService.revokeAllIfAllowed(
      userId,
      currentUserId,
    );
  }
}
