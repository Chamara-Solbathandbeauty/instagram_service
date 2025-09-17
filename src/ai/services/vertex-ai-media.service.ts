import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';

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
  };
}

@Injectable()
export class VertexAIMediaService {
  private readonly vertexAiProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
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
      
      // Get access token using ADC
      const accessToken = await this.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get access token from ADC');
      }
      
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
             instances: [{
               prompt: enhancedPrompt,
               parameters: {
                 videoLength: request.duration || 15,
                 aspectRatio: request.aspectRatio || "9:16",
                 safetyFilterLevel: "block_some"
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
      
      // Handle long-running operation response
      if (data.name) {
        // This is a long-running operation - we need to monitor it
        console.log('Video generation operation started:', data.name);
        
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
      console.error('Vertex AI Video Generation Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate video',
      };
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
      
      // Check for videos key and log its keys
      let videosData = null;
      
      if (data.videos) {
        videosData = data.videos;
      } else if (data.response && data.response.videos) {
        videosData = data.response.videos;
      }
      
      if (videosData) {
        console.log('Videos keys:', Array.isArray(videosData) ? 
          (videosData as any[]).map((video, index) => `Video ${index + 1}: ${Object.keys(video).join(', ')}`).join(' | ') :
          Object.keys(videosData).join(', ')
        );
      }
      
      if (data.done) {
        // Operation completed
        
        // Check for base64 encoded video data in videos array
        const videosToCheck = [
          data.videos,
          data.response?.videos
        ];
        
        for (const videosData of videosToCheck) {
          if (videosData) {
            if (Array.isArray(videosData)) {
              // Handle videos as an array - check first video
              if (videosData.length > 0) {
                const firstVideo = videosData[0];
                
                if (firstVideo.bytesBase64Encoded) {
                  // Handle base64 encoded video data
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
              }
            } else if (typeof videosData === 'object' && videosData !== null) {
              // Handle videos as an object
              if (videosData.bytesBase64Encoded) {
                // Handle base64 encoded video data
                const videoBuffer = Buffer.from(videosData.bytesBase64Encoded, 'base64');
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
            }
          }
        }
        
        return {
          success: false,
          error: 'Video generation completed but no video data found',
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
    const { prompt, style, mood, visualElements, targetAudience, duration, aspectRatio } = request;
    
    return `Create a high-quality, realistic video with the following specifications:

Content: ${prompt}
Style: ${style}
Mood: ${mood}
Visual Elements: ${visualElements.join(', ')}
Target Audience: ${targetAudience}
Duration: ${duration || 15} seconds
Aspect Ratio: ${aspectRatio || '9:16'}

Requirements:
- High resolution and smooth motion
- Professional cinematography
- Engaging visual storytelling
- Suitable for social media content
- Clear and focused narrative
- Excellent lighting and composition
- Smooth transitions and movements

Generate a video that perfectly captures the described content with the specified style and mood.`;
  }

}
