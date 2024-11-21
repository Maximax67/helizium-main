import { CategoryPermissions, TopicPermissions, TopicTypes } from '../enums';

export const CATEGORIES_MAX_DEPTH = 8;
export const MAX_INNER_CATEGORIES = 255;

export const INT_BITS_SIZE = 64;
export const MAX_ACTIVE_CATEGORIES = 1n << BigInt(INT_BITS_SIZE);

export const ROOT_CATEGORY_TITLE = 'ROOT';
export const ROOT_CATEGORY_ALLOWED_TOPICS = Object.values(TopicTypes);

export const ROOT_CATEGORY_PERMISSIONS = [
  CategoryPermissions.DELETE_SELF,
  CategoryPermissions.EDIT_SELF,
];

export const ROOT_CATEGORY_TOPICS_PERMISSIONS = [
  TopicPermissions.CREATE, // Should be removed
  TopicPermissions.EDIT_SELF,
  TopicPermissions.DELETE_SELF,
  TopicPermissions.COMMENT,
  TopicPermissions.COMMENT_SELF,
  TopicPermissions.DELETE_COMMENTS_SELF,
  TopicPermissions.EDIT_COMMENTS_SELF,
];
