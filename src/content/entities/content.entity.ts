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
import { ScheduleContent } from '../../schedule-content/entities/schedule-content.entity';

export enum ContentType {
  REEL = 'reel',
  STORY = 'story',
  POST_WITH_IMAGE = 'post_with_image',
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
    default: ContentStatus.GENERATED,
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
}

