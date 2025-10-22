import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { IgAccount } from '../../ig-accounts/entities/ig-account.entity';
import { Media } from '../media.entity';
import { ScheduleContent } from '../../schedules/schedule-content.entity';
import { VideoSegment } from '../../ai/entities/video-segment.entity';
import { PublishedMedia } from './published-media.entity';

export const ContentType = {
  REEL: 'reel',
  STORY: 'story',
  POST_WITH_IMAGE: 'post_with_image',
} as const;

export type ContentType = typeof ContentType[keyof typeof ContentType];

export const ContentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
} as const;

export type ContentStatus = typeof ContentStatus[keyof typeof ContentStatus];

@Entity('content')
export class Content {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  caption: string;

  @Column('json', { nullable: true })
  hashTags: string[];

  @Column()
  generatedSource: string;

  @Column({ nullable: true })
  usedTopics: string;

  @Column({ nullable: true })
  tone: string;

  @Column({
    type: 'enum',
    enum: ContentType,
    default: ContentType.POST_WITH_IMAGE,
  })
  type: ContentType;

  @Column({
    type: 'enum',
    enum: ContentStatus,
    default: ContentStatus.PENDING,
  })
  status: ContentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => IgAccount, (account) => account.content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: IgAccount;

  @Column()
  accountId: number;

  @OneToMany(() => Media, (media) => media.content, { cascade: true })
  media: Media[];

  @OneToMany(() => ScheduleContent, (scheduleContent) => scheduleContent.content)
  scheduleContent: ScheduleContent[];

  @OneToMany(() => VideoSegment, (segment) => segment.content, { cascade: true })
  videoSegments: VideoSegment[];

  @OneToMany(() => PublishedMedia, (publishedMedia) => publishedMedia.content, { cascade: true })
  publishedMedia: PublishedMedia[];

  // Extended video fields
  @Column({ nullable: true, default: 8 })
  desiredDuration: number; // 8 or 30 seconds

  @Column({ type: 'json', nullable: true })
  videoScript: any; // JSON array of segment prompts

  @Column({ default: false })
  isExtendedVideo: boolean; // true if this is a 30s video
}

