import { IsNotEmpty, IsString, IsNumber, IsEnum } from 'class-validator';
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
}

