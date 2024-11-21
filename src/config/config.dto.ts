import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class AppConfig {
  @IsString()
  @IsNotEmpty()
  nodeEnv: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  port: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  ip?: string;

  @IsString()
  @IsNotEmpty()
  grpcUrl: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  mongodbUrl?: string;

  @IsString()
  @IsNotEmpty()
  otlpCollectorUrl: string;
}
