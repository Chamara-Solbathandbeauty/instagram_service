import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoSegment, VideoSegmentStatus } from '../entities/video-segment.entity';
import { Content } from '../../content/entities/content.entity';
import { Media } from '../../content/media.entity';
import { VertexAIMediaService } from './vertex-ai-media.service';
import { GcsStorageService } from './gcs-storage.service';
import { VideoScriptGenerationService, ContentIdea } from './video-script-generation.service';
import { VideoConcatenationService } from './video-concatenation.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExtendedVideoGenerationService {

  constructor(
    @InjectRepository(VideoSegment)
    private videoSegmentRepository: Repository<VideoSegment>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private vertexAIMediaService: VertexAIMediaService,
    private gcsStorageService: GcsStorageService,
    private videoScriptService: VideoScriptGenerationService,
    private videoConcatService: VideoConcatenationService,
  ) {}


  /**
   * Generate an extended video (up to 30 seconds) from content idea
   * @param contentId - Content ID
   * @param contentIdea - Content idea with visual details
   * @param desiredDuration - Desired duration (8 or 30 seconds)
   * @param timeSlotContext - Schedule time slot context (tone, voice accent, label)
   * @returns Media record of the final video
   */
  async generateExtendedVideo(
    contentId: number,
    contentIdea: ContentIdea,
    desiredDuration: number,
    aspectRatio?: '16:9' | '9:16',
    contentType?: 'reel' | 'story',
    timeSlotContext?: any,
  ): Promise<Media> {
    try {
      console.log(`🎬 Starting extended video generation for content ${contentId}, duration: ${desiredDuration}s`);
      console.log(`🔍 DEBUG: contentId=${contentId}, desiredDuration=${desiredDuration}, contentType=${contentType}`);

      // 1. Generate segmented script
      console.log(`🤖 Generating segmented script with AI...`);
      const segments = await this.videoScriptService.generateSegmentedScript(
        contentIdea,
        desiredDuration,
        timeSlotContext,
        contentType,
      );

      console.log(`📝 Generated ${segments.length} segment scripts`);
      segments.forEach((seg, idx) => {
        const promptStr = typeof seg.prompt === 'string' ? seg.prompt : String(seg.prompt || '');
        console.log(`  Segment ${idx + 1}:`, {
          segmentNumber: seg.segmentNumber,
          duration: seg.duration,
          hasPrompt: !!seg.prompt,
          promptType: typeof seg.prompt,
          promptLength: promptStr.length,
          promptPreview: promptStr.substring(0, 100) || 'NO PROMPT'
        });
      });

      // 2. Update content with script and settings
      await this.contentRepository.update(contentId, {
        videoScript: segments,
        desiredDuration,
        isExtendedVideo: desiredDuration > 8,
      });

      // 3. Create video segment records
      const videoSegments = await this.createVideoSegmentRecords(contentId, segments);

      // 4. Generate a consistent seed for all segments (for visual consistency)
      // Use contentId as base for deterministic but varied seeds
      const baseSeed = Math.abs(contentId * 1000000) % 4294967295;
      const consistentSeed = baseSeed;
      console.log(`🎲 Using consistent seed ${consistentSeed} for all ${segments.length} segments (based on contentId: ${contentId})`);
      console.log(`📊 Video duration: ${desiredDuration}s, Segments: ${segments.length}, Duration per segment: 8s`);

      // 5. Generate segments sequentially
      for (const segment of videoSegments) {
        await this.generateSegment(segment, videoSegments, consistentSeed, aspectRatio);
      }

      // 6. Check all segments are completed
      const completedSegments = await this.videoSegmentRepository.find({
        where: { contentId, status: VideoSegmentStatus.COMPLETED },
        order: { segmentNumber: 'ASC' },
      });

      if (completedSegments.length !== segments.length) {
        throw new Error(`Only ${completedSegments.length}/${segments.length} segments completed`);
      }

      // 7. Download segments from GCS
      console.log(`📥 Downloading ${completedSegments.length} segments from GCS`);
      const segmentBuffers = await Promise.all(
        completedSegments.map(seg => this.gcsStorageService.downloadSegment(seg.gcsUri)),
      );

      // 8. Concatenate segments with seamless flow
      console.log(`🎬 Concatenating ${segmentBuffers.length} segments with seamless flow`);
      
      // Use story-specific concatenation for story videos, regular concatenation for reels
      let finalVideoBuffer: Buffer;
      if (contentType === 'story') {
        console.log(`📱 Using ultra-smooth audio story concatenation for story video`);
        finalVideoBuffer = await this.videoConcatService.concatenateStoryWithSmoothAudio(
          segmentBuffers,
          contentId,
        );
      } else {
        console.log(`🎬 Using regular seamless concatenation for reel video`);
        finalVideoBuffer = await this.videoConcatService.concatenateSegments(
          segmentBuffers,
          contentId,
        );
      }

      // 9. Save final video to local storage
      const fileName = `content_${contentId}_${desiredDuration}s_${Date.now()}.mp4`;
      const filePath = await this.saveFinalVideo(finalVideoBuffer, fileName);

      // 10. Create media record (final video stays local, no GCS upload needed)
      console.log(`💾 Saving final video to database (local storage only)`);
      const media = this.mediaRepository.create({
        contentId,
        fileName,
        filePath,
        fileSize: finalVideoBuffer.length,
        mimeType: 'video/mp4',
        mediaType: 'video',
        prompt: contentIdea.description,
        isSegmented: segments.length > 1,
        segmentCount: segments.length,
        gcsUri: null, // Final video stays local
      });

      const savedMedia = await this.mediaRepository.save(media);

      // 11. Cleanup: Delete all intermediate files from GCS (segments + reference frames)
      console.log(`🗑️  Cleaning up all intermediate files from GCS for content ${contentId}`);
      try {
        await this.gcsStorageService.deleteAllContentFiles(contentId);
        console.log(`✅ Successfully cleaned up all intermediate files (segments + reference frames)`);
      } catch (cleanupError) {
        console.warn(`⚠️  Failed to clean up intermediate files (non-critical):`, cleanupError.message);
        console.log(`ℹ️  Video generation completed successfully, but cleanup failed due to GCS permissions`);
        console.log(`ℹ️  Intermediate files may remain in GCS bucket`);
      }

      console.log(`✅ Extended video generation completed for content ${contentId}`);
      return savedMedia;
    } catch (error) {
      console.error(`❌ Extended video generation failed for content ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Create video segment records in database
   */
  private async createVideoSegmentRecords(
    contentId: number,
    segments: any[],
  ): Promise<VideoSegment[]> {
    const videoSegments: VideoSegment[] = [];

    for (const segment of segments) {
      // Ensure we have valid required fields
      if (!segment.segmentNumber) {
        console.error(`❌ Segment is missing segmentNumber:`, segment);
        throw new Error(`Segment is missing required segmentNumber field`);
      }
      
      if (!segment.duration) {
        console.error(`❌ Segment ${segment.segmentNumber} is missing duration:`, segment);
        throw new Error(`Segment ${segment.segmentNumber} is missing required duration field`);
      }
      
      // Ensure we have a valid prompt and convert to string if needed
      const promptStr = typeof segment.prompt === 'string' ? segment.prompt : String(segment.prompt || '');
      
      if (!promptStr || promptStr.trim() === '') {
        console.error(`❌ Segment ${segment.segmentNumber} has no valid prompt:`, segment);
        throw new Error(`Segment ${segment.segmentNumber} is missing required prompt field`);
      }

      console.log(`📝 Creating video segment ${segment.segmentNumber} with prompt length: ${promptStr.length}`);

      const videoSegment = this.videoSegmentRepository.create({
        contentId,
        segmentNumber: segment.segmentNumber,
        prompt: promptStr,
        duration: segment.duration,
        status: VideoSegmentStatus.PENDING,
      });

      const saved = await this.videoSegmentRepository.save(videoSegment);
      videoSegments.push(saved);
    }

    return videoSegments;
  }

  /**
   * Generate a single video segment with full narrative context
   */
  private async generateSegment(
    segment: VideoSegment,
    allSegments: VideoSegment[],
    seed: number,
    aspectRatio?: '16:9' | '9:16',
  ): Promise<void> {
    try {
      console.log(`🎥 Generating segment ${segment.segmentNumber} for content ${segment.contentId}`);

      // Update status to generating
      await this.videoSegmentRepository.update(segment.id, {
        status: VideoSegmentStatus.GENERATING,
      });

      // Get previous segment's GCS URI and extract last frame if this is not the first segment
      let inputVideoGcsUri: string | undefined;
      let referenceImageGcsUri: string | undefined;
      let contextualPrompt: string;
      
      if (segment.segmentNumber > 1) {
        const previousSegment = allSegments.find(
          s => s.segmentNumber === segment.segmentNumber - 1,
        );
        
        console.log(`🔍 Looking for previous segment ${segment.segmentNumber - 1}:`, {
          found: !!previousSegment,
          gcsUri: previousSegment?.gcsUri,
          status: previousSegment?.status
        });
        
        // Ensure previous segment is completed before extracting frame
        if (previousSegment && previousSegment.status !== VideoSegmentStatus.COMPLETED) {
          console.log(`⏳ Previous segment ${segment.segmentNumber - 1} not completed yet (status: ${previousSegment.status}). Waiting...`);
          
          // Wait for previous segment to complete
          await this.waitForSegmentCompletion(previousSegment.id);
          
          // Refresh the segment data
          const refreshedPreviousSegment = await this.videoSegmentRepository.findOne({
            where: { id: previousSegment.id }
          });
          
          if (!refreshedPreviousSegment?.gcsUri) {
            throw new Error(`Previous segment ${segment.segmentNumber - 1} completed but no GCS URI available`);
          }
          
          previousSegment.gcsUri = refreshedPreviousSegment.gcsUri;
          previousSegment.status = refreshedPreviousSegment.status;
        }
        
        if (previousSegment?.gcsUri) {
          inputVideoGcsUri = previousSegment.gcsUri;
          
          // Extract last frame from previous segment as reference image
          console.log(`🖼️ Extracting last frame from segment ${segment.segmentNumber - 1} for visual continuity`);
          
          try {
            referenceImageGcsUri = await this.vertexAIMediaService.extractLastFrameAsReference(
              previousSegment.gcsUri,
              segment.contentId,
              segment.segmentNumber - 1
            );
            
            console.log(`✅ Frame extraction successful: ${referenceImageGcsUri}`);
          } catch (error) {
            console.error(`❌ Frame extraction failed:`, error);
            throw error;
          }
        } else {
          console.log(`⚠️ Previous segment not found or no GCS URI available`);
        }
        
        // Build comprehensive narrative context for continuation segments
        contextualPrompt = this.buildContinuationPrompt(segment, allSegments);

        console.log(`🔗 Segment ${segment.segmentNumber} continuing from previous video with last frame reference`);
        console.log(`   Previous segment GCS URI: ${inputVideoGcsUri}`);
        console.log(`   Reference image GCS URI: ${referenceImageGcsUri}`);
      } else {
        // First segment - provide complete story overview
        contextualPrompt = this.buildFirstSegmentPrompt(segment, allSegments);

        console.log(`🎬 Segment 1 establishing baseline with complete narrative overview (${allSegments.length} segments)`);
      }

      // Log video generation parameters
      console.log(`🎬 Video generation parameters:`, {
        segmentNumber: segment.segmentNumber,
        hasInputVideo: !!inputVideoGcsUri,
        hasReferenceImage: !!referenceImageGcsUri,
        inputVideoGcsUri,
        referenceImageGcsUri,
        seed
      });

      // Try to generate video, with retry logic for safety filter blocks
      let result = await this.vertexAIMediaService.generateVideo({
        prompt: contextualPrompt,
        style: 'professional',
        mood: 'engaging',
        visualElements: [],
        targetAudience: 'social media',
        duration: segment.duration, // Use actual segment duration
        aspectRatio: aspectRatio || '16:9', // Use passed aspectRatio or default to 16:9
        // Use only reference image for continuation segments (not both inputVideo and referenceImage)
        referenceImageGcsUri: segment.segmentNumber > 1 ? referenceImageGcsUri : undefined,
        seed, // Consistent seed for all segments
      });

      // If blocked by safety filters, retry with simplified prompt
        if (!result.success && result.metadata?.raiFiltered) {
          console.log(`⚠️  Segment ${segment.segmentNumber} blocked by safety filters. Retrying with simplified prompt...`);
          
          const simplifiedPrompt = this.simplifyPrompt(contextualPrompt);
          console.log(`📝 Simplified prompt: ${simplifiedPrompt.substring(0, 150)}...`);
          
          result = await this.vertexAIMediaService.generateVideo({
            prompt: simplifiedPrompt,
            style: 'professional',
            mood: 'engaging',
            visualElements: [],
            targetAudience: 'social media',
            duration: segment.duration, // Use actual segment duration
            aspectRatio: aspectRatio || '16:9', // Use passed aspectRatio or default to 16:9
            // Use only reference image for continuation segments (not both inputVideo and referenceImage)
            referenceImageGcsUri: segment.segmentNumber > 1 ? referenceImageGcsUri : undefined,
            seed, // Keep same seed for retry
          });
        }

        if (!result.success) {
          console.error(`❌ Video generation failed:`, result.error);
          throw new Error(result.error || 'Video generation failed');
        }

        console.log(`✅ Video generation successful for segment ${segment.segmentNumber}`);

        // Handle long-running operation
        if (result.metadata?.operationName) {
          console.log(`⏳ Starting long-running operation: ${result.metadata.operationName}`);
          await this.videoSegmentRepository.update(segment.id, {
            operationName: result.metadata.operationName,
          });

          // Poll for completion
          await this.pollSegmentCompletion(segment.id, result.metadata.operationName);
        } else if (result.mediaData) {
          // Immediate response (rare for video)
          console.log(`💾 Saving direct result to GCS`);
          await this.saveSegmentToGcs(segment.id, result.mediaData);
        } else {
          console.error(`❌ No video data received from Vertex AI`);
          throw new Error('No video data received from Vertex AI');
        }

    } catch (error) {
      console.error(`❌ Failed to generate segment ${segment.segmentNumber}:`, error);
      await this.videoSegmentRepository.update(segment.id, {
        status: VideoSegmentStatus.FAILED,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Wait for a segment to complete
   */
  private async waitForSegmentCompletion(segmentId: number, maxWaitTime: number = 300000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // Check every 5 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      const segment = await this.videoSegmentRepository.findOne({ where: { id: segmentId } });
      
      if (!segment) {
        throw new Error(`Segment ${segmentId} not found`);
      }
      
      if (segment.status === VideoSegmentStatus.COMPLETED) {
        console.log(`✅ Previous segment ${segmentId} completed`);
        return;
      }
      
      if (segment.status === VideoSegmentStatus.FAILED) {
        throw new Error(`Previous segment ${segmentId} failed: ${segment.errorMessage}`);
      }
      
      console.log(`⏳ Waiting for previous segment ${segmentId} to complete (status: ${segment.status})`);
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Timeout waiting for segment ${segmentId} to complete`);
  }

  /**
   * Poll for segment generation completion
   */
  private async pollSegmentCompletion(
    segmentId: number,
    operationName: string,
    maxAttempts: number = 60,
  ): Promise<void> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;

      console.log(`⏳ Polling segment ${segmentId} (attempt ${attempts}/${maxAttempts})`);

      const result = await this.vertexAIMediaService.checkVideoGenerationStatus(operationName);

      if (result.success && result.metadata?.status === 'COMPLETED') {
        // Check if we have a GCS URI (official workflow)
        if (result.metadata.gcsUri) {
          console.log(`✅ Segment ${segmentId} completed - Veo stored at: ${result.metadata.gcsUri}`);
          
          // Save the Veo-generated GCS URI directly (no re-uploading!)
          await this.saveSegmentGcsUri(segmentId, result.metadata.gcsUri);
          return;
        } 
        // Fallback: if we got base64 data instead
        else if (result.mediaData) {
          console.log(`✅ Segment ${segmentId} completed - received base64 data, uploading to GCS`);
          await this.saveSegmentToGcs(segmentId, result.mediaData);
          return;
        }
      } else if (!result.success && result.error) {
        // Generation failed
        throw new Error(result.error);
      }

      // Continue polling
    }

    throw new Error(`Segment ${segmentId} generation timed out after ${maxAttempts} attempts`);
  }

  /**
   * Save Veo-generated GCS URI directly (official workflow - no re-upload!)
   */
  private async saveSegmentGcsUri(segmentId: number, gcsUri: string): Promise<void> {
    const segment = await this.videoSegmentRepository.findOne({ where: { id: segmentId } });
    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    // Just save the GCS URI - video is already in GCS (Veo stored it)
    await this.videoSegmentRepository.update(segmentId, {
      gcsUri,
      status: VideoSegmentStatus.COMPLETED,
    });

    console.log(`✅ Segment ${segment.segmentNumber} completed - using Veo GCS URI: ${gcsUri}`);
  }

  /**
   * Save segment video to GCS and update database (fallback for base64 data)
   */
  private async saveSegmentToGcs(segmentId: number, videoBuffer: Buffer): Promise<void> {
    const segment = await this.videoSegmentRepository.findOne({ where: { id: segmentId } });
    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    // Upload to GCS
    const gcsUri = await this.gcsStorageService.uploadSegment(
      segment.contentId,
      segment.segmentNumber,
      videoBuffer,
    );

    // Update segment record
    await this.videoSegmentRepository.update(segmentId, {
      gcsUri,
      status: VideoSegmentStatus.COMPLETED,
    });

    console.log(`✅ Segment ${segment.segmentNumber} completed and uploaded to ${gcsUri}`);
  }

  /**
   * Save final concatenated video to local storage
   */
  private async saveFinalVideo(videoBuffer: Buffer, fileName: string): Promise<string> {
    const videoDir = path.join(process.cwd(), 'uploads', 'media', 'videos');
    
    // Ensure directory exists
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    const fullPath = path.join(videoDir, fileName);
    fs.writeFileSync(fullPath, videoBuffer);

    // Return relative path for database
    return `/videos/${fileName}`;
  }

       /**
        * Build contextual prompt for the first segment with complete narrative overview
        */
       private buildFirstSegmentPrompt(segment: VideoSegment, allSegments: VideoSegment[]): string {
         return `Generate an 8-second video segment that establishes the complete visual and audio foundation for seamless video flow.

CONTENT: ${segment.prompt}

CRITICAL FOUNDATION REQUIREMENTS:
- High quality, professional video optimized for social media
- 9:16 vertical aspect ratio for mobile viewing
- Smooth, natural camera movements
- Clear, well-lit scene with professional cinematography
- English language only (no text overlays in other languages)
- Engaging opening that hooks viewers immediately

VISUAL FOUNDATION REQUIREMENTS:
- Establish EXACT character appearance (facial features, hair, clothing, body type, age)
- Establish EXACT setting/background (location, objects, colors, atmosphere, time of day)
- Establish EXACT lighting conditions (brightness, shadows, colors, mood)
- Establish EXACT camera style (angles, movement patterns, framing)
- Establish EXACT color palette (tones, saturation, contrast, mood)
- Establish EXACT video quality and aspect ratio

AUDIO FOUNDATION REQUIREMENTS:
- Establish EXACT music style (genre, tempo, mood, instruments)
- Establish EXACT voiceover tone and pace (if applicable)
- Set the audio baseline that all subsequent segments will maintain
- Ensure audio is engaging and appropriate for the content

STORY FOUNDATION REQUIREMENTS:
- Create an engaging opening that draws viewers in
- Establish the story's tone and energy level
- Set up the narrative that will continue through all segments
- Make viewers want to see what happens next

This is segment 1 of ${allSegments.length} segments that will be combined into a seamless longer video. All subsequent segments must maintain IDENTICAL visual and audio characteristics established in this first segment to ensure smooth, continuous flow.`;
       }

       /**
        * Build contextual prompt for continuation segments with frame reference
        * Uses extremely specific prompts for maximum visual consistency
        */
       private buildContinuationPrompt(segment: VideoSegment, allSegments: VideoSegment[]): string {
         // Get the first segment's prompt to maintain character and setting consistency
         const firstSegment = allSegments.find(s => s.segmentNumber === 1);
         const firstSegmentPrompt = firstSegment?.prompt || '';
         
         // Extract key visual elements from the first segment
         const visualBaseline = this.extractVisualBaseline(firstSegmentPrompt);
         
         return `Generate an 8-second video segment that continues seamlessly from the previous segment.

CONTENT: ${segment.prompt}

CRITICAL SEAMLESS FLOW REQUIREMENTS:
- This is NOT a new video - it's the next 8 seconds of the SAME continuous video
- Continue IMMEDIATELY from the reference image (last frame of previous segment)
- NO visual breaks, jumps, or transitions between segments
- NO audio gaps, pauses, or changes in voiceover/music
- The viewer should feel like they're watching one continuous video, not separate clips

VISUAL CONTINUITY REQUIREMENTS:
- Maintain EXACT same character appearance: ${visualBaseline.character}
- Maintain EXACT same setting/background: ${visualBaseline.setting}
- Maintain EXACT same lighting conditions: ${visualBaseline.lighting}
- Maintain EXACT same camera style and angles: ${visualBaseline.camera}
- Maintain EXACT same color palette and tones: ${visualBaseline.colors}
- Maintain EXACT same aspect ratio: ${visualBaseline.aspectRatio}
- Maintain EXACT same video quality: ${visualBaseline.quality}

CRITICAL AUDIO CONTINUITY REQUIREMENTS:
- BACKGROUND MUSIC: Continue the EXACT same music style, tempo, key, and arrangement
- MUSIC SPECIFICATION: If previous segment had "upbeat acoustic guitar at 120 BPM in C major", this segment MUST specify "Continue the SAME upbeat acoustic guitar at 120 BPM in C major"
- NO MUSIC CHANGES: Never change music style, tempo, key, or instrumental arrangement
- VOICEOVER FLOW: Continue the voiceover as if it's one continuous narration without any pauses
- VOICE CONSISTENCY: Use the EXACT same voice tone, pace, accent, and energy level
- AUDIO SEAMLESSNESS: The audio should sound like one continuous video, not separate clips
- MUSIC LAYERING: Maintain the same instrumental arrangement, mixing levels, and EQ
- VOICE TIMING: Voiceover should flow naturally without gaps or abrupt changes
- AUDIO QUALITY: Maintain consistent audio levels and frequency response
- SOUND EFFECTS: Continue the same ambient sounds and audio atmosphere
- NO AUDIO GAPS: Ensure there are no silences, pauses, or audio breaks between segments

STORY FLOW REQUIREMENTS:
- Continue the story naturally from where the previous segment ended
- Use smooth, natural actions that flow from the previous segment
- Avoid abrupt changes in action or direction
- Maintain the same energy level and pacing
- Build naturally on what happened in the previous segment

TECHNICAL REQUIREMENTS:
- High quality, professional video
- ${visualBaseline.aspectRatio} aspect ratio (optimized for mobile viewing)
- Smooth, natural camera movements
- Clear, well-lit scene
- English language only
- Optimized for social media (Instagram Reels/Stories)
- Consistent with previous segment's visual and audio style

This is segment ${segment.segmentNumber} of ${allSegments.length} segments. The video must feel like the next 8 seconds of the same continuous video, not a separate clip. Use the reference image to maintain perfect visual continuity and ensure the story flows naturally.`;
       }

       /**
        * Extract comprehensive visual baseline elements from the first segment prompt
        * This ensures all subsequent segments maintain the same visual characteristics
        */
       private extractVisualBaseline(firstSegmentPrompt: string): {
         character: string;
         setting: string;
         lighting: string;
         camera: string;
         colors: string;
         music: string;
         aspectRatio: string;
         quality: string;
       } {
         // Extract character description (more specific)
         const characterMatch = firstSegmentPrompt.match(/(?:character|person|woman|man|host|instructor|trainer|guide)\s*[^.]*?(?:wearing|with|aged|years?|old)/);
         const character = characterMatch ? characterMatch[0].trim() : 'main character';
         
         // Extract setting/location (more comprehensive)
         const settingMatch = firstSegmentPrompt.match(/(?:in\s*a\s*|stands\s*in\s*a\s*|location:\s*|through\s*a\s*|at\s*)([^.]*?)(?:\.|,|with|The)/);
         const setting = settingMatch ? settingMatch[1].trim() : 'same location';
         
         // Extract lighting (more comprehensive)
         const lightingMatch = firstSegmentPrompt.match(/(?:lighting|light|illuminated|bathed|glow|bright|soft|warm|cool|natural|artificial|sunlit|golden|amber|warm|soft|gentle)[^.]*?\./);
         const lighting = lightingMatch ? lightingMatch[0].trim() : 'same lighting';
         
         // Extract camera style (more comprehensive)
         const cameraMatch = firstSegmentPrompt.match(/(?:camera|shot|angle|view|wide|close|medium|low|high|follows|smoothly|smooth|steady|professional)[^.]*?\./);
         const camera = cameraMatch ? cameraMatch[0].trim() : 'same camera style';
         
         // Extract colors (more comprehensive)
         const colorMatch = firstSegmentPrompt.match(/(?:color|tone|palette|wearing|background|foreground|white|brown|red|green|blue|warm|cool|vibrant|soft|rich)[^.]*?\./);
         const colors = colorMatch ? colorMatch[0].trim() : 'same color palette';
         
         // Extract music (more comprehensive)
         const musicMatch = firstSegmentPrompt.match(/(?:music|track|sound|audio|beat|melody|upbeat|motivating|electronic|pop|acoustic|guitar|piano|instrumental)[^.]*?\./);
         const music = musicMatch ? musicMatch[0].trim() : 'same music style';
         
         // Extract aspect ratio (support both horizontal and vertical)
        const aspectRatioMatch = firstSegmentPrompt.match(/(?:9:16|16:9|1:1|vertical|horizontal|landscape|portrait)/);
        const aspectRatio = aspectRatioMatch ? aspectRatioMatch[0] : '9:16 vertical';
         
         // Extract quality
         const qualityMatch = firstSegmentPrompt.match(/(?:professional|high quality|premium|excellent|clear|sharp|detailed)/);
         const quality = qualityMatch ? qualityMatch[0] : 'professional quality';
         
         return {
           character: character || 'main character',
           setting: setting || 'same setting',
           lighting: lighting || 'same lighting',
           camera: camera || 'same camera style',
           colors: colors || 'same color palette',
           music: music || 'same music style',
           aspectRatio: aspectRatio || '9:16 vertical',
           quality: quality || 'professional quality'
         };
       }

  /**
   * Simplify a prompt to avoid safety filters
   * Removes overly specific details, complex descriptions, and potential trigger words
   */
  private simplifyPrompt(originalPrompt: string): string {
    // Extract the core concept and remove complex details
    const simplified = originalPrompt
      // Remove parenthetical details
      .replace(/\([^)]*\)/g, '')
      // Remove specific measurements, percentages, etc
      .replace(/\d+\s*(seconds?|minutes?|%|degrees?|cm|mm|inches?)/gi, '')
      // Simplify camera movements to basic terms
      .replace(/very slow,?\s*smooth\s*/gi, 'slow ')
      .replace(/subtle,?\s*(slow)?\s*/gi, '')
      .replace(/gradually,?\s*/gi, '')
      // Remove overly specific descriptors
      .replace(/clean,?\s*manicured\s*/gi, '')
      .replace(/pristine,?\s*minimalist\s*/gi, 'simple ')
      .replace(/precise,?\s*centered\s*/gi, 'centered ')
      // Simplify lighting descriptions
      .replace(/bathed in\s*(the\s*)?/gi, 'with ')
      .replace(/soft,?\s*golden hour\s*/gi, 'warm ')
      .replace(/dust motes\s*gently\s*dance\s*in\s*(the\s*)?sunbeams/gi, 'sunlit scene')
      // Remove redundant adjectives
      .replace(/\s+(warm,?\s*inviting|clean,?\s*subtle|gentle,?\s*subtle)\s*/gi, ' ')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    // If still too detailed, create a very basic prompt
    if (simplified.length > 200) {
      const basicConcepts = [
        'professional video',
        'smooth camera movement',
        'good lighting',
        'social media content',
        'high quality',
      ];
      return basicConcepts.join(', ') + '. ' + simplified.substring(0, 100);
    }

    return simplified;
  }
}
