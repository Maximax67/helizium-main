import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CategoryPermissions, TopicPermissions } from '../../../common/enums';

@Schema({ _id: false, versionKey: false })
export class CategoryPermissionsSchema {
  @Prop({ type: Types.Array<CategoryPermissions> })
  categoriesGranted: Types.Array<CategoryPermissions>;

  @Prop({ type: Types.Array<CategoryPermissions> })
  categoriesRevoked: Types.Array<CategoryPermissions>;

  @Prop({ type: Types.Array<TopicPermissions> })
  topicsGranted: Types.Array<TopicPermissions>;

  @Prop({ type: Types.Array<TopicPermissions> })
  topicsRevoked: Types.Array<TopicPermissions>;
}
