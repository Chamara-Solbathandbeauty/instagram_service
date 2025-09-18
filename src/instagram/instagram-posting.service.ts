import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { InstagramGraphService } from './instagram-graph.service';
import { Media } from '../content/media.entity';

export interface PostToInstagramRequest {
  accountId: number;
  mediaId: number;
  caption: string;
  hashtags?: string[];
}

export interface PostToInstagramResponse {
  success: boolean;
  instagramMediaId?: string;
  message: string;
}

@Injectable()
export class InstagramPostingService {
  constructor(
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private instagramGraphService: InstagramGraphService,
  ) {}

  /**
   * Post media to Instagram
   */
  async postToInstagram(request: PostToInstagramRequest): Promise<PostToInstagramResponse> {
    try {
      // Get the Instagram account
      const account = await this.igAccountRepository.findOne({
        where: { id: request.accountId },
      });

      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      if (!account.isConnected || !account.accessToken || !account.instagramAccountId) {
        throw new HttpException(
          'Instagram account not connected. Please connect your Instagram account first.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate access token
      const isTokenValid = await this.instagramGraphService.validateAccessToken(account.accessToken!);
      if (!isTokenValid) {
        throw new HttpException(
          'Instagram access token is invalid. Please reconnect your Instagram account.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get the media file
      const media = await this.mediaRepository.findOne({
        where: { id: request.mediaId },
      });

      if (!media) {
        throw new HttpException('Media file not found', HttpStatus.NOT_FOUND);
      }

      // Construct the full media URL
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
      const mediaUrl = `${baseUrl}/uploads/media/${media.filePath}`;
      // public accessable media url for testing
      // const mediaUrl = 'https://photographylife.com/wp-content/uploads/2014/10/Nikon-D750-Sample-Image-36.jpg';  

      console.log('Posting to Instagram:');
      console.log('- Account ID:', account.id);
      console.log('- Instagram Account ID:', account.instagramAccountId);
      console.log('- Account Type:', account.type);
      console.log('- Facebook Page ID:', account.instagramUsername);
      console.log('- Access Token:', account.accessToken ? `${account.accessToken.substring(0, 20)}...` : 'NOT SET');
      console.log('- Media URL:', mediaUrl);
      console.log('- Media Type:', media.mediaType);

      // First, let's verify the account info with current token
      try {
        console.log('Verifying Instagram account access...');
        const accountInfo = await this.instagramGraphService.getInstagramAccountInfo(
          account.instagramAccountId!,
          account.accessToken!
        );
        console.log('Account verification successful:', accountInfo.id, accountInfo.username);
      } catch (verifyError) {
        console.error('Account verification failed:', verifyError.message);
        
        // Try with 'me' endpoint instead
        try {
          console.log('Trying verification with /me endpoint...');
          const accountInfo = await this.instagramGraphService.getInstagramAccountInfo(
            'me',
            account.accessToken!
          );
          console.log('Account verification with /me successful:', accountInfo.id, accountInfo.username);
        } catch (meError) {
          console.error('Account verification with /me also failed:', meError.message);
          throw new HttpException(
            'Cannot access Instagram account. Please reconnect your Instagram account.',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Check if media URL is accessible
      try {
        const response = await fetch(mediaUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new HttpException(
            `Media file is not accessible at ${mediaUrl}. Status: ${response.status}`,
            HttpStatus.BAD_REQUEST,
          );
        }
        console.log('- Media URL is accessible');
      } catch (error) {
        console.error('- Media URL check failed:', error.message);
        throw new HttpException(
          `Media file is not accessible: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Prepare caption with hashtags
      let caption = request.caption;
      if (request.hashtags && request.hashtags.length > 0) {
        const hashtagString = request.hashtags.map(tag => 
          tag.startsWith('#') ? tag : `#${tag}`
        ).join(' ');
        caption = `${caption}\n\n${hashtagString}`;
      }

      // Check if this is a Business or Creator account
      // Personal accounts cannot post via Instagram Graph API
      if (!account.instagramAccountId || account.instagramAccountId === 'instagram_user') {
        throw new HttpException(
          'Instagram posting is only available for Business and Creator accounts. Please convert your Instagram account to Business or Creator type and reconnect.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Use NEW 2024 Instagram API - Direct posting without Facebook Pages!
      let result;
      let postingEndpoint: string;
      
      if (account.instagramAccountId) {
        // Direct Instagram account access (2024 API supports this for posting!)
        postingEndpoint = account.instagramAccountId;
        
        if (account.instagramUsername) {
          console.log('Using direct Instagram Account ID (legacy Facebook Page setup):', postingEndpoint);
          console.log('Associated Facebook Page ID:', account.instagramUsername);
        } else {
          console.log('Using direct Instagram Account ID (NEW 2024 API - no Facebook Page needed!):', postingEndpoint);
        }
      } else {
        throw new HttpException(
          'No valid Instagram account ID found. Please reconnect your Instagram account.',
          HttpStatus.BAD_REQUEST,
        );
      }
      
      console.log('Attempting to post with endpoint:', postingEndpoint);
      
      // Check posting permissions before attempting to post
      console.log('Checking posting permissions...');
      const hasPermissions = await this.instagramGraphService.checkPostingPermissions(
        postingEndpoint,
        account.accessToken!
      );
      
      if (!hasPermissions) {
        throw new HttpException(
          'Instagram account does not have posting permissions. Please ensure it is a Business or Creator account and properly connected.',
          HttpStatus.BAD_REQUEST,
        );
      }
      
      console.log('Posting permissions confirmed, proceeding with upload...');
      
      if (media.mediaType === 'video') {
        // Post as Reel for videos
        result = await this.instagramGraphService.postReel(
          postingEndpoint,
          account.accessToken!,
          mediaUrl,
          caption,
        );
      } else if (media.mediaType === 'image') {
        // Post as regular image
        result = await this.instagramGraphService.postImage(
          postingEndpoint,
          account.accessToken!,
          mediaUrl,
          caption,
        );
      } else {
        throw new HttpException(
          'Unsupported media type for Instagram posting',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        instagramMediaId: result.id,
        message: 'Media posted to Instagram successfully',
      };
    } catch (error) {
      console.error('=== INSTAGRAM POSTING ERROR ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      
      if (error.response) {
        console.error('HTTP Response Status:', error.response.status);
        console.error('HTTP Response Data:', JSON.stringify(error.response.data, null, 2));
        console.error('HTTP Response Headers:', error.response.headers);
      }
      
      console.error('Error Stack:', error.stack);
      console.error('================================');
      
      throw new HttpException(
        error.response?.data?.error?.message || error.message || 'Failed to post to Instagram',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Post content to Instagram (from Content entity)
   */
  async postContentToInstagram(
    accountId: number,
    contentId: number,
    caption: string,
    hashtags: string[] = [],
  ): Promise<PostToInstagramResponse> {
    try {
      // Get the Instagram account
      const account = await this.igAccountRepository.findOne({
        where: { id: accountId },
      });

      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      if (!account.isConnected || !account.accessToken || !account.instagramAccountId) {
        throw new HttpException(
          'Instagram account not connected. Please connect your Instagram account first.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate access token
      const isTokenValid = await this.instagramGraphService.validateAccessToken(account.accessToken!);
      if (!isTokenValid) {
        throw new HttpException(
          'Instagram access token is invalid. Please reconnect your Instagram account.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get the media associated with the content
      const media = await this.mediaRepository.findOne({
        where: { contentId: contentId },
      });

      if (!media) {
        throw new HttpException('No media found for this content', HttpStatus.NOT_FOUND);
      }

      // Use the existing postToInstagram method
      return await this.postToInstagram({
        accountId: accountId,
        mediaId: media.id,
        caption: caption,
        hashtags: hashtags,
      });
    } catch (error) {
      console.error('Error posting content to Instagram:', error);
      throw new HttpException(
        error.message || 'Failed to post content to Instagram',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get Instagram posting capabilities for an account
   */
  async getPostingCapabilities(accountId: number): Promise<{
    canPost: boolean;
    isConnected: boolean;
    tokenValid: boolean;
    accountInfo?: any;
  }> {
    try {
      const account = await this.igAccountRepository.findOne({
        where: { id: accountId },
      });

      if (!account) {
        return {
          canPost: false,
          isConnected: false,
          tokenValid: false,
        };
      }

      const isConnected = account.isConnected && !!account.accessToken && !!account.instagramAccountId;
      let tokenValid = false;
      let accountInfo: any = null;

        if (isConnected && account.accessToken && account.instagramAccountId) {
        tokenValid = await this.instagramGraphService.validateAccessToken(account.accessToken);
        
        if (tokenValid) {
          try {
            accountInfo = await this.instagramGraphService.getInstagramAccountInfo(
              account.instagramAccountId,
              account.accessToken,
            );
          } catch (error) {
            console.error('Error getting account info:', error);
          }
        }
      }

      return {
        canPost: isConnected && tokenValid,
        isConnected: isConnected,
        tokenValid: tokenValid,
        accountInfo: accountInfo,
      };
    } catch (error) {
      console.error('Error getting posting capabilities:', error);
      return {
        canPost: false,
        isConnected: false,
        tokenValid: false,
      };
    }
  }
}
