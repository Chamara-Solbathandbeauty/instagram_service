import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { InstagramGraphService } from './instagram-graph.service';
import { Media } from '../content/media.entity';
import { Content, ContentType } from '../content/entities/content.entity';
import { PublishedMediaService } from '../content/published-media.service';

export interface PostToInstagramRequest {
  accountId: number;
  mediaId: number;
  caption: string;
  hashtags?: string[];
}

export interface PostToInstagramResponse {
  success: boolean;
  instagramMediaId?: string;
  instagramUrl?: string;
  instagramPermalink?: string;
  message: string;
}

@Injectable()
export class InstagramPostingService {
  constructor(
    @InjectRepository(IgAccount)
    private igAccountRepository: Repository<IgAccount>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    private instagramGraphService: InstagramGraphService,
    private publishedMediaService: PublishedMediaService,
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

      // Get the media file with its content relation
      const media = await this.mediaRepository.findOne({
        where: { id: request.mediaId },
        relations: ['content'],
      });

      if (!media) {
        throw new HttpException('Media file not found', HttpStatus.NOT_FOUND);
      }

      // Get the content to check its type and fetch all media files
      const content = await this.contentRepository.findOne({
        where: { id: media.contentId },
        relations: ['media'],
      });

      if (!content) {
        throw new HttpException('Content not found for this media', HttpStatus.NOT_FOUND);
      }

      // Get all image media files for this content (only images, ordered by creation)
      const allImageMedia = content.media
        .filter(m => m.mediaType === 'image')
        .sort((a, b) => a.id - b.id); // Sort by ID to maintain order

      // Construct the base URL
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
      
      // If there are multiple images and content type is POST_WITH_IMAGE, use carousel
      const shouldUseCarousel = allImageMedia.length >= 2 && content.type === ContentType.POST_WITH_IMAGE;

      // For single image or stories, use the specific media URL
      const mediaUrl = `${baseUrl}/uploads/media/${media.filePath}`;
      // public accessable media url for testing
      // const mediaUrl = 'https://photographylife.com/wp-content/uploads/2014/10/Nikon-D750-Sample-Image-36.jpg';  


      // First, let's verify the account info with current token
      try {
        const accountInfo = await this.instagramGraphService.getInstagramAccountInfo(
          account.instagramAccountId!,
          account.accessToken!
        );
      } catch (verifyError) {
        console.error('Account verification failed:', verifyError.message);
        
        // Try with 'me' endpoint instead
        try {
          const accountInfo = await this.instagramGraphService.getInstagramAccountInfo(
            'me',
            account.accessToken!
          );
        } catch (meError) {
          console.error('Account verification with /me also failed:', meError.message);
          throw new HttpException(
            'Cannot access Instagram account. Please reconnect your Instagram account.',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Check if media URLs are accessible
      const mediaUrlsToCheck = shouldUseCarousel 
        ? allImageMedia.map(m => `${baseUrl}/uploads/media/${m.filePath}`)
        : [mediaUrl];

      for (const urlToCheck of mediaUrlsToCheck) {
        try {
          const response = await fetch(urlToCheck, { method: 'HEAD' });
          if (!response.ok) {
            throw new HttpException(
              `Media file is not accessible at ${urlToCheck}. Status: ${response.status}`,
              HttpStatus.BAD_REQUEST,
            );
          }
        } catch (error) {
          console.error('- Media URL check failed:', error.message);
          throw new HttpException(
            `Media file is not accessible: ${error.message}`,
            HttpStatus.BAD_REQUEST,
          );
        }
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
        } else {
        }
      } else {
        throw new HttpException(
          'No valid Instagram account ID found. Please reconnect your Instagram account.',
          HttpStatus.BAD_REQUEST,
        );
      }
      
      
      // Check posting permissions before attempting to post
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
      
      
      if (media.mediaType === 'video') {
        // Check content type to determine if this is a story or reel
        if (content.type === ContentType.STORY) {
          // Post as Story for story content
          console.log('📱 Posting video as Story to Instagram Stories...');
          result = await this.instagramGraphService.postStory(
            postingEndpoint,
            account.accessToken!,
            mediaUrl,
            true // isVideo
          );
        } else {
          // Post as Reel for reel content
          console.log('🎬 Posting video as Reel to Instagram Feed...');
          result = await this.instagramGraphService.postReel(
            postingEndpoint,
            account.accessToken!,
            mediaUrl,
            caption,
          );
        }
      } else if (media.mediaType === 'image') {
        // Check if this is a story image or regular post image
        if (content.type === ContentType.STORY) {
          // Post as Story for story content
          console.log('📱 Posting image as Story to Instagram Stories...');
          result = await this.instagramGraphService.postStory(
            postingEndpoint,
            account.accessToken!,
            mediaUrl,
            false // isVideo
          );
        } else if (shouldUseCarousel) {
          // Post as carousel if multiple images
          console.log(`🎠 Posting ${allImageMedia.length} images as carousel to Instagram Feed...`);
          const imageUrls = allImageMedia.map(m => `${baseUrl}/uploads/media/${m.filePath}`);
          result = await this.instagramGraphService.postCarousel(
            postingEndpoint,
            account.accessToken!,
            imageUrls,
            caption
          );
        } else {
          // Post as regular single image
          console.log('🖼️ Posting single image to Instagram Feed...');
          result = await this.instagramGraphService.postImage(
            postingEndpoint,
            account.accessToken!,
            mediaUrl,
            caption,
          );
        }
      } else {
        throw new HttpException(
          'Unsupported media type for Instagram posting',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Store the published media record
      try {
        console.log('📝 Creating published media record for content:', media.contentId, 'account:', request.accountId, 'instagramMediaId:', result.id);
        
        const publishedMedia = await this.publishedMediaService.createPublishedMedia({
          contentId: media.contentId,
          accountId: request.accountId,
          instagramMediaId: result.id,
          publishedAt: new Date(),
          metadata: {
            mediaType: media.mediaType,
            originalMediaId: media.id,
            caption: caption,
            hashtags: request.hashtags,
          },
        });
        
        console.log('✅ Published media record created successfully:', publishedMedia.id);

        // Get Instagram URL and permalink if available
        let instagramUrl: string | undefined;
        let instagramPermalink: string | undefined;

        try {
          // Try to get the media details to extract URL and permalink
          const mediaDetails = await this.instagramGraphService.getMediaDetails(
            result.id,
            account.accessToken!
          );
          instagramUrl = mediaDetails.media_url;
          instagramPermalink = mediaDetails.permalink;
          
          // Update the published media record with URL and permalink
          await this.publishedMediaService.updatePublishedMedia(publishedMedia.id, {
            instagramUrl,
            instagramPermalink,
          });
        } catch (urlError) {
          console.warn('Could not fetch Instagram URL and permalink:', urlError.message);
        }

        return {
          success: true,
          instagramMediaId: result.id,
          instagramUrl,
          instagramPermalink,
          message: 'Media posted to Instagram successfully',
        };
      } catch (storageError) {
        console.error('Error storing published media record:', storageError);
        // Still return success since the post was successful, just storage failed
        return {
          success: true,
          instagramMediaId: result.id,
          message: 'Media posted to Instagram successfully (storage failed)',
        };
      }
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
