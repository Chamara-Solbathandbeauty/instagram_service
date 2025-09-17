import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './entities/user.entity';

export enum IgAccountType {
  BUSINESS = 'business',
  CREATOR = 'creator',
}

@Entity('ig_accounts')
export class IgAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  topics: string;

  @Column({ nullable: true })
  tone: string;

  @Column({
    type: 'enum',
    enum: IgAccountType,
    default: IgAccountType.BUSINESS,
  })
  type: IgAccountType;

  // Instagram API Integration Fields
  @Column({ type: 'varchar', nullable: true })
  instagramAccountId: string | null;

  @Column({ type: 'varchar', nullable: true })
  facebookPageId: string | null;

  @Column({ type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ default: false })
  isConnected: boolean;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', nullable: true })
  profilePictureUrl: string | null;

  @Column({ default: 0 })
  followersCount: number;

  @Column({ default: 0 })
  followingCount: number;

  @Column({ default: 0 })
  mediaCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
