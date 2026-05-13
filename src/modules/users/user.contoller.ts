import {
  Controller, Get, UseGuards, Param, Put, Body, HttpCode,
} from '@nestjs/common';
import { RpcException, GrpcMethod } from '@nestjs/microservices';
import { UserService } from './user.service';
import { AuthorizedGuard } from '../../common/guards';
import { Serialize } from '../../common/interceptors';
import { UserInfoDto } from './dtos';
import { CurrentUserId, GrpcRequiredFields } from '../../common/decorators';
import {
  Empty, UserIdMsg, SignUpMsg,
  SERVICE_NAME as USER_SERVICE_NAME,
} from './users.grpc';
import { ValidateMongoId } from '../../common/pipes';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

class UpdateFieldDto {
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(200) industry?: string;
}

class UpdateEthAddressDto {
  /**
   * Ethereum address (0x + 40 hex chars) OR empty string to unset.
   */
  @IsString()
  @Matches(/^(0x[0-9a-fA-F]{40})?$/, {
    message: 'ethAddress must be a valid Ethereum address (0x...) or empty string',
  })
  ethAddress: string;
}

@Controller({ path: 'u', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('/me')
  @Serialize(UserInfoDto)
  @UseGuards(AuthorizedGuard)
  getUserInfo(@CurrentUserId() userId: string): Promise<UserInfoDto> {
    return this.userService.getUserInfo(userId);
  }

  @Get('/:userId/public')
  async getPublicProfile(@Param('userId', ValidateMongoId) userId: string) {
    return this.userService.getPublicProfile(userId);
  }

  @Put('/me/bio')
  @UseGuards(AuthorizedGuard)
  @HttpCode(204)
  async updateBio(@CurrentUserId() userId: string, @Body() body: UpdateFieldDto) {
    await this.userService.updateProfileField(userId, 'bio', body.bio ?? '');
  }

  @Put('/me/location')
  @UseGuards(AuthorizedGuard)
  @HttpCode(204)
  async updateLocation(@CurrentUserId() userId: string, @Body() body: UpdateFieldDto) {
    await this.userService.updateProfileField(userId, 'location', body.location ?? '');
  }

  @Put('/me/industry')
  @UseGuards(AuthorizedGuard)
  @HttpCode(204)
  async updateIndustry(@CurrentUserId() userId: string, @Body() body: UpdateFieldDto) {
    await this.userService.updateProfileField(userId, 'industry', body.industry ?? '');
  }

  /** Store the connected MetaMask/Ethereum wallet address in the user's profile. */
  @Put('/me/eth-address')
  @UseGuards(AuthorizedGuard)
  @HttpCode(204)
  async updateEthAddress(
    @CurrentUserId() userId: string,
    @Body() body: UpdateEthAddressDto,
  ) {
    await this.userService.updateProfileField(
      userId,
      'ethAddress' as any,
      body.ethAddress || null,
    );
  }

  // ──────────────────────────── gRPC handlers ──────────────────────────────

  @GrpcMethod(USER_SERVICE_NAME, 'SignUp')
  @GrpcRequiredFields(['username', 'email'])
  async signUp(signUpMsg: SignUpMsg): Promise<UserIdMsg> {
    const userId = await this.userService.create(signUpMsg.username!, signUpMsg.email!);
    return { userId };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'BanUser')
  @GrpcRequiredFields(['userId'])
  async ban(msg: UserIdMsg) {
    const result = await this.userService.ban(msg.userId!);
    if (result === null) throw new RpcException({ code: 5, message: 'User not found' });
    if (result === false) throw new RpcException({ code: 9, message: 'Already banned' });
    return {};
  }

  @GrpcMethod(USER_SERVICE_NAME, 'UnbanUser')
  @GrpcRequiredFields(['userId'])
  async unban(msg: UserIdMsg) {
    const result = await this.userService.unban(msg.userId!);
    if (result === null) throw new RpcException({ code: 5, message: 'User not found' });
    if (result === false) throw new RpcException({ code: 9, message: 'Not banned' });
    return {};
  }

  @GrpcMethod(USER_SERVICE_NAME, 'DeleteUser')
  @GrpcRequiredFields(['userId'])
  async delete(msg: UserIdMsg): Promise<Empty> {
    const result = await this.userService.delete(msg.userId!);
    if (result === null) throw new RpcException({ code: 5, message: 'User not found' });
    if (result === false) throw new RpcException({ code: 9, message: 'Already deleted' });
    return {};
  }
}
