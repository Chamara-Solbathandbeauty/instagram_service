import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateAccountImageDto {
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

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}
