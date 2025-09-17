import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IgAccount } from './entities/ig-account.entity';
import { AccountImage } from './entities/account-image.entity';
import { CreateIgAccountDto } from './dto/create-ig-account.dto';
import { UpdateIgAccountDto } from './dto/update-ig-account.dto';
import { CreateAccountImageDto } from './dto/create-account-image.dto';

@Injectable()
export class IgAccountsService {
  constructor(
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(AccountImage)
    private accountImageRepository: Repository<AccountImage>,
  ) {}

  async create(userId: string, createIgAccountDto: CreateIgAccountDto): Promise<IgAccount> {
    const igAccount = this.igAccountRepository.create({
      ...createIgAccountDto,
      userId,
    });

    return this.igAccountRepository.save(igAccount);
  }

  async findAllByUser(userId: string): Promise<IgAccount[]> {
    return this.igAccountRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId: string): Promise<IgAccount> {
    const igAccount = await this.igAccountRepository.findOne({
      where: { id },
    });

    if (!igAccount) {
      throw new NotFoundException('Instagram account not found');
    }

    if (igAccount.userId !== userId) {
      throw new ForbiddenException('Access denied to this Instagram account');
    }

    return igAccount;
  }

  async findOneById(id: number): Promise<IgAccount> {
    const igAccount = await this.igAccountRepository.findOne({
      where: { id },
    });

    if (!igAccount) {
      throw new NotFoundException('Instagram account not found');
    }

    return igAccount;
  }

  async update(
    id: number,
    userId: string,
    updateIgAccountDto: UpdateIgAccountDto,
  ): Promise<IgAccount> {
    const igAccount = await this.findOne(id, userId);

    await this.igAccountRepository.update(id, updateIgAccountDto);
    return this.findOne(id, userId);
  }

  async remove(id: number, userId: string): Promise<void> {
    const igAccount = await this.findOne(id, userId);
    await this.igAccountRepository.remove(igAccount);
  }

  async updateInstagramConnection(
    id: number,
    connectionData: {
      instagramUserId?: string;
      instagramUsername?: string;
      accessToken?: string;
      tokenExpiresAt?: Date;
      isConnected?: boolean;
    },
  ): Promise<IgAccount> {
    await this.igAccountRepository.update(id, connectionData);
    return this.findOneById(id);
  }

  // Account Image Management Methods
  async getAccountImages(accountId: number, userId: string): Promise<AccountImage[]> {
    // Verify user owns the account
    await this.findOne(accountId, userId);
    
    return this.accountImageRepository.find({
      where: { accountId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async addAccountImage(
    accountId: number,
    userId: string,
    createImageDto: CreateAccountImageDto,
  ): Promise<AccountImage> {
    // Verify user owns the account
    await this.findOne(accountId, userId);

    // Check if account already has 3 images
    const existingImages = await this.accountImageRepository.count({
      where: { accountId },
    });

    if (existingImages >= 3) {
      throw new ForbiddenException('Account can have maximum 3 images');
    }

    // Set display order if not provided
    if (createImageDto.displayOrder === undefined) {
      createImageDto.displayOrder = existingImages;
    }

    const accountImage = this.accountImageRepository.create({
      ...createImageDto,
      accountId,
    });

    return this.accountImageRepository.save(accountImage);
  }

  async deleteAccountImage(imageId: number, userId: string): Promise<void> {
    const image = await this.accountImageRepository.findOne({
      where: { id: imageId },
      relations: ['account'],
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (image.account.userId !== userId) {
      throw new ForbiddenException('Access denied to this image');
    }

    // Delete the file from filesystem
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'uploads', 'account-images', image.filePath);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('Failed to delete image file:', error);
    }

    await this.accountImageRepository.remove(image);
  }

  async updateImageOrder(imageId: number, newOrder: number, userId: string): Promise<AccountImage> {
    const image = await this.accountImageRepository.findOne({
      where: { id: imageId },
      relations: ['account'],
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (image.account.userId !== userId) {
      throw new ForbiddenException('Access denied to this image');
    }

    image.displayOrder = newOrder;
    return this.accountImageRepository.save(image);
  }
}

