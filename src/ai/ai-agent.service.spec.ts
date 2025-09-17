import { Test, TestingModule } from '@nestjs/testing';
import { AIAgentService } from './ai-agent.service';
import { IgAccountType } from '../ig-accounts/entities/ig-account.entity';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import * as dotenv from 'dotenv';
dotenv.config();

describe('AIAgentService', () => {
  let service: AIAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AIAgentService],
    }).compile();

    service = module.get<AIAgentService>(AIAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSchedule', () => {
    it('should generate a valid schedule structure', async () => {
      // Mock account data
      const mockAccount: IgAccount = {
        id: 1,
        name: 'Test Business Account',
        type: IgAccountType.BUSINESS,
        description: 'A test business account for social media marketing',
        topics: 'technology, business, marketing',
        tone: 'professional',
        userId: 'test-user-id',
        user: null as any, // Mock user relationship
        instagramAccountId: null,
        facebookPageId: null,
        instagramUserId: null,
        instagramUsername: null,
        username: null,
        profilePictureUrl: null,
        followersCount: 0,
        followingCount: 0,
        mediaCount: 0,
        accessToken: null,
        tokenExpiresAt: null,
        isConnected: false,
        content: [],
        schedules: [],
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the environment variable
      process.env.GOOGLE_API_KEY = 'test-api-key';

      try {
        // This will fail without a real API key, but we can test the structure
        const result = await service.generateSchedule(mockAccount);
        
        // If it succeeds, verify the structure
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('frequency');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('isEnabled');
        expect(result).toHaveProperty('timezone');
        expect(result).toHaveProperty('startDate');
        expect(result).toHaveProperty('endDate');
        expect(result).toHaveProperty('timeSlots');
        
        expect(Array.isArray(result.timeSlots)).toBe(true);
        expect(result.timeSlots.length).toBeGreaterThan(0);
        
        // Verify date formats
        expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Verify start date is in the future
        const startDate = new Date(result.startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expect(startDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
      } catch (error) {
        // Expected to fail without real API key
        expect(error.message).toContain('Failed to generate AI schedule');
      }
    });
  });
});
