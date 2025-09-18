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
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { Content, ContentStatus } from '../content/entities/content.entity';
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
   * Fix missing Instagram account ID for existing accounts
   */
  @Post('fix-account/:accountId')
  @UseGuards(JwtAuthGuard)
  async fixAccount(
    @GetUser() user: User,
    @Param('accountId', ParseIntPipe) accountId: number,
  ) {
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    if (!account.isConnected || !account.accessToken) {
      throw new HttpException('Account not connected or no access token', HttpStatus.BAD_REQUEST);
    }

    try {
      // Try to get Instagram account info using the access token
      const instagramInfo = await this.instagramGraphService.getInstagramAccountInfo(
        'me',
        account.accessToken,
      );

      console.log('Retrieved Instagram info:', instagramInfo);

      // Update the account with the Instagram account ID
      await this.igAccountRepository.update(account.id, {
        instagramAccountId: instagramInfo.id,
        instagramUsername: instagramInfo.username,
        username: instagramInfo.username,
        followersCount: instagramInfo.followers_count,
        followingCount: instagramInfo.follows_count,
        mediaCount: instagramInfo.media_count,
      });

      return {
        success: true,
        message: 'Account fixed successfully',
        instagramAccountId: instagramInfo.id,
        username: instagramInfo.username,
      };
    } catch (error) {
      console.error('Error fixing account:', error);
      throw new HttpException(
        'Failed to fix account. Please reconnect your Instagram account.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Debug endpoint to check content and account for posting (no auth required)
   */
  @Get('debug-post/:contentId/:accountId')
  async debugPost(
    @Param('contentId', ParseIntPipe) contentId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
  ) {
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      return { error: 'Account not found', accountId };
    }

    const content = await this.contentRepository.findOne({
      where: { id: contentId, accountId: accountId },
      relations: ['media', 'account'],
    });

    if (!content) {
      return { error: 'Content not found', contentId, accountId };
    }

    return {
      account: {
        id: account.id,
        name: account.name,
        isConnected: account.isConnected,
        hasAccessToken: !!account.accessToken,
        hasInstagramAccountId: !!account.instagramAccountId,
        instagramAccountId: account.instagramAccountId,
        instagramUsername: account.instagramUsername,
        username: account.username,
      },
      content: {
        id: content.id,
        caption: content.caption,
        status: content.status,
        mediaCount: content.media?.length || 0,
        hashTags: content.hashTags,
        media: content.media?.map(m => ({
          id: m.id,
          fileName: m.fileName,
          filePath: m.filePath,
          mediaType: m.mediaType,
          mimeType: m.mimeType
        })) || []
      }
    };
  }

  /**
   * Debug endpoint to check account status (no auth required)
   */
  @Get('debug-account/:accountId')
  async debugAccount(@Param('accountId', ParseIntPipe) accountId: number) {
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      return { error: 'Account not found', accountId };
    }

    return {
      accountId: account.id,
      name: account.name,
      isConnected: account.isConnected,
      hasAccessToken: !!account.accessToken,
      hasInstagramAccountId: !!account.instagramAccountId,
      instagramAccountId: account.instagramAccountId,
      instagramUsername: account.instagramUsername,
      username: account.username,
      tokenExpiresAt: account.tokenExpiresAt,
      userId: account.userId
    };
  }

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
      
      // Extract the first token from the response
      const shortLivedToken = tokenResponse.data[0];
      console.log('Short-lived token response:', shortLivedToken);
      
      // Get long-lived token
      const longLivedToken = await this.instagramGraphService.getLongLivedToken(shortLivedToken.access_token);

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
        console.log('Instagram Account ID:', instagramAccountId);
        console.log('Instagram Info:', instagramInfo);
      } catch (directError) {
        console.log('Direct Instagram access failed:', directError.message);
        console.log('Error details:', directError.response?.data);
        console.log('Trying Facebook Page fallback...');
        
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
        console.log('No Instagram account ID found, checking token response...');
        
        // Check if we have the Instagram account ID from the token response
        if (shortLivedToken.user_id) {
          instagramAccountId = shortLivedToken.user_id;
          console.log('Using Instagram account ID from token response:', instagramAccountId);
        } else {
          console.log('Token response:', tokenResponse);
          throw new HttpException(
            'No Instagram account found. Please ensure your Instagram account is set as Professional (Business or Creator) account type.',
            HttpStatus.BAD_REQUEST,
          );
        }
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

      console.log('=== UPDATING ACCOUNT WITH INSTAGRAM INFO ===');
      console.log('Account ID:', account.id);
      console.log('Instagram Info:', instagramInfo);
      console.log('Username to save:', instagramInfo.username);
      console.log('Instagram Account ID:', instagramAccountId);
      console.log('============================================');

      await this.igAccountRepository.update(account.id, {
        instagramAccountId: instagramAccountId,
        instagramUserId: instagramAccountId,
        facebookPageId: facebookPageId,
        accessToken: longLivedToken.access_token,
        tokenExpiresAt: tokenExpiresAt,
        isConnected: true,
        instagramUsername: instagramInfo.username,
        username: instagramInfo.username,
        profilePictureUrl: instagramInfo.profile_picture_url,
        followersCount: instagramInfo.followers_count,
        followingCount: instagramInfo.follows_count,
        mediaCount: instagramInfo.media_count,
      });

      console.log('Account updated successfully!');

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
    console.log('=== INSTAGRAM POST REQUEST ===');
    console.log('User ID:', user.id);
    console.log('Post Data:', postData);
    
    const { contentId, accountId } = postData;

    // Verify the account belongs to the user
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      console.log('Account not found for user:', user.id, 'account:', accountId);
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    console.log('Account found:', {
      id: account.id,
      name: account.name,
      isConnected: account.isConnected,
      hasAccessToken: !!account.accessToken,
      hasInstagramAccountId: !!account.instagramAccountId,
      instagramAccountId: account.instagramAccountId,
      instagramUsername: account.instagramUsername,
      username: account.username
    });

    if (!account.isConnected || !account.accessToken || !account.instagramAccountId) {
      console.log('Connection check failed:', {
        isConnected: account.isConnected,
        hasAccessToken: !!account.accessToken,
        hasInstagramAccountId: !!account.instagramAccountId
      });
      throw new HttpException('Instagram account not connected', HttpStatus.BAD_REQUEST);
    }

    try {
      console.log('Fetching content:', { contentId, accountId });
      
      // Get the content with its media
      const content = await this.contentRepository.findOne({
        where: { id: contentId, accountId: accountId },
        relations: ['media', 'account'],
      });

      if (!content) {
        console.log('Content not found:', { contentId, accountId });
        throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
      }

      console.log('Content found:', {
        id: content.id,
        caption: content.caption,
        status: content.status,
        mediaCount: content.media?.length || 0,
        hashTags: content.hashTags
      });

      if (content.status === ContentStatus.PUBLISHED) {
        console.log('Content already published:', content.id);
        throw new HttpException('Content has already been published', HttpStatus.BAD_REQUEST);
      }

      if (!content.media || content.media.length === 0) {
        console.log('Content has no media files:', content.id);
        throw new HttpException('Content has no media files to post', HttpStatus.BAD_REQUEST);
      }

      // Use the first media file for posting
      const primaryMedia = content.media[0];
      
      console.log('Primary media:', {
        id: primaryMedia.id,
        fileName: primaryMedia.fileName,
        filePath: primaryMedia.filePath,
        mediaType: primaryMedia.mediaType,
        mimeType: primaryMedia.mimeType
      });
      
      // Prepare caption with hashtags
      let caption = content.caption || '';
      if (content.hashTags && content.hashTags.length > 0) {
        const hashtagsText = content.hashTags.map(tag => `#${tag}`).join(' ');
        caption = caption ? `${caption}\n\n${hashtagsText}` : hashtagsText;
      }

      console.log('Prepared caption:', caption);
      console.log('Calling Instagram posting service...');

      // Post to Instagram using the posting service
      const result = await this.instagramPostingService.postToInstagram({
        accountId: accountId,
        mediaId: primaryMedia.id,
        caption: caption,
        hashtags: content.hashTags,
      });

      console.log('Posting service result:', result);

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
      console.error('=== INSTAGRAM POST ERROR ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      
      if (error.response) {
        console.error('HTTP Response Status:', error.response.status);
        console.error('HTTP Response Data:', error.response.data);
        console.error('HTTP Response Headers:', error.response.headers);
      }
      
      if (error instanceof HttpException) {
        console.error('Re-throwing HttpException:', error.getResponse());
        throw error;
      }
      
      console.error('================================');
      
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
    console.log('=== TEST CONNECTION REQUEST ===');
    console.log('User ID:', user.id);
    console.log('Account ID:', accountId);
    
    // Verify the account belongs to the user
    const account = await this.igAccountRepository.findOne({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      console.log('Account not found for user:', user.id, 'account:', accountId);
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }

    console.log('Account found:', {
      id: account.id,
      name: account.name,
      isConnected: account.isConnected,
      hasAccessToken: !!account.accessToken,
      hasInstagramAccountId: !!account.instagramAccountId,
      instagramAccountId: account.instagramAccountId,
      instagramUsername: account.instagramUsername,
      username: account.username,
      tokenExpiresAt: account.tokenExpiresAt
    });

    if (!account.isConnected || !account.accessToken || !account.instagramAccountId) {
      console.log('Connection check failed:', {
        isConnected: account.isConnected,
        hasAccessToken: !!account.accessToken,
        hasInstagramAccountId: !!account.instagramAccountId
      });
      throw new HttpException('Instagram account not connected', HttpStatus.BAD_REQUEST);
    }

    try {
      console.log('=== TESTING INSTAGRAM CONNECTION ===');
      console.log('Account ID:', account.id);
      console.log('Instagram Account ID:', account.instagramAccountId);
      console.log('Access Token:', account.accessToken ? `${account.accessToken.substring(0, 20)}...` : 'NOT SET');
      console.log('Token Expires At:', account.tokenExpiresAt);
      console.log('Is Connected:', account.isConnected);
      
      // Test the connection by getting account info
      const instagramInfo = await this.instagramGraphService.getInstagramAccountInfo(
        account.instagramAccountId,
        account.accessToken,
      );

      console.log('Test connection successful:', instagramInfo);
      console.log('=====================================');

      return {
        success: true,
        message: 'Instagram connection is working',
        accountInfo: instagramInfo,
      };
    } catch (error) {
      console.error('=== INSTAGRAM TEST CONNECTION ERROR ===');
      console.error('Error:', error.message);
      console.error('Response Status:', error.response?.status);
      console.error('Response Data:', error.response?.data);
      console.error('========================================');
      throw new HttpException(
        'Instagram connection test failed. Please reconnect your account.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
