import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Badges, UsernameColors } from '../../../common/enums';

import { UserActivities } from './user-activities.schema';
import { UserContact } from './user-contact.schema';
import { Badge } from './user-badge.schema';
import { UsernameColor } from './username-color.schema';
import { UserGlobalPermissions } from './user-global-permissions.schema';

@Schema({
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
})
export class User {
  @Prop({ trim: true, required: true, unique: true })
  username: string;

  @Prop({ trim: true })
  email: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: false })
  isBanned: boolean;

  @Prop({ trim: true })
  avatar?: string;

  @Prop({ min: 0, default: 0 })
  balance: number;

  @Prop({ min: 0, max: 100, default: 0 })
  trustRate: number;

  @Prop({ type: [Badge], default: [] })
  badges: Badge[];

  @Prop({ type: [UsernameColor], default: [] })
  usernameColors: UsernameColor[];

  // users/{id}/bio - DELETE, PATCH, (GET)
  @Prop({ trim: true })
  bio?: string;

  // users/{id}/bio - DELETE, PATCH, (GET)
  @Prop()
  birthsday?: Date;

  @Prop({ type: [UserContact], default: [] })
  contacts: [UserContact];

  @Prop({
    type: UserActivities,
    default: () => ({}),
  })
  activities: UserActivities;

  @Prop({
    type: UserGlobalPermissions,
    default: () => ({}),
  })
  globalPermissions: UserGlobalPermissions;

  selectedUsernameColor: UsernameColors;

  pinnedBadge: Badges;

  isBirthsday: boolean;
}

export type UserDocument = HydratedDocument<User>;

const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('selectedUsernameColor').get(function () {
  if (!this.usernameColors) {
    return UsernameColors.DEFAULT;
  }

  return (
    this.usernameColors.find(
      ({ selected, removedBy }) => selected && !removedBy,
    )?.color ?? UsernameColors.DEFAULT
  );
});

UserSchema.virtual('pinnedBadge').get(function () {
  if (!this.badges) {
    return null;
  }

  return (
    this.badges.find((badge) => badge.pinned && !badge.removedBy)?.badge ?? null
  );
});

UserSchema.virtual('isBirthsday').get(function () {
  if (!this.birthsday) {
    return false;
  }

  const today = new Date();
  const birthDate = new Date(this.birthsday);

  return (
    today.getDate() === birthDate.getDate() &&
    today.getMonth() === birthDate.getMonth()
  );
});

UserSchema.index({ username: 1 });
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

export { UserSchema };
