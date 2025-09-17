import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulesService } from './schedules.service';
import { PostingSchedule } from './posting-schedule.entity';
import { ScheduleRule } from './schedule-rule.entity';
import { ScheduleTimeSlot } from './schedule-time-slot.entity';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let scheduleRepository: Repository<PostingSchedule>;
  let ruleRepository: Repository<ScheduleRule>;
  let timeSlotRepository: Repository<ScheduleTimeSlot>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: getRepositoryToken(PostingSchedule),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            query: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ScheduleRule),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ScheduleTimeSlot),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    scheduleRepository = module.get<Repository<PostingSchedule>>(getRepositoryToken(PostingSchedule));
    ruleRepository = module.get<Repository<ScheduleRule>>(getRepositoryToken(ScheduleRule));
    timeSlotRepository = module.get<Repository<ScheduleTimeSlot>>(getRepositoryToken(ScheduleTimeSlot));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('time format normalization', () => {
    it('should normalize HH:MM format to HH:MM:SS', () => {
      // Access the private method for testing
      const normalizeTimeFormat = (service as any).normalizeTimeFormat;
      
      expect(normalizeTimeFormat('09:00')).toBe('09:00:00');
      expect(normalizeTimeFormat('17:30')).toBe('17:30:00');
      expect(normalizeTimeFormat('9:05')).toBe('9:05:00');
    });

    it('should leave HH:MM:SS format unchanged', () => {
      const normalizeTimeFormat = (service as any).normalizeTimeFormat;
      
      expect(normalizeTimeFormat('09:00:00')).toBe('09:00:00');
      expect(normalizeTimeFormat('17:30:45')).toBe('17:30:45');
    });

    it('should handle edge cases', () => {
      const normalizeTimeFormat = (service as any).normalizeTimeFormat;
      
      expect(normalizeTimeFormat('00:00')).toBe('00:00:00');
      expect(normalizeTimeFormat('23:59')).toBe('23:59:00');
    });
  });
});
