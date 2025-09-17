import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media, MediaType } from '../../content/media.entity';
import { Content } from '../../content/content.entity';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface MediaGenerationResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

@Injectable()
export class MediaStorageService {
  private readonly mediaBasePath = process.env.MEDIA_STORAGE_PATH || './uploads/media';
  private readonly allowedImageTypes = ['jpg', 'jpeg', 'png', 'webp'];
  private readonly allowedVideoTypes = ['mp4', 'mov', 'avi', 'webm'];

  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
  ) {
    this.ensureMediaDirectoryExists();
  }

  private ensureMediaDirectoryExists(): void {
    if (!fs.existsSync(this.mediaBasePath)) {
      fs.mkdirSync(this.mediaBasePath, { recursive: true });
    }
  }

  async saveMediaFile(
    contentId: number | null,
    mediaData: Buffer,
    originalFileName: string,
    mediaType: 'image' | 'video',
    prompt?: string
  ): Promise<Media> {
    const fileExtension = this.getFileExtension(originalFileName);
    const fileName = `${uuidv4()}.${fileExtension}`;
    const relativePath = `${mediaType}s/${fileName}`;
    const fullPath = path.join(this.mediaBasePath, relativePath);

    // Ensure subdirectory exists
    const subDir = path.dirname(fullPath);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }

    // Save file
    fs.writeFileSync(fullPath, mediaData);

    // Create media record
    const media = this.mediaRepository.create({
      contentId,
      fileName,
      filePath: relativePath,
      fileSize: mediaData.length,
      mimeType: this.getMimeType(fileExtension),
      mediaType: mediaType === 'image' ? MediaType.IMAGE : MediaType.VIDEO,
      prompt,
    });

    return await this.mediaRepository.save(media);
  }

  async deleteMediaFile(mediaId: number): Promise<void> {
    const media = await this.mediaRepository.findOne({ where: { id: mediaId } });
    if (!media) {
      throw new Error('Media not found');
    }

    const fullPath = path.join(this.mediaBasePath, media.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await this.mediaRepository.delete(mediaId);
  }

  getMediaFilePath(media: Media): string {
    return path.join(this.mediaBasePath, media.filePath);
  }

  private getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || 'jpg';
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'webm': 'video/webm',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  validateMediaType(fileName: string, expectedType: 'image' | 'video'): boolean {
    const extension = this.getFileExtension(fileName);
    
    if (expectedType === 'image') {
      return this.allowedImageTypes.includes(extension);
    } else if (expectedType === 'video') {
      return this.allowedVideoTypes.includes(extension);
    }
    
    return false;
  }
}
