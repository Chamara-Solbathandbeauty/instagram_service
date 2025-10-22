import { IsArray, IsString, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class BulkUpdateStatusDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one content ID is required' })
  contentIds: number[];

  @IsString()
  @IsNotEmpty({ message: 'Status is required' })
  status: string;
}
