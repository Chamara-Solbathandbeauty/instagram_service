import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  UseGuards, 
  HttpException, 
  HttpStatus,
  Param,
  ParseIntPipe,
  Res
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { InstagramGraphService } from './instagram-graph.service';
import { InstagramPostingService } from './instagram-posting.service';
import { IgAccount } from '../users/ig-account.entity';
import { Content, ContentStatus } from '../content/content.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('auth/instagram')
export class InstagramController {
  constructor(
    private readonly instagramGraphService: InstagramGraphService,
    private readonly instagramPostingService: InstagramPostingService,
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
  ) {}

  /**
   * Generate Instagram OAuth authorization URL
   */
  @Get('auth-url/:accountId')
  @UseGuards(JwtAuthGuard)
  async getAuthUrl(
    @GetUser() user: User,
    @Param('accountId', ParseIntPipe) accountId: number,
  ) {
    // Verify the account belongs to the user
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    const authData = this.instagramGraphService.generateAuthUrl(user.id, accountId);
    
    return {
      authUrl: authData.authUrl,
      state: authData.state,
    };
  }

  /**
   * Handle Instagram OAuth callback
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new HttpException('Missing required parameters', HttpStatus.BAD_REQUEST);
    }

    try {
      // Decode the state to get userId and accountId
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { userId, accountId } = stateData;

      if (!userId || !accountId) {
        throw new HttpException('Invalid state parameter', HttpStatus.BAD_REQUEST);
      }

      // Verify the account belongs to the user
      const account = await this.igAccountRepository.findOne({
        where: { id: parseInt(accountId), userId: userId },
      });

      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      // Exchange code for access token
      const tokenResponse = await this.instagramGraphService.exchangeCodeForToken(code, state);
      
      // Get long-lived token
      const longLivedToken = await this.instagramGraphService.getLongLivedToken(tokenResponse.access_token);

      console.log('Long-lived token:', longLivedToken);
      
      // Use the NEW 2024 Instagram API - Direct access without Facebook Pages!
      let instagramAccountId: string | null = null;
      let facebookPageId: string | null = null;
      let instagramInfo: any = null;

      console.log('Using NEW 2024 Instagram API - Direct access without Facebook Pages');
      
      // Try direct Instagram access first (2024 API supports posting directly)
      try {
        console.log('Attempting direct Instagram account access');
        instagramInfo = await this.instagramGraphService.getInstagramAccountInfo(
          'me',
          longLivedToken.access_token,
        );
        instagramAccountId = instagramInfo.id;
        console.log('Direct Instagram access successful - posting supported!');
      } catch (directError) {
        console.log('Direct Instagram access failed, trying Facebook Page fallback:', directError.message);
        
        // Fallback to traditional Facebook Page method (for older setups)
        try {
          const pages = await this.instagramGraphService.getUserPages(longLivedToken.access_token);
          console.log('Found pages:', pages.length);
          
          // Find the page with Instagram business account
          for (const page of pages) {
            console.log(`Checking page: ${page.name} (ID: ${page.id})`);
            if (page.instagram_business_account) {
              instagramAccountId = page.instagram_business_account.id;
              facebookPageId = page.id;
              console.log(`Found Instagram Business Account: ${instagramAccountId} linked to page: ${facebookPageId}`);
              break;
            }
          }
        } catch (pageError) {
          console.log('Facebook Page method also failed:', pageError.message);
        }
      }

      if (!instagramAccountId) {
        throw new HttpException(
          'No Instagram account found. Please ensure your Instagram account is set as Professional (Business or Creator) account type.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get Instagram account information if not already retrieved
      if (!instagramInfo) {
        instagramInfo = await this.instagramGraphService.getInstagramAccountInfo(
          instagramAccountId,
          longLivedToken.access_token,
        );
      }

      // Update the account with Instagram information
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + longLivedToken.expires_in);

      await this.igAccountRepository.update(account.id, {
        instagramAccountId: instagramAccountId,
        facebookPageId: facebookPageId,
        accessToken: longLivedToken.access_token,
        tokenExpiresAt: tokenExpiresAt,
        isConnected: true,
        username: instagramInfo.username,
        profilePictureUrl: instagramInfo.profile_picture_url,
        followersCount: instagramInfo.followers_count,
        followingCount: instagramInfo.follows_count,
        mediaCount: instagramInfo.media_count,
      });

      // Redirect to frontend with success message
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/dashboard/ig-accounts?instagram_connected=true&account_id=${account.id}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Instagram callback error:', error);
      
      // Redirect to frontend with error message
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = encodeURIComponent(error.message || 'Failed to connect Instagram account');
      const redirectUrl = `${frontendUrl}/dashboard/ig-accounts?instagram_error=${errorMessage}`;
      
      res.redirect(redirectUrl);
    }
  }

  /**
   * Disconnect Instagram account
   */
  @Post('disconnect/:accountId')
  @UseGuards(JwtAuthGuard)
  async disconnectAccount(
    @GetUser() user: User,
    @Param('accountId', ParseIntPipe) accountId: number,
  ) {
    // Verify the account belongs to the user
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    // Clear Instagram connection data
    await this.igAccountRepository.update(account.id, {
      instagramAccountId: null,
      facebookPageId: null,
      accessToken: null,
      tokenExpiresAt: null,
      isConnected: false,
      username: null,
      profilePictureUrl: null,
      followersCount: 0,
      followingCount: 0,
      mediaCount: 0,
    });

    return {
      success: true,
      message: 'Instagram account disconnected successfully',
    };
  }

  /**
   * Get Instagram account status
   */
  @Get('status/:accountId')
  @UseGuards(JwtAuthGuard)
  async getAccountStatus(
    @GetUser() user: User,
    @Param('accountId', ParseIntPipe) accountId: number,
  ) {
    // Verify the account belongs to the user
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    // Check if token is still valid
    let isTokenValid = false;
    if (account.accessToken) {
      isTokenValid = await this.instagramGraphService.validateAccessToken(account.accessToken);
    }

    return {
      isConnected: account.isConnected,
      isTokenValid: isTokenValid,
      username: account.username,
      followersCount: account.followersCount,
      followingCount: account.followingCount,
      mediaCount: account.mediaCount,
      profilePictureUrl: account.profilePictureUrl,
      needsReconnection: account.isConnected && !isTokenValid,
    };
  }

  /**
   * Post content to Instagram
   */
  @Post('post')
  @UseGuards(JwtAuthGuard)
  async postContent(
    @GetUser() user: User,
    @Body() postData: { contentId: number; accountId: number },
  ) {
    const { contentId, accountId } = postData;

    // Verify the account belongs to the user
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    if (!account.isConnected || !account.accessToken || !account.instagramAccountId) {
      throw new HttpException('Instagram account not connected', HttpStatus.BAD_REQUEST);
    }

    try {
      // Get the content with its media
      const content = await this.contentRepository.findOne({
        where: { id: contentId, accountId: accountId },
        relations: ['media', 'account'],
      });

      if (!content) {
        throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
      }

      if (content.status === ContentStatus.PUBLISHED) {
        throw new HttpException('Content has already been published', HttpStatus.BAD_REQUEST);
      }

      if (!content.media || content.media.length === 0) {
        throw new HttpException('Content has no media files to post', HttpStatus.BAD_REQUEST);
      }

      // Use the first media file for posting
      const primaryMedia = content.media[0];
      
      // Prepare caption with hashtags
      let caption = content.caption || '';
      if (content.hashTags && content.hashTags.length > 0) {
        const hashtagsText = content.hashTags.map(tag => `#${tag}`).join(' ');
        caption = caption ? `${caption}\n\n${hashtagsText}` : hashtagsText;
      }

      // Post to Instagram using the posting service
      const result = await this.instagramPostingService.postToInstagram({
        accountId: accountId,
        mediaId: primaryMedia.id,
        caption: caption,
        hashtags: content.hashTags,
      });

      if (result.success) {
        // Update content status to published
        await this.contentRepository.update(contentId, {
          status: ContentStatus.PUBLISHED,
        });

        return {
          success: true,
          message: 'Content posted to Instagram successfully',
          contentId,
          accountId,
          instagramMediaId: result.instagramMediaId,
        };
      } else {
        throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      console.error('Instagram post error:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        error.message || 'Failed to post content to Instagram',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Test Instagram connection
   */
  @Post('test/:accountId')
  @UseGuards(JwtAuthGuard)
  async testConnection(
    @GetUser() user: User,
    @Param('accountId', ParseIntPipe) accountId: number,
  ) {
    // Verify the account belongs to the user
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    if (!account.isConnected || !account.accessToken || !account.instagramAccountId) {
      throw new HttpException('Instagram account not connected', HttpStatus.BAD_REQUEST);
    }

    try {
      // Test the connection by getting account info
      const instagramInfo = await this.instagramGraphService.getInstagramAccountInfo(
        account.instagramAccountId,
        account.accessToken,
      );

      return {
        success: true,
        message: 'Instagram connection is working',
        accountInfo: instagramInfo,
      };
    } catch (error) {
      console.error('Instagram test connection error:', error);
      throw new HttpException(
        'Instagram connection test failed. Please reconnect your account.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
