import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';

export interface InstagramAuthUrl {
  authUrl: string;
  state: string;
}

export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id?: string;
}

export interface InstagramBusinessTokenResponse {
  data: Array<{
    access_token: string;
    user_id: string;
    permissions: string;
  }>;
}

export interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface InstagramAccountInfo {
  id: string;
  username: string;
  account_type: string;
  media_count: number;
  followers_count: number;
  follows_count: number;
  profile_picture_url: string | null;
}

export interface InstagramMediaUpload {
  creation_id: string;
}

export interface InstagramMediaPublish {
  id: string;
}

@Injectable()
export class InstagramGraphService {
  private readonly baseUrl = 'https://graph.instagram.com';
  private readonly authUrl = 'https://www.instagram.com/oauth/authorize';
  private readonly tokenUrl = 'https://api.instagram.com/oauth/access_token';
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;

  constructor(private configService: ConfigService) {
    // Use Instagram Business Login credentials
    this.appId = this.configService.get<string>('INSTAGRAM_APP_ID') || '';
    this.appSecret = this.configService.get<string>('INSTAGRAM_APP_SECRET') || '';
    this.redirectUri = this.configService.get<string>('INSTAGRAM_REDIRECT_URI') || 'http://localhost:3001/auth/instagram/callback';
    
  }

  /**
   * Generate Instagram Business Login authorization URL
   */
  generateAuthUrl(userId: string, accountId: number): InstagramAuthUrl {
    const state = Buffer.from(JSON.stringify({ userId, accountId, timestamp: Date.now() })).toString('base64');
    
    // Instagram Business Login - Use new Instagram scopes
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments',
      response_type: 'code',
      state: state,
    });

    // Use Instagram Business Login URL
    const authUrl = `${this.authUrl}?${params.toString()}`;

    return {
      authUrl: authUrl,
      state: state,
    };
  }

  /**
   * Exchange authorization code for short-lived access token (Instagram Business Login)
   */
  async exchangeCodeForToken(code: string, state: string): Promise<any> {
    try {
      
      // Ensure redirect_uri is NOT URL-encoded for token exchange (Instagram expects raw URI)
      const tokenParams = {
        client_id: this.appId,
        client_secret: this.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri, // Raw URI, not URL-encoded
        code: code,
      };
      

      // Try alternative approach: send as form data without manual URL encoding
      const formData = new FormData();
      formData.append('client_id', tokenParams.client_id);
      formData.append('client_secret', tokenParams.client_secret);
      formData.append('grant_type', tokenParams.grant_type);
      formData.append('redirect_uri', tokenParams.redirect_uri);
      formData.append('code', tokenParams.code);
      
      
      try {
        const response = await axios.post('https://api.instagram.com/oauth/access_token', formData);
        return response.data;
      } catch (formError) {
        
        // Fallback to URLSearchParams approach
        const response = await axios.post('https://api.instagram.com/oauth/access_token', 
          new URLSearchParams(tokenParams).toString(), 
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        return response.data;
      }
    } catch (error) {
      console.error('Error exchanging code for Instagram token:');
      console.error('- Status:', error.response?.status);
      console.error('- Data:', error.response?.data);
      console.error('- Message:', error.message);
      throw new HttpException(
        'Failed to exchange authorization code for Instagram access token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Exchange short-lived token for long-lived token (Instagram Business Login)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<InstagramLongLivedTokenResponse> {
    try {
      
      // Use direct Instagram long-lived token exchange
      const response = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.appSecret,
          access_token: shortLivedToken,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error getting long-lived Instagram token:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to get long-lived Instagram access token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Refresh long-lived access token (Instagram Business Login)
   */
  async refreshLongLivedToken(longLivedToken: string): Promise<InstagramLongLivedTokenResponse> {
    try {
      
      const response = await axios.get('https://graph.instagram.com/refresh_access_token', {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: longLivedToken,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error refreshing Instagram token:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to refresh Instagram access token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get user's Facebook pages
   */
  async getUserPages(accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,instagram_business_account',
        },
      });

      return response.data.data;
    } catch (error) {
      console.error('Error getting user pages:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to get user pages',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get Instagram account information (NEW 2024 Direct Instagram API)
   */
  async getInstagramAccountInfo(instagramAccountId: string, accessToken: string): Promise<InstagramAccountInfo> {
    try {
      
      // Use direct Instagram Graph API endpoint (not Facebook)
      const endpoint = instagramAccountId === 'me' ? 'me' : instagramAccountId;
      const response = await axios.get(`https://graph.instagram.com/${endpoint}`, {
        params: {
          fields: 'id,username,account_type,media_count,followers_count,follows_count',
          access_token: accessToken,
        },
      });

      
      // Return the actual data with defaults for missing fields
      return {
        id: response.data.id,
        username: response.data.username || 'instagram_user',
        account_type: response.data.account_type || 'BUSINESS',
        profile_picture_url: null, // Not available in 2024 API without additional permissions
        media_count: response.data.media_count || 0,
        followers_count: response.data.followers_count || 0,
        follows_count: response.data.follows_count || 0
      };
    } catch (error) {
      console.error('Error getting Instagram account info (2024 API):', error.response?.data || error.message);
      throw new HttpException(
        'Failed to get Instagram account information',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Check if Instagram account has posting permissions (NEW 2024 Direct Instagram API)
   */
  async checkPostingPermissions(instagramAccountId: string, accessToken: string): Promise<boolean> {
    try {
      
      // Use direct Instagram Graph API to check permissions
      const response = await axios.get(`https://graph.instagram.com/${instagramAccountId}`, {
        params: {
          fields: 'id,account_type',
          access_token: accessToken,
        },
      });
      
      
      // Check if it's a Business or Creator account (required for posting)
      const accountType = response.data.account_type;
      const hasPostingPermissions = accountType === 'BUSINESS' || accountType === 'CREATOR';
      
      return hasPostingPermissions;
    } catch (error) {
      console.error('Error checking Instagram posting permissions (2024 API):', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Upload media to Instagram (NEW 2024 Direct Instagram API)
   */
  async uploadMedia(
    instagramAccountId: string,
    accessToken: string,
    mediaUrl: string,
    caption: string,
    mediaType: 'REELS' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
    altText?: string
  ): Promise<InstagramMediaUpload> {
    try {
      
      // Use direct Instagram Graph API endpoint
      const endpoint = instagramAccountId === 'me' ? 'me' : instagramAccountId;
      
      const requestData: any = {
        access_token: accessToken,
      };

      if (mediaType === 'IMAGE') {
        requestData.image_url = mediaUrl;
        requestData.media_type = 'IMAGE';
        
        // Add alt_text for images (new feature as of March 24, 2025)
        if (altText && altText.trim()) {
          requestData.alt_text = altText;
        }
      } else if (mediaType === 'VIDEO' || mediaType === 'REELS') {
        requestData.video_url = mediaUrl;
        requestData.media_type = mediaType;
      }

      // Only add caption if it's not empty
      if (caption && caption.trim()) {
        requestData.caption = caption;
      }
      
      
      const response = await axios.post(`https://graph.instagram.com/${endpoint}/media`, requestData);
      
      
      // Validate that we got an id (Instagram API returns 'id', not 'creation_id')
      if (!response.data.id) {
        console.error('No id in response:', response.data);
        throw new HttpException(
          'Instagram API did not return id',
          HttpStatus.BAD_REQUEST,
        );
      }
      
      // Return the response with id as creation_id for compatibility
      return {
        ...response.data,
        creation_id: response.data.id
      };
    } catch (error) {
      console.error('=== INSTAGRAM MEDIA UPLOAD ERROR ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      
      if (error.response) {
        console.error('HTTP Response Status:', error.response.status);
        console.error('HTTP Response Data:', JSON.stringify(error.response.data, null, 2));
        console.error('HTTP Response Headers:', error.response.headers);
      }
      
      console.error('Error Stack:', error.stack);
      console.error('=====================================');
      
      throw new HttpException(
        error.response?.data?.error?.message || error.message || 'Failed to upload media to Instagram',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Publish media to Instagram (NEW 2024 Direct Instagram API)
   */
  async publishMedia(
    instagramAccountId: string,
    accessToken: string,
    creationId: string,
    maxRetries: number = 3,
    retryDelay: number = 10000
  ): Promise<InstagramMediaPublish> {
    const endpoint = instagramAccountId === 'me' ? 'me' : instagramAccountId;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // First, check the container status before attempting to publish
        const status = await this.checkMediaStatus(instagramAccountId, accessToken, creationId);
        
        if (status?.status_code) {
          console.log(`Container status: ${status.status_code}`);
          
          switch (status.status_code) {
            case 'EXPIRED':
              throw new HttpException(
                'Media container has expired. Please upload again.',
                HttpStatus.BAD_REQUEST,
              );
            case 'ERROR':
              throw new HttpException(
                'Media container failed to process. Please try again.',
                HttpStatus.BAD_REQUEST,
              );
            case 'IN_PROGRESS':
              if (attempt < maxRetries) {
                console.log(`Media still processing (attempt ${attempt}/${maxRetries}). Waiting ${retryDelay/1000}s before retry...`);
                await this.delay(retryDelay);
                continue;
              } else {
                throw new HttpException(
                  'Media is still processing. Please try again in a few minutes.',
                  HttpStatus.BAD_REQUEST,
                );
              }
            case 'FINISHED':
            case 'PUBLISHED':
              // Container is ready, proceed with publishing
              break;
            default:
              console.log(`Unknown status: ${status.status_code}, attempting to publish anyway...`);
          }
        }

        const response = await axios.post(`https://graph.instagram.com/${endpoint}/media_publish`, {
          creation_id: creationId,
          access_token: accessToken,
        });

        return response.data;
      } catch (error) {
        const errorData = error.response?.data;
        
        // Check if it's the "Media ID is not available" error (video processing)
        if (errorData?.error?.code === 9007 && errorData?.error?.error_subcode === 2207027) {
          if (attempt < maxRetries) {
            console.log(`Video processing not complete (attempt ${attempt}/${maxRetries}). Waiting ${retryDelay/1000}s before retry...`);
            await this.delay(retryDelay);
            continue;
          } else {
            console.error('Video processing timeout after maximum retries');
            throw new HttpException(
              'Video is still processing. Please try again in a few minutes.',
              HttpStatus.BAD_REQUEST,
            );
          }
        }
        
        // For other errors, throw immediately
        console.error('Error publishing media to Instagram (2024 Direct API):', errorData || error.message);
        throw new HttpException(
          errorData?.error?.message || 'Failed to publish media to Instagram',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check media processing status
   */
  async checkMediaStatus(
    instagramAccountId: string,
    accessToken: string,
    creationId: string
  ): Promise<any> {
    try {
      const endpoint = instagramAccountId === 'me' ? 'me' : instagramAccountId;
      const response = await axios.get(`https://graph.instagram.com/${creationId}`, {
        params: {
          fields: 'id,status_code,status',
          access_token: accessToken,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error checking media status:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Post a Reel to Instagram
   */
  async postReel(
    instagramAccountId: string,
    accessToken: string,
    videoUrl: string,
    caption: string
  ): Promise<InstagramMediaPublish> {
    try {
      console.log('Starting video upload to Instagram...');
      
      // Step 1: Upload the video
      const uploadResult = await this.uploadMedia(
        instagramAccountId,
        accessToken,
        videoUrl,
        caption,
        'REELS'
      );

      console.log('Video upload successful, creation_id:', uploadResult.creation_id);
      console.log('Starting video publishing with retry logic...');

      // Step 2: Publish the video with retry logic for processing
      const publishResult = await this.publishMedia(
        instagramAccountId,
        accessToken,
        uploadResult.creation_id,
        5, // Max 5 retries for videos
        15000 // Wait 15 seconds between retries
      );

      console.log('Video published successfully:', publishResult.id);
      return publishResult;
    } catch (error) {
      console.error('Error posting reel:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to post reel to Instagram',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Post an image to Instagram
   */
  async postImage(
    instagramAccountId: string,
    accessToken: string,
    imageUrl: string,
    caption: string,
    altText?: string
  ): Promise<InstagramMediaPublish> {
    try {
      // Step 1: Upload the image
      const uploadResult = await this.uploadMedia(
        instagramAccountId,
        accessToken,
        imageUrl,
        caption,
        'IMAGE',
        altText
      );

      // Step 2: Publish the image
      const publishResult = await this.publishMedia(
        instagramAccountId,
        accessToken,
        uploadResult.creation_id
      );

      return publishResult;
    } catch (error) {
      console.error('Error posting image:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to post image to Instagram',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Post a Story to Instagram
   */
  async postStory(
    instagramAccountId: string,
    accessToken: string,
    mediaUrl: string,
    mediaType: 'IMAGE' | 'VIDEO'
  ): Promise<InstagramMediaPublish> {
    try {
      console.log('Starting story upload to Instagram...');
      
      // Step 1: Upload the story media
      const uploadResult = await this.uploadMedia(
        instagramAccountId,
        accessToken,
        mediaUrl,
        '', // Stories don't have captions
        mediaType
      );

      console.log('Story upload successful, creation_id:', uploadResult.creation_id);
      console.log('Starting story publishing...');

      // Step 2: Publish the story
      const publishResult = await this.publishMedia(
        instagramAccountId,
        accessToken,
        uploadResult.creation_id,
        3, // Max 3 retries for stories
        10000 // Wait 10 seconds between retries
      );

      console.log('Story published successfully:', publishResult.id);
      return publishResult;
    } catch (error) {
      console.error('Error posting story:', error.response?.data || error.message);
      throw new HttpException(
        'Failed to post story to Instagram',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Check if access token is valid
   */
  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/me`, {
        params: {
          access_token: accessToken,
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshAccessToken(igAccount: IgAccount): Promise<string | null> {
    if (!igAccount.accessToken) {
      return null;
    }

    const isValid = await this.validateAccessToken(igAccount.accessToken);
    if (isValid) {
      return igAccount.accessToken;
    }

    // Token is invalid, user needs to reconnect
    return null;
  }
}
