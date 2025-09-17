import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountImageDto } from './create-account-image.dto';

export class UpdateAccountImageDto extends PartialType(CreateAccountImageDto) {}
