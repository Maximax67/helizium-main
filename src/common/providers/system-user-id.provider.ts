import { Types } from 'mongoose';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SystemUserIdProvider {
  private _systemUserId: Types.ObjectId;

  set systemUserId(id: Types.ObjectId) {
    this._systemUserId = id;
  }

  get systemUserId(): Types.ObjectId {
    return this._systemUserId;
  }
}
