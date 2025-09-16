import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { CreateContentMediaDto } from './dto/create-content-media.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ContentType, ContentStatus } from './entities/content.entity';

@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  create(@GetUser() user: any, @Body() createContentDto: CreateContentDto) {
    return this.contentService.create(user.id, createContentDto);
  }

  @Get()
  findAll(
    @GetUser() user: any,
    @Query('accountId') accountId?: number,
    @Query('type') type?: ContentType,
    @Query('status') status?: ContentStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.contentService.findAll(user.id, {
      accountId,
      type,
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.contentService.findOne(+id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() updateContentDto: UpdateContentDto,
  ) {
    return this.contentService.update(+id, user.id, updateContentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.contentService.remove(+id, user.id);
  }

  // Media operations
  @Post(':id/media')
  addMedia(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() createMediaDto: CreateContentMediaDto,
  ) {
    return this.contentService.addMedia(+id, user.id, createMediaDto);
  }

  @Get(':id/media')
  getMedia(@Param('id') id: string, @GetUser() user: any) {
    return this.contentService.getMedia(+id, user.id);
  }

  @Delete('media/:mediaId')
  deleteMedia(@Param('mediaId') mediaId: string, @GetUser() user: any) {
    return this.contentService.deleteMedia(+mediaId, user.id);
  }
}

