import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { MediaType } from '../media.entity';

export class CreateContentMediaDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsNumber()
  @IsNotEmpty()
  fileSize: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsEnum(MediaType)
  @IsNotEmpty()
  mediaType: MediaType;

  @IsOptional()
  @IsString()
  prompt?: string;
}

