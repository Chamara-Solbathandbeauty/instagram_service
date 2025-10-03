import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Content } from './content.entity';
import { IgAccount } from '../../ig-accounts/entities/ig-account.entity';

@Entity('published_media')
@Index(['contentId', 'accountId'], { unique: true }) // Ensure one published media per content per account
export class PublishedMedia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  contentId: number;

  @Column()
  accountId: number;

  @Column({ unique: true })
  instagramMediaId: string; // The Instagram media ID returned after publishing

  @Column({ nullable: true })
  instagramUrl: string; // The public URL of the published media

  @Column({ nullable: true })
  instagramPermalink: string; // The permalink to the published media

  @Column({ type: 'timestamp' })
  publishedAt: Date; // When the content was published on Instagram

  @Column({ type: 'json', nullable: true })
  metadata: any; // Additional metadata from Instagram API response

  @Column({ default: true })
  isActive: boolean; // Whether the media is still active on Instagram

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Content, (content) => content.publishedMedia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentId' })
  content: Content;

  @ManyToOne(() => IgAccount, (account) => account.publishedMedia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: IgAccount;
}
