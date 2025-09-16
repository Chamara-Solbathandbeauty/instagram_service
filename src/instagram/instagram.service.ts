import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { ContentService } from '../content/content.service';

@Injectable()
export class InstagramService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private configService: ConfigService,
    private igAccountsService: IgAccountsService,
    private contentService: ContentService,
  ) {
    this.clientId = this.configService.get<string>('INSTAGRAM_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('INSTAGRAM_CLIENT_SECRET');
    this.redirectUri = this.configService.get<string>('INSTAGRAM_REDIRECT_URI');
  }

  async getAuthUrl(accountId: number, userId: number): Promise<{ authUrl: string }> {
    const account = await this.igAccountsService.findOne(accountId, userId);
    
    if (!this.clientId) {
      throw new BadRequestException('Instagram API not configured');
    }

    const scopes = 'instagram_basic,instagram_content_publish';
    const state = `${accountId}_${userId}_${Date.now()}`;
    
    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;

    return { authUrl };
  }

  async handleCallback(code: string, state: string): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Instagram API not configured');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_message || 'Failed to get access token');
      }

      // Get long-lived access token
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${this.clientSecret}&access_token=${tokenData.access_token}`,
        { method: 'GET' }
      );

      const longLivedData = await longLivedResponse.json();

      if (!longLivedResponse.ok) {
        throw new Error(longLivedData.error?.message || 'Failed to get long-lived token');
      }

      // Get user profile information
      const profileResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${longLivedData.access_token}`,
        { method: 'GET' }
      );

      const profileData = await profileResponse.json();

      if (!profileResponse.ok) {
        throw new Error(profileData.error?.message || 'Failed to get profile data');
      }

      // Parse state to get account ID
      const [accountId] = state.split('_');
      
      // Update the Instagram account with connection data
      const expiresAt = new Date(Date.now() + (longLivedData.expires_in * 1000));
      
      await this.igAccountsService.updateInstagramConnection(+accountId, {
        instagramUserId: profileData.id,
        instagramUsername: profileData.username,
        accessToken: longLivedData.access_token,
        tokenExpiresAt: expiresAt,
        isConnected: true,
      });

      return {
        success: true,
        instagram: {
          userId: profileData.id,
          username: profileData.username,
        },
      };
    } catch (error) {
      console.error('Instagram callback error:', error);
      throw new BadRequestException(`Instagram connection failed: ${error.message}`);
    }
  }

  async getStatus(accountId: number, userId: number): Promise<any> {
    const account = await this.igAccountsService.findOne(accountId, userId);

    return {
      isConnected: account.isConnected,
      instagramUsername: account.instagramUsername,
      instagramUserId: account.instagramUserId,
      tokenExpiresAt: account.tokenExpiresAt,
      needsReconnection: account.tokenExpiresAt && new Date() > account.tokenExpiresAt,
    };
  }

  async testConnection(accountId: number, userId: number): Promise<any> {
    const account = await this.igAccountsService.findOne(accountId, userId);

    if (!account.isConnected || !account.accessToken) {
      throw new BadRequestException('Instagram account not connected');
    }

    try {
      const response = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${account.accessToken}`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Connection test failed');
      }

      return {
        success: true,
        profile: data,
        message: 'Connection is working properly',
      };
    } catch (error) {
      console.error('Instagram connection test error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Connection test failed',
      };
    }
  }

  async disconnect(accountId: number, userId: number): Promise<any> {
    const account = await this.igAccountsService.findOne(accountId, userId);

    await this.igAccountsService.updateInstagramConnection(accountId, {
      instagramUserId: null,
      instagramUsername: null,
      accessToken: null,
      tokenExpiresAt: null,
      isConnected: false,
    });

    return {
      success: true,
      message: 'Instagram account disconnected successfully',
    };
  }

  async postContent(data: { contentId: number; accountId: number }, userId: number): Promise<any> {
    const account = await this.igAccountsService.findOne(data.accountId, userId);
    const content = await this.contentService.findOne(data.contentId, userId);

    if (!account.isConnected || !account.accessToken) {
      throw new BadRequestException('Instagram account not connected');
    }

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    try {
      // This is a simplified example - in a real implementation, you would:
      // 1. Upload media files if any
      // 2. Create the Instagram post using the Instagram Basic Display API
      // 3. Handle different content types (photo, video, carousel)

      // For now, we'll just simulate posting and update the content status
      await this.contentService.update(data.contentId, userId, {
        status: 'published' as any,
      });

      return {
        success: true,
        message: 'Content posted successfully',
        instagramPostId: `simulated_${Date.now()}`, // In real implementation, this would be the actual Instagram post ID
      };
    } catch (error) {
      console.error('Instagram posting error:', error);
      throw new BadRequestException(`Failed to post content: ${error.message}`);
    }
  }

  async refreshToken(accountId: number): Promise<void> {
    const account = await this.igAccountsService.findOneById(accountId);

    if (!account.accessToken) {
      return;
    }

    try {
      const response = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.accessToken}`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (response.ok && data.access_token) {
        const expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        
        await this.igAccountsService.updateInstagramConnection(accountId, {
          accessToken: data.access_token,
          tokenExpiresAt: expiresAt,
        });
      }
    } catch (error) {
      console.error('Token refresh error for account', accountId, error);
    }
  }
}

