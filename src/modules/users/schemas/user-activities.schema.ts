import { Prop, Schema } from '@nestjs/mongoose';

@Schema({
  _id: false,
  versionKey: false,
})
export class PostVotes {
  @Prop({ default: 0 })
  upvotes: number;

  @Prop({ default: 0 })
  downvotes: number;

  @Prop({ default: 0 })
  myUpvotes: number;

  @Prop({ default: 0 })
  myDownvotes: number;
}

@Schema({
  _id: false,
  versionKey: false,
})
export class CommentVotes {
  @Prop({ default: 0 })
  upvotes: number;

  @Prop({ default: 0 })
  downvotes: number;

  @Prop({ default: 0 })
  myUpvotes: number;

  @Prop({ default: 0 })
  myDownvotes: number;
}

@Schema({
  _id: false,
  versionKey: false,
})
export class UserActivities {
  @Prop({ type: PostVotes, default: () => ({}) })
  postVotes: PostVotes;

  @Prop({ type: CommentVotes, default: () => ({}) })
  commentVotes: CommentVotes;

  @Prop({ default: 0 })
  categories: number;

  @Prop({ default: 0 })
  posts: number;

  @Prop({ default: 0 })
  comments: number;
}
