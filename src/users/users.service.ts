import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { CreateIgAccountDto } from '../ig-accounts/dto/create-ig-account.dto';
import { UpdateIgAccountDto } from '../ig-accounts/dto/update-ig-account.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PostingSchedule, ScheduleStatus } from '../schedules/posting-schedule.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(PostingSchedule)
    private postingScheduleRepository: Repository<PostingSchedule>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt'],
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { id },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt'],
    });
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { id },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { email },
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    const updateData: any = { ...updateUserDto };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    await this.userRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  async getProfile(id: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { id },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
    });
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, updateData);
    return this.findById(id);
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  // IG Account CRUD Operations
  async createIgAccount(userId: string, createIgAccountDto: CreateIgAccountDto): Promise<IgAccount> {
    const igAccount = this.igAccountRepository.create({
      userId,
      ...createIgAccountDto,
    });
    return this.igAccountRepository.save(igAccount);
  }

  async findIgAccountsByUserId(userId: string): Promise<IgAccount[]> {
    const accounts = await this.igAccountRepository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    // Add schedule information to each account
    for (const account of accounts) {
      const activeSchedule = await this.postingScheduleRepository.findOne({
        where: { 
          accountId: account.id,
          isEnabled: true,
          status: ScheduleStatus.ACTIVE
        },
        select: ['id', 'name', 'description', 'status', 'isEnabled'],
        order: { createdAt: 'DESC' }
      });
      
      (account as any).activeSchedule = activeSchedule;
    }

    return accounts;
  }

  async findIgAccountById(id: number): Promise<IgAccount | null> {
    return this.igAccountRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async findIgAccountByIdAndUserId(id: number, userId: string): Promise<IgAccount | null> {
    const account = await this.igAccountRepository.findOne({
      where: { id, userId },
      relations: ['user'],
    });

    if (account) {
      // Add schedule information to the account
      const activeSchedule = await this.postingScheduleRepository.findOne({
        where: { 
          accountId: account.id,
          isEnabled: true,
          status: ScheduleStatus.ACTIVE
        },
        select: ['id', 'name', 'description', 'status', 'isEnabled'],
        order: { createdAt: 'DESC' }
      });
      
      (account as any).activeSchedule = activeSchedule;
    }

    return account;
  }

  async updateIgAccount(id: number, userId: string, updateIgAccountDto: UpdateIgAccountDto): Promise<IgAccount | null> {
    const igAccount = await this.findIgAccountByIdAndUserId(id, userId);
    if (!igAccount) {
      return null;
    }

    await this.igAccountRepository.update(id, {
      ...updateIgAccountDto,
      type: updateIgAccountDto.type as any // TypeORM update issue workaround
    });
    return this.findIgAccountById(id);
  }

  async deleteIgAccount(id: number, userId: string): Promise<boolean> {
    const igAccount = await this.findIgAccountByIdAndUserId(id, userId);
    if (!igAccount) {
      return false;
    }

    await this.igAccountRepository.delete(id);
    return true;
  }

  async findAllIgAccounts(): Promise<IgAccount[]> {
    return this.igAccountRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
