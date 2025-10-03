import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Content } from '../../content/entities/content.entity';

export const VideoSegmentStatus = {
  PENDING: 'pending',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type VideoSegmentStatus = typeof VideoSegmentStatus[keyof typeof VideoSegmentStatus];

@Entity('video_segments')
export class VideoSegment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contentId: number;

  @ManyToOne(() => Content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentId' })
  content: Content;

  @Column()
  segmentNumber: number; // 1, 2, 3, 4 for 0-8s, 8-16s, 16-24s, 24-30s

  @Column({ type: 'text', nullable: true })
  gcsUri: string; // GCS path to the segment

  @Column({ type: 'text' })
  prompt: string; // Segment-specific prompt

  @Column({ default: 8 })
  duration: number; // 8 seconds per segment

  @Column({
    type: 'enum',
    enum: VideoSegmentStatus,
    default: VideoSegmentStatus.PENDING,
  })
  status: VideoSegmentStatus;

  @Column({ type: 'text', nullable: true })
  operationName: string; // Vertex AI operation ID

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
