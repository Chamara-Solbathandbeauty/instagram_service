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
   * @returns Media record of the final video
   */
  async generateExtendedVideo(
    contentId: number,
    contentIdea: ContentIdea,
    desiredDuration: number,
  ): Promise<Media> {
    try {
      console.log(`🎬 Starting extended video generation for content ${contentId}, duration: ${desiredDuration}s`);

      // 1. Generate segmented script
      console.log(`🤖 Generating segmented script with AI...`);
      const segments = await this.videoScriptService.generateSegmentedScript(
        contentIdea,
        desiredDuration,
      );

      console.log(`📝 Generated ${segments.length} segment scripts`);
      segments.forEach((seg, idx) => {
        console.log(`  Segment ${idx + 1}: ${seg.prompt?.substring(0, 100)}...`);
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

      // 5. Generate segments sequentially
      for (const segment of videoSegments) {
        await this.generateSegment(segment, videoSegments, consistentSeed);
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

      // 8. Concatenate segments
      console.log(`🎬 Concatenating ${segmentBuffers.length} segments`);
      const finalVideoBuffer = await this.videoConcatService.concatenateSegments(
        segmentBuffers,
        contentId,
      );

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

      // 11. Cleanup: Delete segment files from GCS (intermediate segments only)
      console.log(`🗑️  Cleaning up ${segments.length} intermediate segment files from GCS`);
      try {
        await this.gcsStorageService.deleteContentSegments(contentId);
        console.log(`✅ Successfully cleaned up intermediate segment files`);
      } catch (cleanupError) {
        console.warn(`⚠️  Failed to clean up intermediate segment files (non-critical):`, cleanupError.message);
        console.log(`ℹ️  Video generation completed successfully, but cleanup failed due to GCS permissions`);
        console.log(`ℹ️  Intermediate segment files may remain in GCS bucket`);
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
      const videoSegment = this.videoSegmentRepository.create({
        contentId,
        segmentNumber: segment.segmentNumber,
        prompt: segment.prompt,
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
        duration: 8,
        aspectRatio: '9:16',
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
            duration: 8,
            aspectRatio: '9:16',
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
         return `Generate an 8-second video segment in English only.

CONTENT: ${segment.prompt}

CRITICAL VISUAL ESTABLISHMENT REQUIREMENTS:
- High quality, professional video
- 9:16 aspect ratio (vertical)
- Smooth camera movements
- Clear, well-lit scene
- English language only (no text overlays in other languages)
- Suitable for social media (Instagram Reels/Stories)
- Establish COMPLETE visual baseline for all subsequent segments

VISUAL BASELINE REQUIREMENTS:
- Establish EXACT character appearance (facial features, hair, clothing, body type)
- Establish EXACT setting/background (location, objects, colors, atmosphere)
- Establish EXACT lighting conditions (brightness, shadows, colors, time of day)
- Establish EXACT camera style (angles, movement, framing)
- Establish EXACT color palette (tones, saturation, contrast)
- Establish EXACT music style (tempo, mood, instruments)
- Establish EXACT video quality and aspect ratio

This is segment 1 of ${allSegments.length} segments that will be combined into a longer video. All subsequent segments must maintain IDENTICAL visual characteristics established in this first segment.`;
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
         
         return `Generate an 8-second video segment in English only, continuing from the previous segment.

CONTENT: ${segment.prompt}

CRITICAL VISUAL CONSISTENCY REQUIREMENTS:
- Continue seamlessly from the reference image (last frame of previous segment)
- Maintain EXACT same character appearance: ${visualBaseline.character}
- Maintain EXACT same setting/background: ${visualBaseline.setting}
- Maintain EXACT same lighting conditions: ${visualBaseline.lighting}
- Maintain EXACT same camera style and angles: ${visualBaseline.camera}
- Maintain EXACT same color palette and tones: ${visualBaseline.colors}
- Maintain EXACT same music style and tempo: ${visualBaseline.music}
- Maintain EXACT same aspect ratio: ${visualBaseline.aspectRatio}
- Maintain EXACT same video quality: ${visualBaseline.quality}

TECHNICAL REQUIREMENTS:
- High quality, professional video
- 9:16 aspect ratio (vertical)
- Smooth camera movements
- Clear, well-lit scene
- English language only (no text overlays in other languages)
- Suitable for social media (Instagram Reels/Stories)
- Consistent with previous segment's visual style

This is segment ${segment.segmentNumber} of ${allSegments.length} segments. Use the reference image to maintain visual continuity and ensure the character, background, lighting, colors, and camera style are IDENTICAL to the first segment.`;
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
         // Extract character description (more comprehensive)
         const characterMatch = firstSegmentPrompt.match(/([A-Za-z]+(?:,?\s+[A-Za-z]+)*)\s*(?:aged\s*\d+)?,?\s*(?:with\s*[^.]*)?(?:wearing\s*[^.]*)?/);
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
         
         // Extract aspect ratio
         const aspectRatioMatch = firstSegmentPrompt.match(/(?:9:16|16:9|1:1|vertical|horizontal|portrait|landscape)/);
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
