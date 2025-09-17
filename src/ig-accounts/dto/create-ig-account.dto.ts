import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { IgAccountType } from '../../ig-accounts/entities/ig-account.entity';

export class CreateIgAccountDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  topics?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsEnum(IgAccountType)
  type?: IgAccountType;
}

