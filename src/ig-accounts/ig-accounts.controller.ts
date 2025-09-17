import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { IgAccountsService } from './ig-accounts.service';
import { CreateIgAccountDto } from './dto/create-ig-account.dto';
import { UpdateIgAccountDto } from './dto/update-ig-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('users/ig-accounts')
@UseGuards(JwtAuthGuard)
export class IgAccountsController {
  constructor(private readonly igAccountsService: IgAccountsService) {}

  @Post()
  create(@GetUser() user: any, @Body() createIgAccountDto: CreateIgAccountDto) {
    return this.igAccountsService.create(user.id, createIgAccountDto);
  }

  @Get()
  findAll(@GetUser() user: any) {
    return this.igAccountsService.findAllByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.igAccountsService.findOne(+id, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() updateIgAccountDto: UpdateIgAccountDto,
  ) {
    return this.igAccountsService.update(+id, user.id, updateIgAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.igAccountsService.remove(+id, user.id);
  }

  // Account Image Management Endpoints
  @Get(':id/images')
  getAccountImages(@Param('id') id: string, @GetUser() user: any) {
    return this.igAccountsService.getAccountImages(+id, user.id);
  }

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      storage: diskStorage({
        destination: './uploads/account-images',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = extname(file.originalname);
          const filename = `account-${req.params.id}-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          callback(null, true);
        } else {
          callback(new Error('Only image files are allowed!'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  )
  async uploadAccountImages(
    @Param('id') id: string,
    @GetUser() user: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      console.log('Upload request received:', { accountId: id, userId: user.id, filesCount: files?.length });
      
      if (!files || files.length === 0) {
        throw new Error('No files uploaded');
      }

      const uploadedImages = [];
      for (const file of files) {
        console.log('Processing file:', { filename: file.filename, size: file.size, mimetype: file.mimetype });
        
        const createImageDto = {
          fileName: file.filename,
          filePath: file.filename,
          fileSize: file.size,
          mimeType: file.mimetype,
        };

        const image = await this.igAccountsService.addAccountImage(+id, user.id, createImageDto);
        uploadedImages.push(image);
      }

      console.log('Successfully uploaded images:', uploadedImages.length);
      return uploadedImages;
    } catch (error) {
      console.error('Error in uploadAccountImages:', error);
      throw error;
    }
  }

  @Delete('images/:imageId')
  deleteAccountImage(@Param('imageId') imageId: string, @GetUser() user: any) {
    return this.igAccountsService.deleteAccountImage(+imageId, user.id);
  }

  @Put('images/:imageId/order')
  updateImageOrder(
    @Param('imageId') imageId: string,
    @Body() body: { order: number },
    @GetUser() user: any,
  ) {
    return this.igAccountsService.updateImageOrder(+imageId, body.order, user.id);
  }
}

