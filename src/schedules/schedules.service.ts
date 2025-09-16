import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule, ScheduleStatus } from './entities/schedule.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private scheduleRepository: Repository<Schedule>,
    @InjectRepository(TimeSlot)
    private timeSlotRepository: Repository<TimeSlot>,
    private igAccountsService: IgAccountsService,
  ) {}

  async create(userId: number, createScheduleDto: CreateScheduleDto): Promise<Schedule> {
    // Verify user owns the account
    await this.igAccountsService.findOne(createScheduleDto.accountId, userId);

    const { timeSlots, ...scheduleData } = createScheduleDto;

    const schedule = this.scheduleRepository.create(scheduleData);
    const savedSchedule = await this.scheduleRepository.save(schedule);

    // Create time slots if provided
    if (timeSlots && timeSlots.length > 0) {
      const timeSlotEntities = timeSlots.map(timeSlot =>
        this.timeSlotRepository.create({
          ...timeSlot,
          scheduleId: savedSchedule.id,
        })
      );
      await this.timeSlotRepository.save(timeSlotEntities);
    }

    return this.findOne(savedSchedule.id, userId);
  }

  async findAll(
    userId: number,
    filters?: {
      accountId?: number;
      status?: ScheduleStatus;
      isEnabled?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.account', 'account')
      .leftJoinAndSelect('schedule.timeSlots', 'timeSlots')
      .where('account.userId = :userId', { userId });

    if (filters?.accountId) {
      queryBuilder.andWhere('schedule.accountId = :accountId', {
        accountId: filters.accountId,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('schedule.status = :status', { status: filters.status });
    }

    if (filters?.isEnabled !== undefined) {
      queryBuilder.andWhere('schedule.isEnabled = :isEnabled', {
        isEnabled: filters.isEnabled,
      });
    }

    queryBuilder
      .orderBy('schedule.createdAt', 'DESC')
      .addOrderBy('timeSlots.dayOfWeek', 'ASC')
      .addOrderBy('timeSlots.startTime', 'ASC');

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [schedules, total] = await queryBuilder.getManyAndCount();

    return {
      data: schedules,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, userId: number): Promise<Schedule> {
    const schedule = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.account', 'account')
      .leftJoinAndSelect('schedule.timeSlots', 'timeSlots')
      .where('schedule.id = :id', { id })
      .andWhere('account.userId = :userId', { userId })
      .orderBy('timeSlots.dayOfWeek', 'ASC')
      .addOrderBy('timeSlots.startTime', 'ASC')
      .getOne();

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async findOneById(id: number): Promise<Schedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['account', 'timeSlots'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async findByAccount(accountId: number, userId: number): Promise<Schedule[]> {
    // Verify user owns the account
    await this.igAccountsService.findOne(accountId, userId);

    return this.scheduleRepository.find({
      where: { accountId },
      relations: ['timeSlots'],
      order: {
        createdAt: 'DESC',
        timeSlots: {
          dayOfWeek: 'ASC',
          startTime: 'ASC',
        },
      },
    });
  }

  async update(
    id: number,
    userId: number,
    updateScheduleDto: UpdateScheduleDto,
  ): Promise<Schedule> {
    const schedule = await this.findOne(id, userId);

    const { timeSlots, accountId, ...scheduleData } = updateScheduleDto as any;

    await this.scheduleRepository.update(id, scheduleData);

    // Update time slots if provided
    if (timeSlots) {
      // Remove existing time slots
      await this.timeSlotRepository.delete({ scheduleId: id });

      // Create new time slots
      if (timeSlots.length > 0) {
        const timeSlotEntities = timeSlots.map(timeSlot =>
          this.timeSlotRepository.create({
            ...timeSlot,
            scheduleId: id,
          })
        );
        await this.timeSlotRepository.save(timeSlotEntities);
      }
    }

    return this.findOne(id, userId);
  }

  async remove(id: number, userId: number): Promise<void> {
    const schedule = await this.findOne(id, userId);
    await this.scheduleRepository.remove(schedule);
  }

  async toggleStatus(id: number, userId: number): Promise<Schedule> {
    const schedule = await this.findOne(id, userId);
    
    const newStatus = schedule.status === ScheduleStatus.ACTIVE 
      ? ScheduleStatus.PAUSED 
      : ScheduleStatus.ACTIVE;

    await this.scheduleRepository.update(id, { status: newStatus });
    return this.findOne(id, userId);
  }

  async findActiveSchedules(): Promise<Schedule[]> {
    return this.scheduleRepository.find({
      where: {
        status: ScheduleStatus.ACTIVE,
        isEnabled: true,
      },
      relations: ['account', 'timeSlots'],
    });
  }
}

