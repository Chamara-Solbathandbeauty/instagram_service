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
    
    // Debug logging to help identify configuration issues
    console.log('Instagram Graph Service Configuration (2024 Direct API):');
    console.log('Instagram App ID:', this.appId ? `${this.appId.substring(0, 8)}...` : 'NOT SET');
    console.log('Instagram App Secret:', this.appSecret ? 'SET' : 'NOT SET');
    console.log('Redirect URI:', this.redirectUri || 'NOT SET');
    console.log('');
    console.log('📋 IMPORTANT: For 2024 Direct Instagram API, you need:');
    console.log('- Instagram Basic Display App credentials (not Facebook App)');
    console.log('- Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in .env');
    console.log('- App must have Instagram Basic Display product enabled');
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
    console.log('Generated Instagram Business Login Auth URL:', authUrl);
    console.log('Using redirect URI:', this.redirectUri);

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
      console.log('Attempting Instagram token exchange:');
      console.log('- App ID:', this.appId ? `${this.appId.substring(0, 8)}...` : 'NOT SET');
      console.log('- App Secret:', this.appSecret ? 'SET' : 'NOT SET');
      console.log('- Redirect URI (auth):', this.redirectUri);
      console.log('- Code:', code ? `${code.substring(0, 20)}...` : 'NOT SET');
      
      // Ensure redirect_uri is NOT URL-encoded for token exchange (Instagram expects raw URI)
      const tokenParams = {
        client_id: this.appId,
        client_secret: this.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri, // Raw URI, not URL-encoded
        code: code,
      };
      console.log('- Token exchange parameters:');
      console.log('  - client_id:', tokenParams.client_id ? `${tokenParams.client_id.substring(0, 8)}...` : 'NOT SET');
      console.log('  - redirect_uri (raw):', tokenParams.redirect_uri);
      console.log('  - grant_type:', tokenParams.grant_type);
      
      // Double-check what URLSearchParams will encode
      const encodedParams = new URLSearchParams(tokenParams);
      console.log('- Encoded parameters being sent:');
      console.log('  - redirect_uri (encoded):', encodedParams.get('redirect_uri'));

      // Try alternative approach: send as form data without manual URL encoding
      const formData = new FormData();
      formData.append('client_id', tokenParams.client_id);
      formData.append('client_secret', tokenParams.client_secret);
      formData.append('grant_type', tokenParams.grant_type);
      formData.append('redirect_uri', tokenParams.redirect_uri);
      formData.append('code', tokenParams.code);
      
      console.log('- Trying FormData approach for token exchange...');
      
      try {
        const response = await axios.post('https://api.instagram.com/oauth/access_token', formData);
        console.log('FormData approach successful!');
        return response.data;
      } catch (formError) {
        console.log('FormData approach failed, trying URLSearchParams...');
        
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
      console.log('Getting long-lived Instagram token (2024 API)');
      
      // Use direct Instagram long-lived token exchange
      const response = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.appSecret,
          access_token: shortLivedToken,
        },
      });

      console.log('Long-lived Instagram token exchange successful');
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
      console.log('Refreshing long-lived Instagram token');
      
      const response = await axios.get('https://graph.instagram.com/refresh_access_token', {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: longLivedToken,
        },
      });

      console.log('Instagram token refresh successful');
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
      console.log('Getting Instagram account info (2024 Direct API)');
      
      // Use direct Instagram Graph API endpoint (not Facebook)
      const endpoint = instagramAccountId === 'me' ? 'me' : instagramAccountId;
      const response = await axios.get(`https://graph.instagram.com/${endpoint}`, {
        params: {
          fields: 'id,username,account_type,media_count,followers_count,follows_count',
          access_token: accessToken,
        },
      });

      console.log('Instagram account info retrieved successfully:', response.data);
      
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
      console.log('Checking Instagram posting permissions (2024 Direct API)');
      
      // Use direct Instagram Graph API to check permissions
      const response = await axios.get(`https://graph.instagram.com/${instagramAccountId}`, {
        params: {
          fields: 'id,account_type',
          access_token: accessToken,
        },
      });
      
      console.log('Account permissions check (2024 API):', response.data);
      
      // Check if it's a Business or Creator account (required for posting)
      const accountType = response.data.account_type;
      const hasPostingPermissions = accountType === 'BUSINESS' || accountType === 'CREATOR';
      
      console.log(`Account type: ${accountType}, Has posting permissions: ${hasPostingPermissions}`);
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
    mediaType: 'REELS' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  ): Promise<InstagramMediaUpload> {
    try {
      console.log('Uploading media to Instagram (2024 Direct API)');
      
      // Use direct Instagram Graph API endpoint
      const endpoint = instagramAccountId === 'me' ? 'me' : instagramAccountId;
      
      const response = await axios.post(`https://graph.instagram.com/${endpoint}/media`, {
        media_type: mediaType,
        video_url: mediaType === 'REELS' || mediaType === 'VIDEO' ? mediaUrl : undefined,
        image_url: mediaType === 'IMAGE' ? mediaUrl : undefined,
        caption: caption,
        access_token: accessToken,
      });
      
      console.log('Media upload successful (2024 Direct API):', response.data);
      return response.data;
    } catch (error) {
      console.error('Error uploading media to Instagram (2024 Direct API):', error.response?.data || error.message);
      throw new HttpException(
        'Failed to upload media to Instagram',
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
    creationId: string
  ): Promise<InstagramMediaPublish> {
    try {
      console.log('Publishing media to Instagram (2024 Direct API)');
      
      // Use direct Instagram Graph API endpoint
      const endpoint = instagramAccountId === 'me' ? 'me' : instagramAccountId;
      
      const response = await axios.post(`https://graph.instagram.com/${endpoint}/media_publish`, {
        creation_id: creationId,
        access_token: accessToken,
      });

      console.log('Media publish successful (2024 Direct API):', response.data);
      return response.data;
    } catch (error) {
      console.error('Error publishing media to Instagram (2024 Direct API):', error.response?.data || error.message);
      throw new HttpException(
        'Failed to publish media to Instagram',
        HttpStatus.BAD_REQUEST,
      );
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
      // Step 1: Upload the video
      const uploadResult = await this.uploadMedia(
        instagramAccountId,
        accessToken,
        videoUrl,
        caption,
        'REELS'
      );

      // Step 2: Publish the video
      const publishResult = await this.publishMedia(
        instagramAccountId,
        accessToken,
        uploadResult.creation_id
      );

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
    caption: string
  ): Promise<InstagramMediaPublish> {
    try {
      // Step 1: Upload the image
      const uploadResult = await this.uploadMedia(
        instagramAccountId,
        accessToken,
        imageUrl,
        caption,
        'IMAGE'
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
