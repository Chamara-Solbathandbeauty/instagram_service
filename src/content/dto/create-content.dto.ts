import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, IsEnum } from 'class-validator';
import { ContentType, ContentStatus } from '../entities/content.entity';

export class CreateContentDto {
  @IsNumber()
  @IsNotEmpty()
  accountId: number;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashTags?: string[];

  @IsString()
  @IsNotEmpty()
  generatedSource: string;

  @IsOptional()
  @IsString()
  usedTopics?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

