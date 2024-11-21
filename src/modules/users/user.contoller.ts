import { Controller, Get, UseGuards } from '@nestjs/common';
import { RpcException, GrpcMethod } from '@nestjs/microservices';
import { UserService } from './user.service';
import { AuthorizedGuard } from '../../common/guards';
import { Serialize } from '../../common/interceptors';
import { UserInfoDto } from './dtos';
import { CurrentUserId, GrpcRequiredFields } from '../../common/decorators';
import {
  Empty,
  UserIdMsg,
  SignUpMsg,
  SERVICE_NAME as USER_SERVICE_NAME,
} from './users.grpc';

@Controller({ path: 'u', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  @Serialize(UserInfoDto)
  @UseGuards(AuthorizedGuard)
  getUserInfo(@CurrentUserId() userId: string): Promise<UserInfoDto> {
    return this.userService.getUserInfo(userId);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'SignUp')
  @GrpcRequiredFields(['username', 'email'])
  async signUp(signUpMsg: SignUpMsg): Promise<UserIdMsg> {
    const { username, email } = signUpMsg;
    const userId = await this.userService.create(username!, email!);
    return { userId };
  }

  @GrpcMethod(USER_SERVICE_NAME, 'BanUser')
  @GrpcRequiredFields(['userId'])
  async ban(userIdMsg: UserIdMsg) {
    const result = await this.userService.ban(userIdMsg.userId!);
    if (result === null) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: 'User not found',
      });
    }

    if (result === false) {
      throw new RpcException({
        code: 9, // FAILED_PRECONDITION
        message: 'Already banned',
      });
    }

    return {};
  }

  @GrpcMethod(USER_SERVICE_NAME, 'UnbanUser')
  @GrpcRequiredFields(['userId'])
  async unban(userIdMsg: UserIdMsg) {
    const result = await this.userService.unban(userIdMsg.userId!);
    if (result === null) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: 'User not found',
      });
    }

    if (result === false) {
      throw new RpcException({
        code: 9, // FAILED_PRECONDITION
        message: 'Not banned',
      });
    }

    return {};
  }

  @GrpcMethod(USER_SERVICE_NAME, 'DeleteUser')
  @GrpcRequiredFields(['userId'])
  async delete(userIdMsg: UserIdMsg): Promise<Empty> {
    const result = await this.userService.delete(userIdMsg.userId!);
    if (result === null) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: 'User not found',
      });
    }

    if (result === false) {
      throw new RpcException({
        code: 9, // FAILED_PRECONDITION
        message: 'Already deleted',
      });
    }

    return {};
  }
}
