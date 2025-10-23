import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class GcsStorageService {
  private storage: Storage;
  private bucketName: string = 'insta_generated_videos';
  private baseFolder: string = 'reels';

  constructor() {
    // Initialize Google Cloud Storage with Application Default Credentials
    this.storage = new Storage();
  }

  /**
   * Upload a video segment to GCS
   * @param contentId - Content ID for organizing segments
   * @param segmentNumber - Segment number (1, 2, 3, 4)
   * @param videoBuffer - Video data as Buffer
   * @returns GCS URI of the uploaded segment
   */
  async uploadSegment(
    contentId: number,
    segmentNumber: number,
    videoBuffer: Buffer,
  ): Promise<string> {
    try {
      const fileName = `${this.baseFolder}/content_${contentId}/segment_${segmentNumber}.mp4`;
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.save(videoBuffer, {
        contentType: 'video/mp4',
        metadata: {
          contentId: contentId.toString(),
          segmentNumber: segmentNumber.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      // Return the GCS URI
      const gcsUri = `gs://${this.bucketName}/${fileName}`;
      console.log(`✅ Uploaded segment ${segmentNumber} for content ${contentId} to ${gcsUri}`);
      return gcsUri;
    } catch (error) {
      console.error(`❌ Failed to upload segment ${segmentNumber} for content ${contentId}:`, error);
      throw new Error(`Failed to upload segment to GCS: ${error.message}`);
    }
  }

  /**
   * Download a video segment from GCS
   * @param gcsUri - GCS URI of the segment
   * @returns Video data as Buffer
   */
  async downloadSegment(gcsUri: string): Promise<Buffer> {
    try {
      // Parse GCS URI: gs://bucket-name/path/to/file
      const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new Error(`Invalid GCS URI format: ${gcsUri}`);
      }

      const [, bucketName, filePath] = match;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);

      const [buffer] = await file.download();
      console.log(`✅ Downloaded segment from ${gcsUri}`);
      return buffer;
    } catch (error) {
      console.error(`❌ Failed to download segment from ${gcsUri}:`, error);
      throw new Error(`Failed to download segment from GCS: ${error.message}`);
    }
  }

  /**
   * Delete all segments for a given content
   * @param contentId - Content ID
   */
  async deleteContentSegments(contentId: number): Promise<void> {
    try {
      const prefix = `${this.baseFolder}/content_${contentId}/`;
      const bucket = this.storage.bucket(this.bucketName);

      const [files] = await bucket.getFiles({ prefix });

      if (files.length === 0) {
        console.log(`No segments found for content ${contentId}`);
        return;
      }

      await Promise.all(files.map((file) => file.delete()));
      console.log(`✅ Deleted ${files.length} segments for content ${contentId}`);
    } catch (error) {
      console.error(`❌ Failed to delete segments for content ${contentId}:`, error);
      throw new Error(`Failed to delete segments from GCS: ${error.message}`);
    }
  }

  /**
   * Delete all reference frames for a given content
   * @param contentId - Content ID
   */
  async deleteContentFrames(contentId: number): Promise<void> {
    try {
      const prefix = `${this.baseFolder}/frames/content_${contentId}/`;
      const bucket = this.storage.bucket(this.bucketName);

      const [files] = await bucket.getFiles({ prefix });

      if (files.length === 0) {
        console.log(`No reference frames found for content ${contentId}`);
        return;
      }

      await Promise.all(files.map((file) => file.delete()));
      console.log(`✅ Deleted ${files.length} reference frames for content ${contentId}`);
    } catch (error) {
      console.error(`❌ Failed to delete reference frames for content ${contentId}:`, error);
      throw new Error(`Failed to delete reference frames from GCS: ${error.message}`);
    }
  }

  /**
   * Delete all content-related files (segments + frames) for a given content
   * @param contentId - Content ID
   */
  async deleteAllContentFiles(contentId: number): Promise<void> {
    try {
      console.log(`🧹 Cleaning up all files for content ${contentId}`);
      
      // Delete segments
      await this.deleteContentSegments(contentId);
      
      // Delete reference frames
      await this.deleteContentFrames(contentId);
      
      console.log(`✅ Successfully cleaned up all files for content ${contentId}`);
    } catch (error) {
      console.error(`❌ Failed to clean up all files for content ${contentId}:`, error);
      throw new Error(`Failed to clean up all content files from GCS: ${error.message}`);
    }
  }

  /**
   * Check if a segment exists in GCS
   * @param gcsUri - GCS URI of the segment
   * @returns true if segment exists
   */
  async segmentExists(gcsUri: string): Promise<boolean> {
    try {
      const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        return false;
      }

      const [, bucketName, filePath] = match;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error(`❌ Failed to check segment existence:`, error);
      return false;
    }
  }

  /**
   * Upload the final concatenated video to GCS
   * @param contentId - Content ID
   * @param videoBuffer - Final video data as Buffer
   * @returns GCS URI of the final video
   */
  async uploadFinalVideo(contentId: number, videoBuffer: Buffer): Promise<string> {
    try {
      const fileName = `${this.baseFolder}/final/content_${contentId}_final.mp4`;
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.save(videoBuffer, {
        contentType: 'video/mp4',
        metadata: {
          contentId: contentId.toString(),
          type: 'final_concatenated',
          uploadedAt: new Date().toISOString(),
        },
      });

      const gcsUri = `gs://${this.bucketName}/${fileName}`;
      console.log(`✅ Uploaded final video for content ${contentId} to ${gcsUri}`);
      return gcsUri;
    } catch (error) {
      console.error(`❌ Failed to upload final video for content ${contentId}:`, error);
      throw new Error(`Failed to upload final video to GCS: ${error.message}`);
    }
  }
}
