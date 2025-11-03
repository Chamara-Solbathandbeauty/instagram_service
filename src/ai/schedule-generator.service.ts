import { Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { AIGeneratedSchedule, AIGeneratedScheduleSchema, scheduleJsonSchema } from './schemas/schedule-schema';
import { LLMService } from './services/llm.service';

@Injectable()
export class ScheduleGeneratorService {
  private schedulePrompt: PromptTemplate;

  constructor(private llmService: LLMService) {

    // Create prompt template for schedule generation
    this.schedulePrompt = PromptTemplate.fromTemplate(`
You are an expert Instagram content strategist. Generate the most effective, realistic posting schedule for the account below.

Account Details:
- Name: {accountName}
- Type: {accountType}  // one of: business | creator
- Description: {accountDescription}
- Topics/Niche: {accountTopics}
- Tone/Voice: {accountTone}

Current Date Context (use for seasonality and recency):
- Today's Date: {currentDate}
- Current Day of Week: {currentDayOfWeek}
- Current Month: {currentMonth}
- Current Year: {currentYear}

Objectives:
- Maximize engagement while keeping workload realistic for the account type
- Reflect the account's topics and tone in the content mix and cadence
- Be seasonally aware (current month, holidays, typical engagement patterns)

Hard Requirements (must follow):
1) frequency ∈ (daily, weekly, custom). Choose custom only if it's clearly better.
2) status = active, isEnabled = true, timezone = "UTC" (unless a different timezone is clearly implied by the description).
3) Dates: startDate = tomorrow ({tomorrowDate}); endDate = one month from today ({endDate}); format = YYYY-MM-DD.
4) timeSlots (7–14 total). Each slot:
   - dayOfWeek ∈ 0..6 (0=Sun)
   - startTime/endTime in HH:MM:SS (24h) and non-overlapping within the same day
   - postType ∈ (post_with_image, reel, story) - choose based on account type and optimal timing
   - label: descriptive name (e.g., "Morning Posts", "Evening Stories")
   - tone: content tone (free text describing the desired tone, e.g., "professional", "casual and friendly", "authoritative and confident") - match account type
   - dimensions: content format (1:1 for posts, 9:16 for reels/stories, 4:5 for Instagram posts, 16:9 for landscape)
   - preferredVoiceAccent: voice accent for audio content (american, british, australian, neutral, canadian)
   - reelDuration: CRITICAL - duration in seconds (8, 16, 24, or 32). MUST be included for EVERY reel postType. MUST also be included for story postType when storyType is 'video'. MUST NOT be included for post_with_image or image stories.
   - storyType: 'image' or 'video' - REQUIRED for story postType. DEFAULT is 'image'. If story postType is 'video', MUST also include reelDuration.
   - imageCount: number of images to generate (1-5) - ONLY for post_with_image postType. Randomly assign a value between 1-5 for each post_with_image time slot to add variety. Omit for reel and story types.
   - Favor windows typical for audience (examples):
     • business: weekdays 09:00:00–12:00:00 or 13:00:00–17:00:00 (post_with_image)
     • creator: weekdays 18:00:00–21:00:00; weekends late morning/afternoon (reel)
5) Ensure internal consistency:
   - No duplicate or overlapping timeSlots per day
   - Use postType distribution that reflects account type and topics:
     • business: post_with_image 50–70%, reel 20–40%, story 10–20%
     • creator: reel 40–60%, story 20–40%, post_with_image 10–30%

Strategy Guidance (apply, do not output):
- Derive cadence from accountType and topics (e.g., trending/visual niches → more reels; tutorials/products → more posts)
- If description suggests local business hours, bias to weekday daytimes; if lifestyle/entertainment, bias evenings/weekends
- If {currentMonth} contains notable seasonal events, bias timeSlots and notes accordingly

User Instructions:
{userInstructions}

Return only the structured schedule fields (the model will format as JSON via a schema).
Include:
- name: short, specific (e.g., "Q{currentMonth} {accountType} Growth Plan")
- description: 2–3 sentences explaining cadence, content mix, and timing rationale (keep under 3000 characters)
- frequency, status, isEnabled, startDate, endDate, timezone
- timeSlots (7–14) covering the week without overlaps, each with postType and label
- CRITICAL: Every reel postType MUST include reelDuration (8, 16, 24, or 32). Every video story MUST include reelDuration and storyType='video'.
`);

  }

  async generateSchedule(account: IgAccount, userInstructions?: string): Promise<AIGeneratedSchedule> {
    try {
      // Get current date information
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      
      const endDate = new Date(now);
      endDate.setMonth(now.getMonth() + 1);
      
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      
      // Create the prompt with account details and current date context
      const prompt = await this.schedulePrompt.format({
        accountName: account.name,
        accountType: account.type,
        accountDescription: account.description || 'No description provided',
        accountTopics: account.topics || 'General content',
        accountTone: account.tone || 'Professional',
        currentDate: now.toISOString().split('T')[0], // YYYY-MM-DD format
        currentDayOfWeek: daysOfWeek[now.getDay()],
        currentMonth: months[now.getMonth()],
        currentYear: now.getFullYear().toString(),
        tomorrowDate: tomorrow.toISOString().split('T')[0], // YYYY-MM-DD format
        endDate: endDate.toISOString().split('T')[0], // YYYY-MM-DD format
        userInstructions: userInstructions || 'No specific instructions provided. Generate a schedule based on the account type and best practices for Instagram content strategy.'
      });

      // Use structured output with the model
      const structuredModel = this.llmService.getLLM().withStructuredOutput(scheduleJsonSchema);
      
      // Generate response using structured output
      const response = await structuredModel.invoke(prompt);
      
      // Validate the response using Zod schema
      const validatedResponse = AIGeneratedScheduleSchema.parse(response);
      
      console.log('AI Generated Schedule:', JSON.stringify(validatedResponse, null, 2));
      
      return validatedResponse;
    } catch (error) {
      console.error('Error generating AI schedule:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate AI schedule: ${error.message}`);
      }
      throw new Error('Failed to generate AI schedule. Please try again.');
    }
  }

}
