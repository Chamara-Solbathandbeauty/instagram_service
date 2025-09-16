import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { PromptTemplate } from '@langchain/core/prompts';
import { VertexAI } from '@google-cloud/vertexai';
import * as fs from 'fs';
import * as path from 'path';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { SchedulesService } from '../schedules/schedules.service';
import { ContentService } from '../content/content.service';
import { CreateScheduleDto } from '../schedules/dto/create-schedule.dto';
import { CreateContentDto } from '../content/dto/create-content.dto';
import { ContentType } from '../content/entities/content.entity';
import { PostType } from '../schedules/entities/time-slot.entity';
import { z } from 'zod';
import moment from 'moment-timezone';

// Zod schemas for structured output
const TimeSlotSchema = z.object({
  startTime: z.string().describe('Start time in HH:MM format'),
  endTime: z.string().describe('End time in HH:MM format'),
  dayOfWeek: z.number().min(0).max(6).describe('Day of week (0=Sunday, 1=Monday, etc.)'),
  postType: z.enum(['REEL', 'STORY', 'POST_WITH_IMAGE']).describe('Type of content to post'),
  label: z.string().describe('Descriptive label explaining the purpose and timing'),
  isEnabled: z.boolean().describe('Whether this time slot is enabled'),
});

const ScheduleSchema = z.object({
  name: z.string().describe('Strategic schedule name based on account analysis and current date'),
  description: z.string().describe('Detailed strategy explanation including timing rationale and content type strategy'),
  frequency: z.literal('weekly').describe('Schedule frequency'),
  status: z.literal('active').describe('Schedule status'),
  isEnabled: z.boolean().describe('Whether the schedule is enabled'),
  startDate: z.string().describe('Start date for the schedule in YYYY-MM-DD format'),
  endDate: z.string().describe('End date for the schedule in YYYY-MM-DD format'),
  timezone: z.string().describe('Timezone for the schedule (e.g., UTC, Asia/Colombo, America/New_York)'),
  timeSlots: z.array(TimeSlotSchema).describe('Array of time slots for the week'),
});

type ScheduleOutput = z.infer<typeof ScheduleSchema>;

// Zod schema for content generation
const ContentGenerationSchema = z.object({
  caption: z.string().describe('Engaging Instagram caption (max 2200 characters)'),
  hashTags: z.array(z.string()).describe('Array of relevant hashtags (10-15 hashtags)'),
  usedTopics: z.string().describe('Topic focus for this post'),
  tone: z.string().describe('Content tone matching the account'),
  mediaDescription: z.string().describe('Detailed description of the image/video content to be generated'),
  mediaStyle: z.string().describe('Visual style and aesthetic for the media (e.g., modern, minimalist, vibrant, professional)'),
  mediaElements: z.array(z.string()).describe('Key visual elements to include in the media'),
});

type ContentGenerationOutput = z.infer<typeof ContentGenerationSchema>;

@Injectable()
export class AiService {
  private geminiModel: ChatGoogleGenerativeAI;
  private vertexAIModel: ChatVertexAI;
  private vertexAI: VertexAI;

  constructor(
    private configService: ConfigService,
    private igAccountsService: IgAccountsService,
    private schedulesService: SchedulesService,
    private contentService: ContentService,
  ) {
    this.initializeGemini();
    this.initializeVertexAI();
    this.initializeVertexAIMedia();
  }

  private initializeGemini() {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    
    if (apiKey) {
      this.geminiModel = new ChatGoogleGenerativeAI({
        model: 'gemini-1.5-flash',
        apiKey: apiKey,
        temperature: 0.7,
        maxOutputTokens: 4096,
      });
    }
  }

  private initializeVertexAI() {
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT');
    
    if (projectId) {
      this.vertexAIModel = new ChatVertexAI({
        model: 'gemini-1.5-flash-001',
        temperature: 0.7,
        maxOutputTokens: 4096,
        location: 'us-central1',
        authOptions: {
          projectId: projectId,
        },
      });
    }
  }

  private initializeVertexAIMedia() {
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT');
    
    if (projectId) {
      this.vertexAI = new VertexAI({
        project: projectId,
        location: 'us-central1',
      });
    }
  }

  async generateSchedule(accountId: number, userId: number): Promise<CreateScheduleDto> {
    const account = await this.igAccountsService.findOne(accountId, userId);
    
    // Only use AI-generated schedules - no fallbacks
    return await this.generateIntelligentSchedule(accountId, account);
  }

  private async generateIntelligentSchedule(accountId: number, account: any): Promise<CreateScheduleDto> {
    // Get current date and time for context
    const now = moment();
    const startDate = now.format('YYYY-MM-DD');
    const endDate = now.clone().add(1, 'month').format('YYYY-MM-DD');
    const currentTime = now.format('YYYY-MM-DD HH:mm:ss');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dayOfWeek = now.day(); // 0 = Sunday, 1 = Monday, etc.

    const prompt = PromptTemplate.fromTemplate(`
      You are an expert Instagram marketing strategist and social media algorithm specialist with deep knowledge of engagement patterns, optimal posting times, and content strategy.

      CURRENT CONTEXT & TIMING:
      - Today's Date: {currentDate}
      - Current Time: {currentTime}
      - Current Day of Week: {dayOfWeek}
      - Timezone: {timezone}
      - Schedule Period: {startDate} to {endDate} (1 month duration)
      - Schedule Type: Weekly recurring schedule

      ACCOUNT ANALYSIS:
      - Account Name: {accountName}
      - Account Type: {accountType}
      - Description: {description}
      - Topics/Keywords: {topics}
      - Brand Tone: {tone}

      YOUR EXPERT TASK:
      Create a data-driven, strategic Instagram posting schedule that maximizes engagement, reach, and growth based on current best practices and algorithm optimization.

      STRATEGIC CONSIDERATIONS:
      1. OPTIMAL TIMING: Use current date/time context to determine the best posting schedule starting from today
      2. ACCOUNT TYPE STRATEGY: 
         - Business: Professional hours (9AM-5PM), educational content, B2B engagement
         - Creator: Peak engagement times (6PM-9PM), personal content, community building
         - Personal: Flexible timing, authentic moments, lifestyle content
      3. CONTENT TYPE OPTIMIZATION:
         - REEL: Best for reach and discovery (post during peak hours 6-9PM)
         - POST_WITH_IMAGE: Best for engagement and saves (post during business hours 9AM-5PM)
         - STORY: Best for connection and real-time engagement (post throughout the day)
      4. TOPIC-SPECIFIC TIMING:
         - Fitness/Wellness: Morning motivation (6-8AM), evening workouts (6-8PM)
         - Food: Meal times (8AM breakfast, 12PM lunch, 6PM dinner)
         - Fashion: Evening showcase (7-9PM), morning outfit inspiration (8-10AM)
         - Business/Education: Professional hours (9AM-5PM)
         - Entertainment: Evening hours (7-10PM)
      5. WEEKLY DISTRIBUTION: Spread posts across different days for consistent presence
      6. ENGAGEMENT OPTIMIZATION: Consider when your target audience is most active

      REQUIREMENTS:
      - Create 4-6 strategic time slots per week
      - Mix content types based on optimal performance (40% REEL, 40% POST_WITH_IMAGE, 20% STORY)
      - Use data-driven timing for maximum engagement
      - Include descriptive labels that explain the strategic purpose
      - Ensure posts are distributed across different days
      - Consider the current date context for immediate relevance
      - MANDATORY: Include startDate and endDate fields in YYYY-MM-DD format
      - MANDATORY: Use the provided startDate and endDate values exactly as given

      RESPOND WITH ONLY VALID JSON (no markdown, no explanations, no additional text):
      {{
        "name": "Strategic schedule name based on account analysis and current date",
        "description": "Detailed strategy explanation including timing rationale and content type strategy",
        "frequency": "weekly",
        "status": "active",
        "isEnabled": true,
        "startDate": "{startDate}",
        "endDate": "{endDate}",
        "timezone": "{timezone}",
        "timeSlots": [
          {{
            "startTime": "HH:MM",
            "endTime": "HH:MM",
            "dayOfWeek": 0,
            "postType": "REEL",
            "label": "Strategic label explaining the purpose and timing",
            "isEnabled": true
          }}
        ]
      }}
    `);

    // Ensure AI model is available
    if (!this.geminiModel) {
      throw new Error('AI model not configured. Please set up GOOGLE_API_KEY environment variable.');
    }

    // Create the chain with prompt and model
    const chain = prompt.pipe(this.geminiModel);

    const result = await chain.invoke({
      currentDate: startDate,
      currentTime: currentTime,
      dayOfWeek: dayOfWeek,
      timezone: timezone,
      startDate: startDate,
      endDate: endDate,
      accountName: account.name || 'Instagram Account',
      accountType: account.type || 'business',
      description: account.description || 'Professional Instagram account',
      topics: account.topics || 'General business content',
      tone: account.tone || 'Professional and engaging',
    });

    // Extract and parse the JSON response
    const responseText = result.content as string;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('AI response does not contain valid JSON format');
    }

    const scheduleData = JSON.parse(jsonMatch[0]);
    
    // Validate the data structure using Zod
    const validatedData = ScheduleSchema.parse(scheduleData);

    return {
      accountId,
      name: validatedData.name,
      description: validatedData.description,
      frequency: validatedData.frequency as any,
      status: validatedData.status as any,
      isEnabled: validatedData.isEnabled,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      timezone: validatedData.timezone,
      timeSlots: validatedData.timeSlots.map((slot) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        dayOfWeek: slot.dayOfWeek,
        postType: this.mapStringToPostType(slot.postType),
        label: slot.label,
        isEnabled: slot.isEnabled,
      })),
    };
  }

  private mapStringToPostType(type: string): PostType {
    switch (type.toUpperCase()) {
      case 'REEL':
        return PostType.REEL;
      case 'STORY':
        return PostType.STORY;
      case 'POST_WITH_IMAGE':
      default:
        return PostType.POST_WITH_IMAGE;
    }
  }




  async generateSchedulePost(data: { accountId: number }, userId: number) {
    const scheduleData = await this.generateSchedule(data.accountId, userId);
    return this.schedulesService.create(userId, scheduleData);
  }

  private createMediaPrompt(
    mediaDescription: string,
    mediaStyle: string,
    mediaElements: string[],
    postType: PostType,
    account: any
  ): string {
    const elementsText = mediaElements.join(', ');
    
    let basePrompt = `Create ${postType === PostType.REEL ? 'a short video' : 'an image'} for Instagram content. `;
    
    basePrompt += `Content Description: ${mediaDescription}. `;
    basePrompt += `Visual Style: ${mediaStyle}. `;
    basePrompt += `Key Elements to Include: ${elementsText}. `;
    basePrompt += `Account Context: ${account.name} - ${account.description || 'Professional Instagram account'}. `;
    basePrompt += `Brand Tone: ${account.tone || 'Professional and engaging'}. `;
    
    if (postType === PostType.REEL) {
      basePrompt += `Video Requirements: Create a dynamic, engaging short video (15-30 seconds) with smooth transitions, modern editing, and high visual appeal. Include text overlays if appropriate. Ensure it's optimized for mobile viewing and Instagram's vertical format.`;
    } else if (postType === PostType.STORY) {
      basePrompt += `Story Requirements: Create a vertical image (9:16 aspect ratio) with bold, readable text overlays. Include interactive elements like polls or questions. Ensure it's eye-catching and designed for mobile viewing.`;
    } else {
      basePrompt += `Post Requirements: Create a high-quality image (1:1 or 4:5 aspect ratio) with professional composition. Include any necessary text overlays or graphics. Ensure it's visually appealing and brand-consistent.`;
    }
    
    return basePrompt;
  }

  private async generateImage(prompt: string, fileName: string): Promise<string> {
    if (!this.vertexAI) {
      throw new Error('Vertex AI not configured for image generation. Please set GOOGLE_CLOUD_PROJECT environment variable and ensure Vertex AI is properly configured.');
    }

    try {
      const model = this.vertexAI.getGenerativeModel({
        model: 'imagegeneration@006',
      });

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: prompt,
          }],
        }],
      });

      const response = result.response;
      const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!imageData) {
        throw new Error('No image data received from Vertex AI');
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageData, 'base64');
      
      // Save image to uploads folder
      const imagePath = path.join(process.cwd(), 'uploads', 'ai_generated', 'images', fileName);
      fs.writeFileSync(imagePath, imageBuffer);
      
      return imagePath;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  private async generateVideo(prompt: string, fileName: string): Promise<string> {
    if (!this.vertexAI) {
      throw new Error('Vertex AI not configured for video generation. Please set GOOGLE_CLOUD_PROJECT environment variable and ensure Vertex AI is properly configured.');
    }

    try {
      const model = this.vertexAI.getGenerativeModel({
        model: 'videogeneration@006',
      });

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: prompt,
          }],
        }],
      });

      const response = result.response;
      const videoData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!videoData) {
        throw new Error('No video data received from Vertex AI');
      }

      // Convert base64 to buffer
      const videoBuffer = Buffer.from(videoData, 'base64');
      
      // Save video to uploads folder
      const videoPath = path.join(process.cwd(), 'uploads', 'ai_generated', 'videos', fileName);
      fs.writeFileSync(videoPath, videoBuffer);
      
      return videoPath;
    } catch (error) {
      console.error('Error generating video:', error);
      throw new Error(`Failed to generate video: ${error.message}`);
    }
  }

  async generateContent(data: { scheduleId: number; generationWeek?: string }, userId: number) {
    const schedule = await this.schedulesService.findOne(data.scheduleId, userId);
    const account = schedule.account;
    
    // Use Vertex AI for content generation if available, otherwise fallback to Gemini
    const aiModel = this.vertexAIModel || this.geminiModel;
    
    if (!aiModel) {
      throw new BadRequestException('AI service not configured. Please set up GOOGLE_CLOUD_PROJECT or GOOGLE_API_KEY environment variable.');
    }

    const generationWeek = data.generationWeek || moment().format('YYYY-MM-DD');
    const weekStart = moment(generationWeek).startOf('week');
    const weekEnd = moment(generationWeek).endOf('week');

    const generatedContent = [];

    for (const timeSlot of schedule.timeSlots) {
      if (!timeSlot.isEnabled) continue;

      // Calculate the date for this time slot in the generation week
      const postDate = weekStart.clone().add(timeSlot.dayOfWeek, 'days');
      
      if (postDate.isBefore(weekStart) || postDate.isAfter(weekEnd)) {
        continue;
      }

      // Create structured prompt for content generation
      const prompt = new PromptTemplate({
        template: `
          CONTENT GENERATION CONTEXT:
          - Current Date: {currentDate}
          - Generation Week: {generationWeek}
          - Post Date: {postDate}
          - Day of Week: {dayOfWeek}
          
          ACCOUNT ANALYSIS:
          - Account Name: {accountName}
          - Account Type: {accountType}
          - Description: {description}
          - Topics/Keywords: {topics}
          - Brand Tone: {tone}
          
          TIME SLOT DETAILS:
          - Content Type: {postType}
          - Time Slot: {timeSlotLabel}
          - Posting Time: {postingTime}
          
          YOUR EXPERT TASK:
          Create engaging, high-quality Instagram content that maximizes engagement and aligns with the account's brand and posting strategy.
          
          CONTENT REQUIREMENTS:
          1. CAPTION: Create a compelling, engaging caption (max 2200 characters) that:
             - Matches the account's tone and brand voice
             - Incorporates relevant topics and keywords
             - Includes a clear call-to-action
             - Is optimized for the specific content type ({postType})
             - Considers the posting time and day context
          
          2. HASHTAGS: Generate 10-15 relevant hashtags that:
             - Are popular but not oversaturated
             - Mix of broad and niche hashtags
             - Include trending and evergreen options
             - Match the content type and account topics
          
          3. TOPIC FOCUS: Identify the primary topic/theme for this post
          
          4. TONE: Ensure the content matches the account's established tone
          
          5. MEDIA DESCRIPTION: Create a detailed description of the visual content:
             - For REEL: Describe the video concept, scenes, transitions, and visual effects
             - For POST_WITH_IMAGE: Describe the image composition, colors, text overlays, and visual elements
             - For STORY: Describe the story format, interactive elements, and visual style
             - Consider the account's brand aesthetic and target audience
          
          6. MEDIA STYLE: Define the visual style and aesthetic:
             - Color palette and mood
             - Typography and design elements
             - Overall visual theme and brand consistency
          
          7. MEDIA ELEMENTS: List key visual elements to include:
             - Specific objects, scenes, or concepts
             - Text overlays or graphics
             - Brand elements or logos
             - Call-to-action visuals
          
          RESPOND WITH ONLY VALID JSON (no markdown, no explanations, no additional text):
          {{
            "caption": "Your engaging caption here...",
            "hashTags": ["hashtag1", "hashtag2", "hashtag3"],
            "usedTopics": "Topic focus for this post",
            "tone": "{tone}",
            "mediaDescription": "Detailed description of the visual content to be generated",
            "mediaStyle": "Visual style and aesthetic (e.g., modern, minimalist, vibrant)",
            "mediaElements": ["element1", "element2", "element3"]
          }}
        `,
        inputVariables: [
          'currentDate', 'generationWeek', 'postDate', 'dayOfWeek',
          'accountName', 'accountType', 'description', 'topics', 'tone',
          'postType', 'timeSlotLabel', 'postingTime'
        ],
      });

      try {
        const chain = prompt.pipe(aiModel);
        const result = await chain.invoke({
          currentDate: moment().format('YYYY-MM-DD'),
          generationWeek: generationWeek,
          postDate: postDate.format('YYYY-MM-DD'),
          dayOfWeek: this.getDayName(timeSlot.dayOfWeek),
          accountName: account.name || 'Instagram Account',
          accountType: account.type || 'business',
          description: account.description || 'Professional Instagram account',
          topics: account.topics || 'General business content',
          tone: account.tone || 'Professional and engaging',
          postType: timeSlot.postType,
          timeSlotLabel: timeSlot.label || `${timeSlot.startTime} ${this.getDayName(timeSlot.dayOfWeek)}`,
          postingTime: `${timeSlot.startTime} - ${timeSlot.endTime}`,
        });

        // Extract and parse the JSON response
        const responseText = result.content as string;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          console.error('Invalid AI response format for time slot:', timeSlot.id);
          continue;
        }

        const contentData = JSON.parse(jsonMatch[0]);
        
        // Validate the data structure using Zod
        const validatedData = ContentGenerationSchema.parse(contentData);
        
        const createContentDto: CreateContentDto = {
          accountId: account.id,
          caption: validatedData.caption,
          hashTags: validatedData.hashTags,
          generatedSource: 'ai_generated',
          usedTopics: validatedData.usedTopics,
          tone: validatedData.tone,
          type: this.convertPostTypeToContentType(timeSlot.postType),
          status: 'generated' as any,
        };

        const content = await this.contentService.create(userId, createContentDto);
        
        // Generate actual media file using Vertex AI
        const mediaType = timeSlot.postType === PostType.REEL ? 'video' : 'image';
        const fileName = `ai_generated_${content.id}_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
        
        // Create media generation prompt
        const mediaPrompt = this.createMediaPrompt(
          validatedData.mediaDescription,
          validatedData.mediaStyle,
          validatedData.mediaElements,
          timeSlot.postType,
          account
        );
        
        let filePath: string;
        let fileSize: number;
        
        try {
          if (mediaType === 'video') {
            filePath = await this.generateVideo(mediaPrompt, fileName);
          } else {
            filePath = await this.generateImage(mediaPrompt, fileName);
          }
          
          // Get file size
          const stats = fs.statSync(filePath);
          fileSize = stats.size;
          
          // Convert absolute path to relative path for database storage
          const relativePath = filePath.replace(process.cwd(), '');
          
          const createMediaDto = {
            fileName: fileName,
            filePath: relativePath,
            fileSize: fileSize,
            mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
            mediaType: mediaType as any,
          };
          
          const media = await this.contentService.addMedia(content.id, userId, createMediaDto);
          
          generatedContent.push({
            content,
            media,
            timeSlot,
            scheduledDate: postDate.format('YYYY-MM-DD'),
            mediaDescription: validatedData.mediaDescription,
            mediaStyle: validatedData.mediaStyle,
            mediaElements: validatedData.mediaElements,
            mediaGenerationStatus: 'success',
          });
          
        } catch (mediaError) {
          console.error('Media generation failed for content:', content.id, mediaError);
          
          // Still create content without media if media generation fails
          generatedContent.push({
            content,
            media: null,
            timeSlot,
            scheduledDate: postDate.format('YYYY-MM-DD'),
            mediaDescription: validatedData.mediaDescription,
            mediaStyle: validatedData.mediaStyle,
            mediaElements: validatedData.mediaElements,
            mediaError: mediaError.message,
            mediaGenerationStatus: 'failed',
          });
        }
      } catch (error) {
        console.error('AI Content Generation Error for time slot:', timeSlot.id, error);
        continue;
      }
    }

    return {
      data: {
        schedule,
        generatedContent,
        week: {
          start: weekStart.format('YYYY-MM-DD'),
          end: weekEnd.format('YYYY-MM-DD'),
        },
      },
    };
  }

  async getNextGeneratableWeek(scheduleId: number, userId: number) {
    const schedule = await this.schedulesService.findOne(scheduleId, userId);
    
    // Get current week or next week
    const currentWeek = moment().startOf('week');
    const nextWeek = currentWeek.clone().add(1, 'week');
    
    return {
      data: {
        currentWeek: currentWeek.format('YYYY-MM-DD'),
        nextWeek: nextWeek.format('YYYY-MM-DD'),
        suggestedWeek: nextWeek.format('YYYY-MM-DD'),
      },
    };
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  private convertPostTypeToContentType(postType: PostType): ContentType {
    // Both enums have the same values, so we can safely cast
    return postType as any as ContentType;
  }
}

