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
import { User } from '../../users/entities/user.entity';
import { Content } from '../../content/entities/content.entity';
import { PostingSchedule } from '../../schedules/posting-schedule.entity';
import { AccountImage } from './account-image.entity';
import { PublishedMedia } from '../../content/entities/published-media.entity';

export const IgAccountType = {
  BUSINESS: 'business',
  CREATOR: 'creator',
} as const;

export type IgAccountType = typeof IgAccountType[keyof typeof IgAccountType];

@Entity('ig_accounts')
export class IgAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  topics: string;

  @Column({ type: 'text', nullable: true })
  tone: string;

  @Column({ default: 'business' })
  type: string;

  @Column({ nullable: true })
  instagramAccountId: string;

  @Column({ nullable: true })
  facebookPageId: string;

  @Column({ nullable: true })
  instagramUserId: string;

  @Column({ nullable: true })
  instagramUsername: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  profilePictureUrl: string;

  @Column({ default: 0 })
  followersCount: number;

  @Column({ default: 0 })
  followingCount: number;

  @Column({ default: 0 })
  mediaCount: number;

  @Column({ nullable: true })
  accessToken: string;

  @Column({ nullable: true })
  tokenExpiresAt: Date;

  @Column({ default: false })
  isConnected: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Content, (content) => content.account)
  content: Content[];

  @OneToMany(() => PostingSchedule, (schedule) => schedule.account)
  schedules: PostingSchedule[];

  @OneToMany(() => AccountImage, (image) => image.account)
  images: AccountImage[];

  @OneToMany(() => PublishedMedia, (publishedMedia) => publishedMedia.account)
  publishedMedia: PublishedMedia[];
}

