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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
  @UseInterceptors(
    FilesInterceptor('mediaFiles', 10, {
      storage: diskStorage({
        destination: './uploads/media',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = extname(file.originalname);
          const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|mp4|mov|avi)$/)) {
          callback(null, true);
        } else {
          callback(new Error('Only image and video files are allowed!'), false);
        }
      },
    }),
  )
  create(
    @GetUser() user: any, 
    @Body() createContentDto: CreateContentDto,
    @UploadedFiles() mediaFiles?: Express.Multer.File[]
  ) {
    return this.contentService.create(user.id, createContentDto, mediaFiles);
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

  @Post('media/:mediaId/regenerate')
  async regenerateMedia(
    @Param('mediaId') mediaId: string,
    @Body() body: { prompt: string },
    @GetUser() user: any
  ) {
    return this.contentService.regenerateMedia(+mediaId, body.prompt, user.id);
  }
}

