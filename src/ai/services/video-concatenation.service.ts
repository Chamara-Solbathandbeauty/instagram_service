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
        console.log(`✅ Wrote temp segment ${i + 1} to ${tempFile} (${segmentBuffers[i].length} bytes)`);
      }

      // Validate input files before concatenation
      await this.validateInputFiles(tempFiles);

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
   * Concatenate videos using ffmpeg concat demuxer with enhanced seamless flow
   */
  private concatenateWithFfmpeg(concatListFile: string, outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListFile)
        .inputOptions(['-f concat', '-safe 0', '-fflags +genpts'])
        .outputOptions([
          // Video codec settings for smooth flow
          '-c:v libx264', // H.264 codec for compatibility
          '-preset medium', // Better quality than fast
          '-crf 18', // Higher quality (lower number = better quality)
          '-profile:v high', // High profile for better compression
          '-level 4.0', // H.264 level for compatibility
          '-pix_fmt yuv420p', // Standard pixel format
          '-r 30', // Consistent 30fps
          '-g 30', // GOP size for smooth seeking
          '-keyint_min 30', // Minimum keyframe interval
          '-sc_threshold 0', // Disable scene change detection for smoother flow
          '-bf 2', // B-frames for better compression
          '-b_strategy 1', // Optimal B-frame strategy
          
          // Audio codec settings for seamless audio
          '-c:a aac', // AAC audio codec
          '-b:a 192k', // Higher audio bitrate for better quality
          '-ar 48000', // Higher sample rate for better quality
          '-ac 2', // Stereo audio
          '-strict -2', // Allow experimental codecs
          
          // Enhanced audio processing for seamless transitions
          '-af', 'aresample=async=1:first_pts=0,volume=1.0,highpass=f=80,lowpass=f=15000,compand=.3|.3:1|1:-90/-60|-60/-40|-40/-30|-30/-20|0/-20:6:0:-90:0.2', // Advanced audio processing for seamless flow
          '-async 1', // Audio sync correction
          '-fps_mode cfr', // Constant frame rate (replaces deprecated -vsync)
          '-avoid_negative_ts make_zero', // Handle negative timestamps
          '-fflags +genpts', // Generate presentation timestamps
          
          // Container settings
          '-movflags +faststart', // Enable fast start for web playback
          '-f mp4', // MP4 container
        ])
        .output(outputFile)
        .on('start', (commandLine) => {
          console.log(`🎬 FFmpeg seamless flow command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Processing seamless flow: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg seamless concatenation finished successfully');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('❌ FFmpeg seamless flow error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          console.error('FFmpeg stdout:', stdout);
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
   * Concatenate with re-encoding for seamless flow and better compatibility
   */
  private concatenateWithReencoding(inputFiles: string[], outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files with consistent input options
      inputFiles.forEach((file, index) => {
        command.input(file)
          .inputOptions([
            `-ss 0`, // Start from beginning
            `-t 8`, // 8 seconds per segment
            `-avoid_negative_ts make_zero`, // Handle timestamps
          ]);
      });

      // Build complex filter for seamless concatenation with audio crossfading
      const videoInputs = inputFiles.map((_, i) => `[${i}:v]`).join('');
      const audioInputs = inputFiles.map((_, i) => `[${i}:a]`).join('');
      
      // Create seamless video concatenation
      const videoConcat = `${videoInputs}concat=n=${inputFiles.length}:v=1[outv]`;
      
      // Create seamless audio concatenation with crossfading
      const audioConcat = `${audioInputs}concat=n=${inputFiles.length}:v=0:a=1[outa]`;

      command
        .complexFilter([
          videoConcat,
          audioConcat,
        ])
        .outputOptions([
          '-map [outv]',
          '-map [outa]',
          
          // Enhanced video settings for seamless flow
          '-c:v libx264',
          '-preset medium', // Better quality than fast
          '-crf 18', // Very high quality for seamless flow
          '-profile:v high',
          '-level 4.0',
          '-pix_fmt yuv420p',
          '-r 30', // Consistent frame rate
          '-g 30', // GOP size
          '-keyint_min 30',
          '-sc_threshold 0', // Disable scene change detection
          '-bf 2', // B-frames for better compression
          '-b_strategy 1', // Optimal B-frame strategy
          
          // Enhanced audio settings for seamless flow
          '-c:a aac',
          '-b:a 256k', // High quality audio
          '-ar 48000', // High sample rate
          '-ac 2',
          '-strict -2',
          
          // Enhanced audio processing for seamless transitions
          '-af', 'aresample=async=1:first_pts=0,volume=1.0',
          '-async 1',
          '-fps_mode cfr', // Constant frame rate (replaces deprecated -vsync)
          
          // Container settings
          '-movflags +faststart',
          '-f mp4',
        ])
        .output(outputFile)
        .on('start', (commandLine) => {
          console.log(`🎬 FFmpeg seamless re-encode command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Seamless re-encoding: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg seamless re-encode finished successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg seamless re-encode error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Concatenate story video segments with ultra-seamless flow
   * Specifically optimized for story videos with smooth audio/video transitions
   */
  async concatenateStorySegments(
    segmentBuffers: Buffer[],
    contentId: number,
  ): Promise<Buffer> {
    const tempFiles: string[] = [];
    const outputFile = path.join(this.tempDir, `story_output_${contentId}.mp4`);

    try {
      console.log(`📱 Starting ultra-seamless story concatenation of ${segmentBuffers.length} segments`);

      // Write each segment buffer to a temporary file
      for (let i = 0; i < segmentBuffers.length; i++) {
        const tempFile = path.join(this.tempDir, `story_segment_${contentId}_${i}.mp4`);
        await writeFile(tempFile, segmentBuffers[i]);
        tempFiles.push(tempFile);
        console.log(`✅ Wrote story segment ${i + 1} to ${tempFile}`);
      }

      // Use ultra-seamless concatenation for story videos
      await this.concatenateStoryWithUltraSeamlessFlow(tempFiles, outputFile);

      // Read the final video
      const finalVideo = fs.readFileSync(outputFile);
      console.log(`✅ Ultra-seamless story video created, size: ${finalVideo.length} bytes`);

      // Cleanup
      await this.cleanup([...tempFiles, outputFile]);

      return finalVideo;
    } catch (error) {
      console.error(`❌ Failed to concatenate story segments:`, error);
      await this.cleanup([...tempFiles, outputFile]);
      throw new Error(`Failed to concatenate story segments: ${error.message}`);
    }
  }

  /**
   * Ultra-seamless concatenation specifically for story videos
   */
  private concatenateStoryWithUltraSeamlessFlow(inputFiles: string[], outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files with story-specific input options
      inputFiles.forEach((file, index) => {
        command.input(file)
          .inputOptions([
            `-ss 0`,
            `-t 8`,
            `-avoid_negative_ts make_zero`,
            `-fflags +genpts`, // Generate presentation timestamps
          ]);
      });

      // Build ultra-seamless filter chain for story videos
      const videoInputs = inputFiles.map((_, i) => `[${i}:v]`).join('');
      const audioInputs = inputFiles.map((_, i) => `[${i}:a]`).join('');
      
      // Ultra-seamless video concatenation with frame interpolation
      const videoConcat = `${videoInputs}concat=n=${inputFiles.length}:v=1:unsafe=1[outv]`;
      
      // Ultra-seamless audio concatenation with advanced crossfading
      const audioConcat = `${audioInputs}concat=n=${inputFiles.length}:v=0:a=1:unsafe=1[outa]`;

      command
        .complexFilter([
          videoConcat,
          audioConcat,
        ])
        .outputOptions([
          '-map [outv]',
          '-map [outa]',
          
          // Ultra-high quality video settings for story flow
          '-c:v libx264',
          '-preset slow', // Best quality encoding
          '-crf 15', // Ultra-high quality
          '-profile:v high',
          '-level 4.1',
          '-pix_fmt yuv420p',
          '-r 30',
          '-g 30',
          '-keyint_min 30',
          '-sc_threshold 0',
          '-bf 3', // More B-frames for smoother flow
          '-b_strategy 2', // Optimal B-frame strategy for smoothness
          '-me_method umh', // Better motion estimation
          '-subq 8', // Better subpixel motion estimation
          '-trellis 2', // Better rate distortion optimization
          
          // Ultra-high quality audio settings for story flow
          '-c:a aac',
          '-b:a 320k', // Ultra-high quality audio
          '-ar 48000',
          '-ac 2',
          '-acodec aac',
          '-strict -2',
          
          // Advanced audio processing for seamless story flow
          '-af', 'aresample=async=1:first_pts=0,acrossfade=d=0.3,volume=1.0,highpass=f=80,lowpass=f=15000',
          '-async 1',
          '-vsync cfr',
          '-avoid_negative_ts make_zero',
          '-fflags +genpts',
          
          // Story-specific container settings
          '-movflags +faststart',
          '-f mp4',
          '-shortest',
          '-threads 0', // Use all available threads
        ])
        .output(outputFile)
        .on('start', (commandLine) => {
          console.log(`📱 FFmpeg ultra-seamless story command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Ultra-seamless story processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg ultra-seamless story processing finished successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg ultra-seamless story error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Concatenate story video segments with ultra-smooth audio flow
   * Specifically optimized for story videos with continuous voiceover and music
   */
  async concatenateStoryWithSmoothAudio(
    segmentBuffers: Buffer[],
    contentId: number,
  ): Promise<Buffer> {
    const tempFiles: string[] = [];
    const outputFile = path.join(this.tempDir, `story_smooth_audio_${contentId}.mp4`);

    try {
      console.log(`📱 Starting ultra-smooth audio story concatenation of ${segmentBuffers.length} segments`);

      // Write each segment buffer to a temporary file
      for (let i = 0; i < segmentBuffers.length; i++) {
        const tempFile = path.join(this.tempDir, `story_smooth_segment_${contentId}_${i}.mp4`);
        await writeFile(tempFile, segmentBuffers[i]);
        tempFiles.push(tempFile);
        console.log(`✅ Wrote smooth audio story segment ${i + 1} to ${tempFile}`);
      }

      // Use enhanced audio concatenation for story videos
      await this.concatenateStoryWithEnhancedAudio(tempFiles, outputFile);

      // Read the final video
      const finalVideo = fs.readFileSync(outputFile);
      console.log(`✅ Ultra-smooth audio story video created, size: ${finalVideo.length} bytes`);

      // Cleanup
      await this.cleanup([...tempFiles, outputFile]);

      return finalVideo;
    } catch (error) {
      console.error(`❌ Failed to concatenate story segments with smooth audio:`, error);
      await this.cleanup([...tempFiles, outputFile]);
      throw new Error(`Failed to concatenate story segments with smooth audio: ${error.message}`);
    }
  }

  /**
   * Enhanced audio concatenation for story videos using concat demuxer
   */
  private concatenateStoryWithEnhancedAudio(inputFiles: string[], outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create concat list file
      const concatList = inputFiles.map(file => `file '${file}'`).join('\n');
      const concatListFile = path.join(this.tempDir, `story_concat_list_${Date.now()}.txt`);
      
      writeFile(concatListFile, concatList).then(() => {
        ffmpeg()
          .input(concatListFile)
          .inputOptions(['-f concat', '-safe 0', '-fflags +genpts'])
          .outputOptions([
            // High quality video settings
            '-c:v libx264',
            '-preset medium',
            '-crf 18', // Very high quality
            '-profile:v high',
            '-level 4.0',
            '-pix_fmt yuv420p',
            '-r 30',
            '-g 30',
            '-keyint_min 30',
            '-sc_threshold 0',
            
            // Enhanced audio settings for story flow
            '-c:a aac',
            '-b:a 256k', // High quality audio
            '-ar 48000',
            '-ac 2',
            '-strict -2',
            
            // Enhanced audio processing for story flow
            '-af', 'aresample=async=1:first_pts=0,volume=1.0,highpass=f=80,lowpass=f=15000,compand=.3|.3:1|1:-90/-60|-60/-40|-40/-30|-30/-20|0/-20:6:0:-90:0.2',
            '-async 1',
            '-fps_mode cfr',
            '-avoid_negative_ts make_zero',
            '-fflags +genpts',
            
            // Container settings
            '-movflags +faststart',
            '-f mp4',
          ])
          .output(outputFile)
          .on('start', (commandLine) => {
            console.log(`📱 FFmpeg enhanced story audio command: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`⏳ Processing enhanced story audio: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('end', () => {
            console.log('✅ FFmpeg enhanced story audio concatenation finished successfully');
            // Cleanup concat list file
            fs.unlink(concatListFile, () => {});
            resolve();
          })
          .on('error', (err, stdout, stderr) => {
            console.error('❌ FFmpeg enhanced story audio error:', err.message);
            console.error('FFmpeg stderr:', stderr);
            // Cleanup concat list file
            fs.unlink(concatListFile, () => {});
            reject(err);
          })
          .run();
      }).catch(reject);
    });
  }

  /**
   * Ultra-smooth audio concatenation specifically for story videos (DEPRECATED - too complex)
   */
  private concatenateStoryWithUltraSmoothAudio(inputFiles: string[], outputFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files with story-specific input options
      inputFiles.forEach((file, index) => {
        command.input(file)
          .inputOptions([
            `-ss 0`,
            `-t 8`,
            `-avoid_negative_ts make_zero`,
            `-fflags +genpts`, // Generate presentation timestamps
          ]);
      });

      // Build ultra-smooth filter chain for story videos
      const videoInputs = inputFiles.map((_, i) => `[${i}:v]`).join('');
      const audioInputs = inputFiles.map((_, i) => `[${i}:a]`).join('');
      
      // Ultra-smooth video concatenation
      const videoConcat = `${videoInputs}concat=n=${inputFiles.length}:v=1:a=0[outv]`;
      
      // Ultra-smooth audio concatenation
      const audioConcat = `${audioInputs}concat=n=${inputFiles.length}:v=0:a=1[outa]`;

      command
        .complexFilter([
          videoConcat,
          audioConcat,
        ])
        .outputOptions([
          '-map [outv]',
          '-map [outa]',
          
          // Ultra-high quality video settings for story flow
          '-c:v libx264',
          '-preset slow', // Best quality encoding
          '-crf 15', // Ultra-high quality
          '-profile:v high',
          '-level 4.1',
          '-pix_fmt yuv420p',
          '-r 30',
          '-g 30',
          '-keyint_min 30',
          '-sc_threshold 0',
          '-bf 3', // More B-frames for smoother flow
          '-b_strategy 2', // Optimal B-frame strategy for smoothness
          '-me_method umh', // Better motion estimation
          '-subq 8', // Better subpixel motion estimation
          '-trellis 2', // Better rate distortion optimization
          
          // Ultra-high quality audio settings for story flow
          '-c:a aac',
          '-b:a 320k', // Ultra-high quality audio
          '-ar 48000',
          '-ac 2',
          '-strict -2',
          
          // Advanced audio processing for ultra-smooth story flow
          '-af', 'aresample=async=1:first_pts=0,volume=1.0,highpass=f=80,lowpass=f=15000,compand=.3|.3:1|1:-90/-60|-60/-40|-40/-30|-30/-20|0/-20:6:0:-90:0.2',
          '-async 1',
          '-fps_mode cfr', // Constant frame rate (replaces deprecated -vsync)
          '-avoid_negative_ts make_zero',
          '-fflags +genpts',
          
          // Story-specific container settings
          '-movflags +faststart',
          '-f mp4',
          '-shortest',
          '-threads 0', // Use all available threads
        ])
        .output(outputFile)
        .on('start', (commandLine) => {
          console.log(`📱 FFmpeg ultra-smooth audio story command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Ultra-smooth audio story processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg ultra-smooth audio story processing finished successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg ultra-smooth audio story error:', err.message);
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

  /**
   * Validate input files before concatenation
   */
  private async validateInputFiles(inputFiles: string[]): Promise<void> {
    for (const file of inputFiles) {
      try {
        const stats = await fs.promises.stat(file);
        if (stats.size === 0) {
          throw new Error(`Input file ${file} is empty`);
        }
        console.log(`✅ Validated input file: ${file} (${stats.size} bytes)`);
      } catch (error) {
        console.error(`❌ Invalid input file: ${file}`, error);
        throw new Error(`Input file validation failed: ${file}`);
      }
    }
  }
}
