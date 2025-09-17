import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IgAccount } from '../users/ig-account.entity';
import { Media } from './media.entity';
import { ScheduleContent } from '../schedules/schedule-content.entity';

export enum ContentType {
  REEL = 'reel',
  STORY = 'story',
  POST_WITH_IMAGE = 'post_with_image',
  VIDEO = 'video',
}

export enum ContentStatus {
  GENERATED = 'generated',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  QUEUED = 'queued',
}

@Entity('content')
export class Content {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  accountId: number;

  @ManyToOne(() => IgAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: IgAccount;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ type: 'json', nullable: true })
  hashTags: string[];

  @Column()
  generatedSource: string;

  @Column({ type: 'text', nullable: true })
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
    default: ContentStatus.GENERATED,
  })
  status: ContentStatus;

  @OneToMany(() => Media, media => media.content, { cascade: true })
  media: Media[];

  @OneToMany(() => ScheduleContent, scheduleContent => scheduleContent.content, { cascade: true })
  scheduleContent: ScheduleContent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
