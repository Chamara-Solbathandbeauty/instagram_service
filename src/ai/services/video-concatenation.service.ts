import { Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

@Injectable()
export class VideoConcatenationService {
  private tempDir = path.join(process.cwd(), 'temp', 'video-concat');

  constructor() {
    // Ensure temp directory exists
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Concatenate multiple video segments into a single video
   * @param segmentBuffers - Array of video buffers in order
   * @param contentId - Content ID for temp file naming
   * @returns Final concatenated video as Buffer
   */
  async concatenateSegments(
    segmentBuffers: Buffer[],
    contentId: number,
  ): Promise<Buffer> {
    const tempFiles: string[] = [];
    const concatListFile = path.join(this.tempDir, `concat_list_${contentId}.txt`);
    const outputFile = path.join(this.tempDir, `output_${contentId}.mp4`);

    try {
      console.log(`🎬 Starting concatenation of ${segmentBuffers.length} segments for content ${contentId}`);

      // Write each segment buffer to a temporary file
      for (let i = 0; i < segmentBuffers.length; i++) {
        const tempFile = path.join(this.tempDir, `segment_${contentId}_${i}.mp4`);
        await writeFile(tempFile, segmentBuffers[i]);
        tempFiles.push(tempFile);
        console.log(`✅ Wrote temp segment ${i + 1} to ${tempFile}`);
      }

      // Create concat list file for ffmpeg
      const concatList = tempFiles.map(file => `file '${file}'`).join('\n');
      await writeFile(concatListFile, concatList);
      console.log(`📝 Created concat list file at ${concatListFile}`);

      // Concatenate using ffmpeg
      await this.concatenateWithFfmpeg(concatListFile, outputFile);

      // Read the final concatenated video
      const finalVideo = fs.readFileSync(outputFile);
      console.log(`✅ Concatenated video created, size: ${finalVideo.length} bytes`);

      // Cleanup temp files
      await this.cleanup([...tempFiles, concatListFile, outputFile]);

      return finalVideo;
    } catch (error) {
      console.error(`❌ Failed to concatenate segments for content ${contentId}:`, error);
      // Cleanup on error
      await this.cleanup([...tempFiles, concatListFile, outputFile]);
      throw new Error(`Failed to concatenate video segments: ${error.message}`);
    }
  }

  /**
   * Concatenate videos using ffmpeg concat demuxer
   */
  private concatenateWithFfmpeg(concatListFile: string, outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c copy', // Copy streams without re-encoding for speed
          '-movflags +faststart', // Enable fast start for web playback
        ])
        .output(outputFile)
        .on('start', (commandLine) => {
          console.log(`🎬 FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg concatenation finished successfully');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('❌ FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Alternative: Re-encode videos for better compatibility
   * Use this if simple concat fails due to encoding differences
   */
  async concatenateWithReencode(
    segmentBuffers: Buffer[],
    contentId: number,
  ): Promise<Buffer> {
    const tempFiles: string[] = [];
    const outputFile = path.join(this.tempDir, `output_reencoded_${contentId}.mp4`);

    try {
      console.log(`🎬 Starting re-encode concatenation of ${segmentBuffers.length} segments`);

      // Write each segment buffer to a temporary file
      for (let i = 0; i < segmentBuffers.length; i++) {
        const tempFile = path.join(this.tempDir, `segment_${contentId}_${i}.mp4`);
        await writeFile(tempFile, segmentBuffers[i]);
        tempFiles.push(tempFile);
      }

      // Concatenate with re-encoding
      await this.concatenateWithReencoding(tempFiles, outputFile);

      // Read the final video
      const finalVideo = fs.readFileSync(outputFile);
      console.log(`✅ Re-encoded video created, size: ${finalVideo.length} bytes`);

      // Cleanup
      await this.cleanup([...tempFiles, outputFile]);

      return finalVideo;
    } catch (error) {
      console.error(`❌ Failed to concatenate with re-encode:`, error);
      await this.cleanup([...tempFiles, outputFile]);
      throw new Error(`Failed to concatenate with re-encode: ${error.message}`);
    }
  }

  /**
   * Concatenate with re-encoding for better compatibility
   */
  private concatenateWithReencoding(inputFiles: string[], outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files
      inputFiles.forEach(file => command.input(file));

      command
        .complexFilter([
          // Concatenate filter
          `${inputFiles.map((_, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${inputFiles.length}:v=1:a=1[outv][outa]`,
        ])
        .outputOptions([
          '-map [outv]',
          '-map [outa]',
          '-c:v libx264', // H.264 video codec
          '-preset fast', // Encoding speed/quality tradeoff
          '-crf 23', // Quality (lower = better, 18-28 is good range)
          '-c:a aac', // AAC audio codec
          '-b:a 128k', // Audio bitrate
          '-movflags +faststart',
        ])
        .output(outputFile)
        .on('start', (commandLine) => {
          console.log(`🎬 FFmpeg re-encode command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Re-encoding: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg re-encode finished successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg re-encode error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          await unlink(file);
          console.log(`🗑️  Deleted temp file: ${file}`);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to delete temp file ${file}:`, error.message);
      }
    }
  }
}
