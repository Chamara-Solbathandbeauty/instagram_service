import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { Storage } from '@google-cloud/storage';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

export interface VertexAIImageRequest {
  prompt: string;
  style: string;
  mood: string;
  visualElements: string[];
  targetAudience: string;
}

export interface VertexAIVideoRequest {
  prompt: string;
  style: string;
  mood: string;
  visualElements: string[];
  targetAudience: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  inputVideoGcsUri?: string; // For extending videos from previous segment
  seed?: number; // For consistency across segments (0-4294967295)
  referenceImageGcsUri?: string; // For image-to-video generation using last frame
}

export interface VertexAIMediaResponse {
  success: boolean;
  mediaUrl?: string;
  mediaData?: Buffer;
  error?: string;
  metadata?: {
    generationTime: number;
    model: string;
    parameters: any;
    predictionId?: string | null;
    imageUri?: string;
    videoUri?: string;
    operationName?: string;
    status?: string;
    gcsUri?: string;
    raiFiltered?: boolean;
    raiReasons?: string[];
  };
}

@Injectable()
export class VertexAIMediaService {
  private readonly vertexAiProjectId = process.env.GOOGLE_CLOUD_PROJECT;
  private readonly vertexAiLocation = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  private readonly auth: GoogleAuth;

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }


  async generateImage(request: VertexAIImageRequest): Promise<VertexAIMediaResponse> {
    try {
      // Enhanced prompt for better image generation
      const enhancedPrompt = this.buildImagePrompt(request);
      
      // Get access token using ADC
      const accessToken = await this.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get access token from ADC');
      }
      
      const response = await fetch(
        `https://${this.vertexAiLocation}-aiplatform.googleapis.com/v1/projects/${this.vertexAiProjectId}/locations/${this.vertexAiLocation}/publishers/google/models/imagegeneration@006:predict`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [{
              prompt: enhancedPrompt,
              parameters: {
                sampleCount: 1,
                aspectRatio: "1:1",
                safetyFilterLevel: "block_some",
                personGeneration: "allow_adult"
              }
            }]
          }),
        }
      );

      if (!response.ok) {
        // Check if response is HTML (error page) instead of JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          const htmlResponse = await response.text();
          console.error('HTML Error Response:', htmlResponse.substring(0, 500));
          throw new Error(`Vertex AI API returned HTML error page. Status: ${response.status}. Check authentication and endpoint configuration.`);
        }
        
        try {
          const errorData = await response.json();
          throw new Error(`Vertex AI API error: ${errorData.error?.message || response.statusText}`);
        } catch (jsonError) {
          throw new Error(`Vertex AI API error: ${response.status} ${response.statusText}`);
        }
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Non-JSON Response:', textResponse.substring(0, 500));
        throw new Error(`Vertex AI API returned non-JSON response. Content-Type: ${contentType}`);
      }

      const data = await response.json();
      
      // Handle the response according to Vertex AI documentation
      if (!data.predictions || data.predictions.length === 0) {
        throw new Error('No image predictions returned from Vertex AI');
      }

      const prediction = data.predictions[0];
      
      // Check if the response contains base64 encoded image data
      if (prediction.bytesBase64Encoded) {
        const imageData = prediction.bytesBase64Encoded;
        const imageBuffer = Buffer.from(imageData, 'base64');

        return {
          success: true,
          mediaData: imageBuffer,
          metadata: {
            generationTime: Date.now(),
            model: 'imagegeneration@006',
            parameters: request,
            predictionId: prediction.predictionId || null,
          },
        };
      } else if (prediction.imageUri) {
        // If the response contains an image URI, we need to download it
        const imageUri = prediction.imageUri;
        const imageResponse = await fetch(imageUri, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!imageResponse.ok) {
          throw new Error(`Failed to download image from URI: ${imageResponse.statusText}`);
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        return {
          success: true,
          mediaData: imageBuffer,
          metadata: {
            generationTime: Date.now(),
            model: 'imagegeneration@006',
            parameters: request,
            predictionId: prediction.predictionId || null,
            imageUri: imageUri,
          },
        };
      } else {
        throw new Error('Invalid response format from Vertex AI image generation');
      }
    } catch (error) {
      console.error('Vertex AI Image Generation Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate image',
      };
    }
  }

  async generateVideo(request: VertexAIVideoRequest): Promise<VertexAIMediaResponse> {
    try {
      // Enhanced prompt for better video generation
      const enhancedPrompt = this.buildVideoPrompt(request);
      
      console.log(`🎬 Generating video with prompt: ${enhancedPrompt.substring(0, 200)}...`);
      
      // Get access token using ADC
      const accessToken = await this.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get access token from ADC');
      }
      
      // Build the API request payload
      const instancePayload: any = {
        prompt: enhancedPrompt,
        parameters: {
          videoLength: request.duration || 8,
          aspectRatio: request.aspectRatio || "9:16",
          safetyFilterLevel: "block_some"
        }
      };

      // Add seed for consistency (if provided)
      if (request.seed !== undefined) {
        instancePayload.parameters.seed = request.seed;
        console.log(`🎲 Using seed ${request.seed} for consistency`);
      }

      // Use either video extension OR image-to-video generation, but not both
      if (request.inputVideoGcsUri && !request.referenceImageGcsUri) {
        // Video extension approach (original method)
        instancePayload.video = {
          gcsUri: request.inputVideoGcsUri,
          mimeType: 'video/mp4'
        };
        console.log(`🔗 Extending video from: ${request.inputVideoGcsUri}`);
      } else if (request.referenceImageGcsUri && !request.inputVideoGcsUri) {
        // Image-to-video generation approach (new method)
        instancePayload.image = {
          gcsUri: request.referenceImageGcsUri,
          mimeType: 'image/jpeg'
        };
        console.log(`🖼️ Using reference image: ${request.referenceImageGcsUri}`);
      } else if (request.inputVideoGcsUri && request.referenceImageGcsUri) {
        // Both provided - prioritize image-to-video generation for better continuity
        console.log(`⚠️ Both inputVideo and referenceImage provided. Using image-to-video generation for better continuity.`);
        instancePayload.image = {
          gcsUri: request.referenceImageGcsUri,
          mimeType: 'image/jpeg'
        };
        console.log(`🖼️ Using reference image: ${request.referenceImageGcsUri}`);
      }
      
      // Build parameters with storageUri (official workflow - Veo stores directly to GCS)
      const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'insta_generated_videos';
      const requestParameters: any = {
        storageUri: `gs://${bucketName}/reels/generated`,
        sampleCount: 1
      };

      // Log complete API request
      const apiRequest = {
        instances: [instancePayload],
        parameters: requestParameters
      };
      
      
       // Use predictLongRunning for video generation as per official documentation
       const response = await fetch(
        `https://${this.vertexAiLocation}-aiplatform.googleapis.com/v1/projects/${this.vertexAiProjectId}/locations/${this.vertexAiLocation}/publishers/google/models/veo-3.0-generate-001:predictLongRunning`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [instancePayload],
            parameters: requestParameters
          }),
        }
      );

      if (!response.ok) {
        // Check if response is HTML (error page) instead of JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          const htmlResponse = await response.text();
          console.error('HTML Error Response:', htmlResponse.substring(0, 500));
          throw new Error(`Vertex AI API returned HTML error page. Status: ${response.status}. Check authentication and endpoint configuration.`);
        }
        
        try {
          const errorData = await response.json();
          throw new Error(`Vertex AI API error: ${errorData.error?.message || response.statusText}`);
        } catch (jsonError) {
          throw new Error(`Vertex AI API error: ${response.status} ${response.statusText}`);
        }
      }

      // Get response text
      const responseText = await response.text();

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`❌ Non-JSON Response:`, responseText.substring(0, 500));
        throw new Error(`Vertex AI API returned non-JSON response. Content-Type: ${contentType}`);
      }

      const data = JSON.parse(responseText);
      
      // Handle long-running operation response
      if (data.name) {
        // This is a long-running operation - we need to monitor it
        console.log(`🎬 Video generation operation started: ${data.name}`);
        
        // For now, return a placeholder response indicating the operation is in progress
        // In a production system, you would implement proper operation monitoring
        return {
          success: true,
          mediaData: undefined, // Will be populated when operation completes
          metadata: {
            generationTime: Date.now(),
            model: 'veo-3.0-generate-001',
            parameters: request,
            operationName: data.name,
            status: 'RUNNING',
          },
        };
      } else if (data.predictions && data.predictions.length > 0) {
        // Handle direct response (fallback)
        const prediction = data.predictions[0];
        
        if (prediction.bytesBase64Encoded) {
          const videoData = prediction.bytesBase64Encoded;
          const videoBuffer = Buffer.from(videoData, 'base64');

          return {
            success: true,
            mediaData: videoBuffer,
            metadata: {
              generationTime: Date.now(),
              model: 'veo-3.0-generate-001',
              parameters: request,
              predictionId: prediction.predictionId || null,
            },
          };
        } else if (prediction.videoUri) {
          // If the response contains a video URI, we need to download it
          const videoUri = prediction.videoUri;
          const videoResponse = await fetch(videoUri, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!videoResponse.ok) {
            throw new Error(`Failed to download video from URI: ${videoResponse.statusText}`);
          }

          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

          return {
            success: true,
            mediaData: videoBuffer,
            metadata: {
              generationTime: Date.now(),
              model: 'veo-3.0-generate-001',
              parameters: request,
              predictionId: prediction.predictionId || null,
              videoUri: videoUri,
            },
          };
        }
      }
      
      throw new Error('Invalid response format from Vertex AI video generation');
      } catch (error) {
        console.error(`❌ Vertex AI Video Generation Error:`, error);
        
        return {
          success: false,
          error: error.message || 'Failed to generate video',
        };
      }
  }

  /**
   * Extract the last frame from a video and upload it to GCS as a reference image
   */
  async extractLastFrameAsReference(videoGcsUri: string, contentId: number, segmentNumber: number): Promise<string> {
    try {
      console.log(`🖼️ Extracting last frame from: ${videoGcsUri}`);
      
      // Download video from GCS
      const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'insta_generated_videos';
      const videoPath = videoGcsUri.replace(`gs://${bucketName}/`, '');

      console.log(`🖼️ Video path: ${videoPath}`);
      
      const storage = new Storage();
      const videoFile = storage.bucket(bucketName).file(videoPath);
      const [videoBuffer] = await videoFile.download();
      
      // Create temporary video file
      const tempVideoPath = path.join(process.cwd(), 'uploads', 'temp', `temp_video_${contentId}_${segmentNumber}.mp4`);
      const tempDir = path.dirname(tempVideoPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      fs.writeFileSync(tempVideoPath, videoBuffer);


      
      // Extract last frame using FFmpeg
      const framePath = path.join(process.cwd(), 'uploads', 'temp', `frame_${contentId}_${segmentNumber}.jpg`);

      console.log(`🖼️ Frame path: ${framePath}`);
      
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(tempVideoPath)
          .inputOptions(['-sseof', '-0.1']) // ✅ must be input option
          .outputOptions([
            '-vframes', '1',  // extract 1 frame
            '-q:v', '2'       // high quality - NO scaling or padding
          ])
          .output(framePath)
          .on('start', (commandLine) => {
            console.log(`🖼️ Starting FFmpeg frame extraction (full resolution, no scaling): ${commandLine}`);
          })
          .on('end', async () => {
            try {
              const frameBuffer = fs.readFileSync(framePath);
              const frameGcsPath = `reels/frames/content_${contentId}/segment_${segmentNumber}_last_frame.jpg`;
              const frameFile = storage.bucket(bucketName).file(frameGcsPath);
      
              await frameFile.save(frameBuffer, {
                contentType: 'image/jpeg',
                metadata: {
                  contentId: contentId.toString(),
                  segmentNumber: segmentNumber.toString(),
                  extractedAt: new Date().toISOString(),
                },
              });
      
              const frameGcsUri = `gs://${bucketName}/${frameGcsPath}`;
              console.log(`✅ Last frame extracted and uploaded: ${frameGcsUri}`);
      
              fs.unlinkSync(tempVideoPath);
              fs.unlinkSync(framePath);
      
              resolve(frameGcsUri);
            } catch (error) {
              console.error('❌ Failed to upload frame to GCS:', error);
              reject(error);
            }
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg frame extraction failed:', err);
            reject(err);
          })
          .run();
      });
    } catch (error) {
      console.error('❌ Frame extraction failed:', error);
      throw error;
    }
  }

  async checkVideoGenerationStatus(operationName: string): Promise<VertexAIMediaResponse> {
    try {
      const accessToken = await this.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get access token from ADC');
      }

      const response = await fetch(
        `https://${this.vertexAiLocation}-aiplatform.googleapis.com/v1/projects/${this.vertexAiProjectId}/locations/${this.vertexAiLocation}/publishers/google/models/veo-3.0-generate-001:fetchPredictOperation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operationName: operationName
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Vertex AI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      // Comprehensive logging to debug response format
      console.log('🔍 Full response keys:', Object.keys(data).join(', '));
      console.log('🔍 Response done status:', data.done);
      
      if (data.done) {
        // Check for RAI (Responsible AI) filtering
        if (data.response?.raiMediaFilteredCount > 0 || data.response?.raiMediaFilteredReasons) {
          const reasons = data.response.raiMediaFilteredReasons || [];
          console.log('⚠️  Video blocked by safety filters:', reasons.join(', '));
          
          return {
            success: false,
            error: `Video generation blocked by safety filters: ${reasons.join(', ')}`,
            metadata: {
              generationTime: Date.now(),
              model: 'veo-3.0-generate-001',
              parameters: {},
              operationName: operationName,
              status: 'FILTERED',
              raiFiltered: true,
              raiReasons: reasons,
            },
          };
        }
        
        // Operation completed - check all possible locations for video data
        
        // Try to find video data in multiple locations
        const possiblePaths = [
          data.videos,
          data.response?.videos,
          data.response?.predictions,
          data.predictions,
          data.result?.videos,
          data.result?.predictions,
        ];
        
        for (const videoData of possiblePaths) {
          if (!videoData) continue;
          
          // Log what we found
          if (Array.isArray(videoData)) {
            console.log('📹 Found video array with', videoData.length, 'items');
            if (videoData.length > 0) {
              console.log('📹 First video keys:', Object.keys(videoData[0]).join(', '));
              
              const firstVideo = videoData[0];
              
              // Check for bytesBase64Encoded
              if (firstVideo.bytesBase64Encoded) {
                console.log('✅ Found bytesBase64Encoded video data');
                const videoBuffer = Buffer.from(firstVideo.bytesBase64Encoded, 'base64');
                return {
                  success: true,
                  mediaData: videoBuffer,
                  metadata: {
                    generationTime: Date.now(),
                    model: 'veo-3.0-generate-001',
                    parameters: {},
                    operationName: operationName,
                    status: 'COMPLETED',
                  },
                };
              }
              
              // Check for gcsUri (official workflow - Veo stored video directly in GCS)
              if (firstVideo.gcsUri) {
                console.log('✅ Found gcsUri (Veo stored directly in GCS):', firstVideo.gcsUri);
                
                // DON'T download - just return the GCS URI
                // The ExtendedVideoGenerationService will use this URI for the next segment
                // and only download all segments at the end for concatenation
                return {
                  success: true,
                  mediaData: undefined, // No buffer - video is in GCS
                  metadata: {
                    generationTime: Date.now(),
                    model: 'veo-3.0-generate-001',
                    parameters: {},
                    operationName: operationName,
                    status: 'COMPLETED',
                    gcsUri: firstVideo.gcsUri, // Use Veo's GCS URI directly
                  },
                };
              }
            }
          } else if (typeof videoData === 'object' && videoData !== null) {
            console.log('📹 Found video object with keys:', Object.keys(videoData).join(', '));
            
            if (videoData.bytesBase64Encoded) {
              console.log('✅ Found bytesBase64Encoded video data');
              const videoBuffer = Buffer.from(videoData.bytesBase64Encoded, 'base64');
              return {
                success: true,
                mediaData: videoBuffer,
                metadata: {
                  generationTime: Date.now(),
                  model: 'veo-3.0-generate-001',
                  parameters: {},
                  operationName: operationName,
                  status: 'COMPLETED',
                },
              };
            }
            
            if (videoData.gcsUri) {
              console.log('✅ Found gcsUri (Veo stored directly in GCS):', videoData.gcsUri);
              
              // DON'T download - just return the GCS URI
              return {
                success: true,
                mediaData: undefined, // No buffer - video is in GCS
                metadata: {
                  generationTime: Date.now(),
                  model: 'veo-3.0-generate-001',
                  parameters: {},
                  operationName: operationName,
                  status: 'COMPLETED',
                  gcsUri: videoData.gcsUri, // Use Veo's GCS URI directly
                },
              };
            }
          }
        }
        
        // If we get here, log the full response for debugging
        console.error('❌ Could not find video data in response. Full data:', JSON.stringify(data, null, 2));
        
        return {
          success: false,
          error: 'Video generation completed but no video data found in any expected location',
          metadata: {
            generationTime: Date.now(),
            model: 'veo-3.0-generate-001',
            parameters: {},
            operationName: operationName,
            status: 'COMPLETED',
          },
        };
      } else {
        // Operation still running
        
        return {
          success: true,
          mediaData: undefined,
          metadata: {
            generationTime: Date.now(),
            model: 'veo-3.0-generate-001',
            parameters: {},
            operationName: operationName,
            status: 'RUNNING',
          },
        };
      }
    } catch (error) {
      console.error('Error checking video generation status:', error);
      return {
        success: false,
        error: error.message || 'Failed to check video generation status',
      };
    }
  }

  private buildImagePrompt(request: VertexAIImageRequest): string {
    const { prompt, style, mood, visualElements, targetAudience } = request;
    
    return `Create a high-quality, realistic image with the following specifications:

Content: ${prompt}
Style: ${style}
Mood: ${mood}
Visual Elements: ${visualElements.join(', ')}
Target Audience: ${targetAudience}

Requirements:
- High resolution and photorealistic quality
- Professional composition and lighting
- Engaging and visually appealing
- Suitable for social media content
- Clear and focused subject matter
- Excellent color balance and contrast

Generate an image that perfectly captures the described content with the specified style and mood.`;
  }

  private buildVideoPrompt(request: VertexAIVideoRequest): string {
    // Simplified prompts for better Veo 3 compatibility
    if (request.referenceImageGcsUri) {
      // Continuation segment - simple and direct
      return `Continue the scene: ${request.prompt}`;
    } else {
      // First segment - establish baseline
      return `Create a professional video: ${request.prompt}`;
    }
  }

}
