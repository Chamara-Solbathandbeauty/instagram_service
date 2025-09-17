import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IgAccount } from './entities/ig-account.entity';
import { CreateIgAccountDto } from './dto/create-ig-account.dto';
import { UpdateIgAccountDto } from './dto/update-ig-account.dto';

@Injectable()
export class IgAccountsService {
  constructor(
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
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
}

