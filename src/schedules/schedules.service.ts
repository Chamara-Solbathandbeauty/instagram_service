import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostingSchedule } from './posting-schedule.entity';
import { ScheduleTimeSlot } from './schedule-time-slot.entity';
import { CreatePostingScheduleDto } from './dto/create-posting-schedule.dto';
import { UpdatePostingScheduleDto } from './dto/update-posting-schedule.dto';
import { ScheduleFilterDto } from './dto/schedule-filter.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(PostingSchedule)
    private scheduleRepository: Repository<PostingSchedule>,
    @InjectRepository(ScheduleTimeSlot)
    private timeSlotRepository: Repository<ScheduleTimeSlot>,
  ) {}

  private normalizeTimeFormat(time: string): string {
    // Convert "HH:MM" to "HH:MM:SS" format
    if (time.match(/^\d{1,2}:\d{2}$/)) {
      return `${time}:00`;
    }
    return time;
  }

  async create(userId: string, createScheduleDto: CreatePostingScheduleDto): Promise<PostingSchedule> {
    return this.createSchedule(userId, createScheduleDto);
  }

  async createSchedule(userId: string, createScheduleDto: CreatePostingScheduleDto): Promise<PostingSchedule> {
    // Verify that the account belongs to the user
    const accountExists = await this.scheduleRepository.query(
      'SELECT id FROM ig_accounts WHERE id = $1 AND "userId" = $2',
      [createScheduleDto.accountId, userId]
    );

    if (!accountExists || accountExists.length === 0) {
      throw new BadRequestException('Account not found or access denied');
    }

    const { timeSlots, ...scheduleData } = createScheduleDto;

    // Create the main schedule
    const schedule = this.scheduleRepository.create(scheduleData);
    const savedSchedule = await this.scheduleRepository.save(schedule);

    // Create time slots if provided
    if (timeSlots && timeSlots.length > 0) {
      const scheduleTimeSlots = timeSlots.map(slotData => 
        this.timeSlotRepository.create({
          ...slotData,
          startTime: this.normalizeTimeFormat(slotData.startTime),
          endTime: this.normalizeTimeFormat(slotData.endTime),
          scheduleId: savedSchedule.id,
        })
      );
      await this.timeSlotRepository.save(scheduleTimeSlots);
    }

    return this.getScheduleById(savedSchedule.id);
  }

  async getSchedules(userId: string, filters: ScheduleFilterDto = {}): Promise<{ schedules: PostingSchedule[]; total: number }> {
    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.account', 'account')
      .leftJoinAndSelect('schedule.timeSlots', 'timeSlots')
      .where('account.userId = :userId', { userId });

    if (filters.accountId) {
      queryBuilder.andWhere('schedule.accountId = :accountId', { accountId: filters.accountId });
    }

    if (filters.status) {
      queryBuilder.andWhere('schedule.status = :status', { status: filters.status });
    }

    if (filters.isEnabled !== undefined) {
      queryBuilder.andWhere('schedule.isEnabled = :isEnabled', { isEnabled: filters.isEnabled });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);
    queryBuilder.orderBy('schedule.createdAt', 'DESC');

    const [schedules, total] = await queryBuilder.getManyAndCount();

    return { schedules, total };
  }

  async findOne(scheduleId: number, userId: string): Promise<PostingSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
      relations: ['account', 'timeSlots'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Verify ownership
    if (schedule.account.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    return schedule;
  }

  async getScheduleById(id: number): Promise<PostingSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['account', 'timeSlots'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async updateSchedule(id: number, userId: string, updateScheduleDto: UpdatePostingScheduleDto): Promise<PostingSchedule> {
    const schedule = await this.getScheduleById(id);

    // Verify ownership
    if (schedule.account.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    const { timeSlots, ...scheduleData } = updateScheduleDto;

    // Update main schedule
    Object.assign(schedule, scheduleData);
    await this.scheduleRepository.save(schedule);

    // Update time slots if provided
    if (timeSlots) {
      // Delete existing time slots
      await this.timeSlotRepository.delete({ scheduleId: id });
      
      // Create new time slots
      if (timeSlots.length > 0) {
        const scheduleTimeSlots = timeSlots.map(slotData => 
          this.timeSlotRepository.create({
            ...slotData,
            startTime: this.normalizeTimeFormat(slotData.startTime),
            endTime: this.normalizeTimeFormat(slotData.endTime),
            scheduleId: id,
          })
        );
        await this.timeSlotRepository.save(scheduleTimeSlots);
      }
    }

    return this.getScheduleById(id);
  }

  async deleteSchedule(id: number, userId: string): Promise<void> {
    const schedule = await this.getScheduleById(id);

    // Verify ownership
    if (schedule.account.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    await this.scheduleRepository.delete(id);
  }

  async toggleScheduleStatus(id: number, userId: string): Promise<PostingSchedule> {
    const schedule = await this.getScheduleById(id);

    // Verify ownership
    if (schedule.account.userId !== userId) {
      throw new BadRequestException('Access denied');
    }

    schedule.isEnabled = !schedule.isEnabled;
    await this.scheduleRepository.save(schedule);

    return this.getScheduleById(id);
  }

  async getSchedulesByAccount(accountId: number, userId: string): Promise<PostingSchedule[]> {
    // Verify account ownership
    const accountExists = await this.scheduleRepository.query(
      'SELECT id FROM ig_accounts WHERE id = $1 AND "userId" = $2',
      [accountId, userId]
    );

    if (!accountExists || accountExists.length === 0) {
      throw new BadRequestException('Account not found or access denied');
    }

    return this.scheduleRepository.find({
      where: { accountId },
      relations: ['timeSlots'],
      order: { createdAt: 'DESC' },
    });
  }
}
