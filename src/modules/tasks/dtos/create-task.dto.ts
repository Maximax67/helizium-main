import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  content: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsEnum(['ETH', 'USD'])
  currency?: string;

  @IsString()
  @IsNotEmpty()
  dueDate: string;

  @IsOptional()
  @IsString()
  contractTxHash?: string;
}
