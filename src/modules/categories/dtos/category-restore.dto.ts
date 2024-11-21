import { IsBoolean } from 'class-validator';

export class RestoreCategoryDto {
  @IsBoolean()
  restoreInner: boolean;
}
