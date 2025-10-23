import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { PostingSchedule } from '../schedules/posting-schedule.entity';
import { ScheduleContent } from '../schedules/schedule-content.entity';
import { Content, ContentStatus } from '../content/entities/content.entity';
import { Media } from '../content/media.entity';
import { ScheduleContentStatus } from '../schedules/schedule-content.entity';
import { ImageGenerationAgent } from './agents/image-generation-agent';
import { ReelGenerationAgent } from './agents/reel-generation-agent';
import { LLMService } from './services/llm.service';
import moment from 'moment-timezone';

// Zod schema for AI-generated content with structured ideas
const GeneratedContentSchema = z.object({
  content: z.array(z.object({
    type: z.enum(['post_with_image', 'reel', 'story']),
    caption: z.string().min(10).max(2200),
    hashtags: z.array(z.string()).min(1).max(5),
    contentIdea: z.object({
      title: z.string().min(5).max(100).describe("Title of the content idea"),
      description: z.string().min(20).max(500).describe("Detailed description of the content idea"),
      visualElements: z.array(z.string()).min(3).max(10).describe("Key visual elements to include"),
      style: z.string().min(5).max(50).describe("Visual style and aesthetic"),
      mood: z.string().min(5).max(50).describe("Mood and atmosphere"),
      targetAudience: z.string().min(10).max(100).describe("Target audience for this content"),
    }).describe("Structured content idea for media generation"),
    priority: z.number().min(1).max(10),
    notes: z.string().optional(),
  }))
});

type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

@Injectable()
export class ContentGeneratorService {
  private contentPrompt: PromptTemplate;

  constructor(
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(PostingSchedule)
    private postingScheduleRepository: Repository<PostingSchedule>,
    @InjectRepository(ScheduleContent)
    private scheduleContentRepository: Repository<ScheduleContent>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private imageGenerationAgent: ImageGenerationAgent,
    private reelGenerationAgent: ReelGenerationAgent,
    private llmService: LLMService,
  ) {
    this.initializePrompt();
  }

  private initializePrompt() {
    this.contentPrompt = PromptTemplate.fromTemplate(`
You are an expert Instagram content creator and social media strategist. Generate engaging, trend-aware content for the specified Instagram account.

## Account Information
- Account Name: {accountName}
- Account Type: {accountType}
- Description: {accountDescription}
- Tone: {accountTone}
- Target Audience: {targetAudience}

## Schedule Information
- Schedule Name: {scheduleName}
- Frequency: {frequency}
- Content Types: {contentTypes}
- Time Slots: {timeSlots}
- Time Slot Details: {timeSlotDetails}

## Current Context
- Current Date: {currentDate}
- Generation Week: {generationWeek}
- Trending Topics: {trendingTopics}

## Content Requirements
Generate content for the upcoming week ({generationWeek}) based on:

1. **Account Brand Voice**: Match the account's tone and style
2. **Content Mix**: Balance the required content types (posts, reels, stories)
3. **Optimal Timing**: Use the provided time slots for best engagement
4. **Trend Integration**: Incorporate current trends relevant to the account
5. **Hashtag Strategy**: Include relevant, trending hashtags
6. **Time Slot Customization**: Use specific tone, dimensions, voice accent, and reel duration for each time slot
6. **Engagement Focus**: Create content that encourages interaction

## Hard Requirements (must follow):
1. Generate exactly {contentCount} pieces of content for the week
2. Each content must have:
   - type ∈ (post_with_image, reel, story)
   - caption: 10-2200 characters, engaging and brand-appropriate
   - hashtags: 1-5 relevant hashtags, mix of trending and niche
   - contentIdea: Structured content idea with:
     - title: Catchy title (5-100 chars)
     - description: Detailed description for media generation (20-500 chars)
     - visualElements: Key visual elements to include (3-10 items)
     - style: Visual style and aesthetic (5-50 chars)
     - mood: Mood and atmosphere (5-50 chars)
     - targetAudience: Specific target audience (10-100 chars)
   - priority: 1-10 (higher = more important)
   - notes: Optional strategy notes

3. Content should be diverse and engaging
4. Captions should include call-to-actions
5. Hashtags should be relevant and trending
6. Image/video prompts should be detailed for AI generation

## Trending Topics to Consider:
{trendingTopics}

## User Instructions:
{userInstructions}

Generate content that feels authentic, engaging, and perfectly aligned with the account's brand and current trends.
    `);
  }

  async generateContentForSchedule(
    scheduleId: number,
    userId: string,
    generationWeek: string,
    userInstructions?: string
  ): Promise<{ message: string; generatedContent: any[] }> {
    try {
      // 1. Get schedule and account details
      const schedule = await this.getScheduleWithAccount(scheduleId, userId);
      if (!schedule) {
        throw new HttpException('Schedule not found', HttpStatus.NOT_FOUND);
      }

      // 2. Get existing content for the generation week
      const existingContent = await this.getExistingContentForWeek(scheduleId, generationWeek);

      // 3. Calculate how many content pieces to generate
      const contentCount = this.calculateContentCount(schedule, existingContent);

      if (contentCount === 0) {
        return {
          message: 'No content generation needed for this week',
          generatedContent: []
        };
      }

      // 4. Use account topics for content generation
      const trendingTopics = schedule.account.topics ? schedule.account.topics.split(',').map(t => t.trim()) : ['lifestyle', 'wellness', 'motivation'];

      // 5. Generate content using AI
      const generatedContent = await this.generateContentWithAI(
        schedule,
        generationWeek,
        contentCount,
        trendingTopics,
        userInstructions
      );

      // 6. Save generated content to database
      const savedContent = await this.saveGeneratedContent(
        generatedContent,
        schedule,
        userId,
        generationWeek
      );

      return {
        message: `Successfully generated ${savedContent.length} content pieces`,
        generatedContent: savedContent
      };

    } catch (error) {
      console.error('Error generating content:', error);
      throw new HttpException(
        error.message || 'Failed to generate content',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async getScheduleWithAccount(scheduleId: number, userId: string) {
    return await this.postingScheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.account', 'account')
      .leftJoinAndSelect('schedule.timeSlots', 'timeSlots')
      .where('schedule.id = :scheduleId', { scheduleId })
      .andWhere('account.userId = :userId', { userId })
      .getOne();
  }

  private async getExistingContentForWeek(scheduleId: number, generationWeek: string) {
    const startDate = new Date(generationWeek);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // Week duration

    return await this.scheduleContentRepository
      .createQueryBuilder('scheduleContent')
      .leftJoinAndSelect('scheduleContent.content', 'content')
      .where('scheduleContent.scheduleId = :scheduleId', { scheduleId })
      .andWhere('scheduleContent.scheduledDate >= :startDate', { startDate })
      .andWhere('scheduleContent.scheduledDate <= :endDate', { endDate })
      .getMany();
  }

  private calculateContentCount(schedule: any, existingContent: any[]): number {
    // Calculate based on time slots and existing content
    // Each time slot represents one content piece per week
    const totalRequired = schedule.timeSlots.length;

    return Math.max(0, totalRequired - existingContent.length);
  }


  private async generateContentWithAI(
    schedule: any,
    generationWeek: string,
    contentCount: number,
    trendingTopics: string[],
    userInstructions?: string
  ): Promise<any[]> {
    const prompt = await this.contentPrompt.format({
      accountName: schedule.account.name,
      accountType: schedule.account.type,
      accountDescription: schedule.account.description || 'No description provided',
      accountTone: schedule.account.tone || 'professional',
      targetAudience: schedule.account.targetAudience || 'general audience',
      scheduleName: schedule.name,
      frequency: schedule.frequency,
      contentTypes: schedule.timeSlots.map((ts: any) => ts.postType).join(', '),
      timeSlots: schedule.timeSlots.map((ts: any) => 
        `${ts.label || 'Slot'}: ${ts.startTime}-${ts.endTime}`
      ).join(', '),
      timeSlotDetails: schedule.timeSlots.map((ts: any) => 
        `${ts.label || 'Slot'}: ${ts.postType} | Tone: ${ts.tone || 'default'} | Dimensions: ${ts.dimensions || 'default'} | Voice: ${ts.preferredVoiceAccent || 'american'} | Duration: ${ts.reelDuration || 'default'}s`
      ).join(', '),
      currentDate: new Date().toISOString().split('T')[0],
      generationWeek,
      trendingTopics: trendingTopics.join(', '),
      contentCount,
      userInstructions: userInstructions || 'No specific instructions provided. Generate content based on the account\'s brand and current trends.'
    });

    // Using simpler approach to avoid deep type instantiation
    const llm = this.llmService.getContentLLM();
    const response = await llm.withStructuredOutput(GeneratedContentSchema as any).invoke(prompt);
    return response.content;
  }

  private async saveGeneratedContent(
    generatedContent: any[],
    schedule: any,
    userId: string,
    generationWeek: string
  ): Promise<any[]> {
    const savedContent: any[] = [];
    const weekStart = moment(generationWeek).startOf('week');
    const weekEnd = weekStart.clone().endOf('week');
    const currentDate = moment();

    // Get available time slots for this week
    const availableTimeSlots = schedule.timeSlots.filter((timeSlot: any) => {
      if (!timeSlot.isEnabled) return false;
      
      // Calculate the date for this time slot in the generation week
      const postDate = weekStart.clone().add(timeSlot.dayOfWeek, 'days');
      
      // Skip if post date is outside the week boundaries
      if (postDate.isBefore(weekStart) || postDate.isAfter(weekEnd)) {
        return false;
      }
      
      // Skip if this is the current week and the time slot has already passed
      if (weekStart.isSame(currentDate.startOf('week')) && postDate.isBefore(currentDate, 'day')) {
        return false;
      }
      
      return true;
    });

    for (let i = 0; i < generatedContent.length && i < availableTimeSlots.length; i++) {
      const contentData = generatedContent[i];
      const timeSlot = availableTimeSlots[i];
      
      // Calculate the actual publish date based on generation week and time slot
      const postDate = weekStart.clone().add(timeSlot.dayOfWeek, 'days');
      const publishDate = postDate.format('YYYY-MM-DD');
      const publishTime = timeSlot.startTime;
      
      console.log(`📅 Content Agent Debug: Calculating publish date for time slot ${timeSlot.id}`);
      console.log(`📅 - Generation week: ${generationWeek}`);
      console.log(`📅 - Week start: ${weekStart.format('YYYY-MM-DD')}`);
      console.log(`📅 - Time slot day of week: ${timeSlot.dayOfWeek}`);
      console.log(`📅 - Calculated post date: ${postDate.format('YYYY-MM-DD')}`);
      console.log(`📅 - Publish date: ${publishDate}`);
      console.log(`📅 - Publish time: ${publishTime}`);
      
      // Validate the calculated date
      if (!postDate.isValid() || publishDate.includes('NaN') || publishDate.includes('Invalid')) {
        console.error(`❌ Invalid date calculated: ${publishDate} for time slot ${timeSlot.id}`);
        continue;
      }

      // Create content record first
      const content = this.contentRepository.create({
        accountId: schedule.accountId,
        caption: contentData.caption,
        type: contentData.type,
        status: ContentStatus.PENDING,
        generatedSource: 'ai_agent_with_media',
        hashTags: contentData.hashtags,
        usedTopics: contentData.contentIdea.description,
        tone: schedule.account.tone || 'professional',
        // Set duration based on content type and time slot
        desiredDuration: contentData.type === 'story' 
          ? (timeSlot.reelDuration || 15) // Stories: 15s default
          : contentData.type === 'reel' 
          ? (timeSlot.reelDuration || 16) // Reels: 16s default
          : 8, // Posts: 8s default
        isExtendedVideo: (contentData.type === 'reel' || contentData.type === 'story'),
      });

      const savedContentRecord = await this.contentRepository.save(content);

      // Try to generate media
      let mediaResult: any = null;
      let mediaError: string | null = null;

      try {
        const timeSlotForMedia = {
          id: timeSlot.id,
          label: timeSlot.label || 'Generated Content',
          startTime: publishTime,
          endTime: timeSlot.endTime,
          postType: contentData.type,
          scheduleId: schedule.id,
          schedule: schedule,
          dayOfWeek: timeSlot.dayOfWeek,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;

        switch (contentData.type) {
          case 'post_with_image':
            mediaResult = await this.imageGenerationAgent.generateContent(
              schedule.account,
              schedule,
              timeSlotForMedia,
              publishDate,
              contentData.contentIdea,
              contentData.caption,
              contentData.hashtags
            );
            break;
          case 'reel':
            // Pass contentId to enable extended video generation
            mediaResult = await this.reelGenerationAgent.generateContent(
              schedule.account,
              schedule,
              timeSlotForMedia,
              publishDate,
              contentData.contentIdea,
              contentData.caption,
              contentData.hashtags,
              savedContentRecord.id,  // Pass contentId for 30s video generation
              'reel'  // Pass content type for reel-specific concatenation
            );
            break;
          case 'story':
            // Check story type to determine generation path
            if (timeSlotForMedia.storyType === 'image') {
              // Generate static image story
              console.log(`📸 Generating image story for content ${savedContentRecord.id}`);
              mediaResult = await this.imageGenerationAgent.generateContent(
                schedule.account,
                schedule,
                timeSlotForMedia,
                publishDate,
                contentData.contentIdea,
                contentData.caption,
                contentData.hashtags
              );
            } else {
              // Generate video story (existing behavior)
              console.log(`🎬 Generating video story for content ${savedContentRecord.id}`);
              mediaResult = await this.reelGenerationAgent.generateContent(
                schedule.account,
                schedule,
                timeSlotForMedia,
                publishDate,
                contentData.contentIdea,
                contentData.caption,
                contentData.hashtags,
                savedContentRecord.id,  // Pass contentId for 30s video generation
                'story'  // Pass content type for story-specific concatenation
              );
            }
            break;
          default:
            console.warn(`Unknown content type: ${contentData.type}`);
        }

        // Update media record with contentId if media was generated
        if (mediaResult && mediaResult.mediaPath) {
          const mediaRecord = await this.mediaRepository.findOne({
            where: { filePath: mediaResult.mediaPath }
          });
          
          if (mediaRecord) {
            mediaRecord.contentId = savedContentRecord.id;
            await this.mediaRepository.save(mediaRecord);
          }
        }

      } catch (error) {
        console.error(`❌ Error generating media for content type ${contentData.type}:`, error);
        console.error(`❌ Error stack:`, error.stack);
        console.error(`❌ Full error details:`, JSON.stringify(error, null, 2));
        mediaError = error.message;
        
        // Only re-throw for critical video generation failures, not cleanup errors
        if (contentData.type === 'reel' || contentData.type === 'story') {
          // Check if this is a cleanup error (non-critical)
          const isCleanupError = error.message.includes('Failed to delete segments from GCS') || 
                                error.message.includes('storage.objects.list access') ||
                                error.message.includes('Permission') ||
                                error.message.includes('cleanup');
          
          if (isCleanupError) {
            console.warn(`⚠️  Non-critical cleanup error for video generation - video was generated successfully`);
            console.warn(`⚠️  Error details: ${error.message}`);
            // Don't re-throw cleanup errors - video generation was successful
          } else {
            // Re-throw only critical errors (actual video generation failures)
            throw new Error(`Video generation failed: ${error.message}`);
          }
        }
      }

      // Create schedule content record
      const scheduleContent = this.scheduleContentRepository.create({
        scheduleId: schedule.id,
        contentId: savedContentRecord.id,
        timeSlotId: timeSlot.id,
        scheduledDate: new Date(publishDate),
        scheduledTime: publishTime,
        status: ScheduleContentStatus.SCHEDULED,
        priority: contentData.priority,
        notes: contentData.notes,
      });

      const savedScheduleContent = await this.scheduleContentRepository.save(scheduleContent);

      // Add to saved content with media info or error
      savedContent.push({
        id: savedContentRecord.id,
        caption: savedContentRecord.caption,
        type: savedContentRecord.type,
        status: savedContentRecord.status,
        mediaPath: mediaResult?.mediaPath || null,
        contentIdea: contentData.contentIdea,
        scheduleContent: savedScheduleContent,
        ...(mediaError && { error: `Media generation failed: ${mediaError}` })
      });
    }

    return savedContent;
  }

  async getNextGeneratableWeek(scheduleId: number, userId: string): Promise<string | null> {
    try {
      const schedule = await this.getScheduleWithAccount(scheduleId, userId);
      if (!schedule) {
        throw new HttpException('Schedule not found', HttpStatus.NOT_FOUND);
      }

      const currentDate = new Date();
      const startDate = schedule.startDate ? new Date(schedule.startDate) : currentDate;
      const endDate = schedule.endDate ? new Date(schedule.endDate) : new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Find the next week that needs content generation
      const nextWeek = this.findNextWeekNeedingContent(scheduleId, startDate, endDate);
      
      return nextWeek;
    } catch (error) {
      console.error('Error finding next generatable week:', error);
      throw new HttpException(
        error.message || 'Failed to find next generatable week',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async findNextWeekNeedingContent(
    scheduleId: number,
    startDate: Date,
    endDate: Date
  ): Promise<string | null> {
    const currentDate = new Date();
    let checkDate = new Date(Math.max(currentDate.getTime(), startDate.getTime()));

    while (checkDate <= endDate) {
      const weekStart = new Date(checkDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End of week (Saturday)

      // Check if this week needs content
      const existingContent = await this.getExistingContentForWeek(scheduleId, weekStart.toISOString().split('T')[0]);
      
      if (existingContent.length === 0) {
        return weekStart.toISOString().split('T')[0];
      }

      // Move to next week
      checkDate.setDate(checkDate.getDate() + 7);
    }

    return null; // No week found that needs content
  }
}
