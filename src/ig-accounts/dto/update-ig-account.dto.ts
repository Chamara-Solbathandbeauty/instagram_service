import { PartialType } from '@nestjs/mapped-types';
import { CreateIgAccountDto } from './create-ig-account.dto';

export class UpdateIgAccountDto extends PartialType(CreateIgAccountDto) {}

