import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Content } from './entities/content.entity';

export const MediaType = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export type MediaType = typeof MediaType[keyof typeof MediaType];

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  contentId: number | null;

  @ManyToOne(() => Content, content => content.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentId' })
  content: Content;

  @Column()
  fileName: string;

  @Column()
  filePath: string;

  @Column()
  fileSize: number;

  @Column()
  mimeType: string;

  @Column({
    type: 'enum',
    enum: MediaType,
    default: MediaType.IMAGE,
  })
  mediaType: MediaType;

  @Column({ nullable: true })
  prompt: string;

  @Column({ default: false })
  isSegmented: boolean; // true if this is a concatenated multi-segment video

  @Column({ nullable: true })
  segmentCount: number; // Number of segments (1 for 8s, 4 for 30s)

  @Column({ type: 'text', nullable: true })
  gcsUri: string; // GCS URI for final video

  @CreateDateColumn()
  createdAt: Date;
}
