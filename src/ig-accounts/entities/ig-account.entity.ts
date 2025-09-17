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
import { Schedule } from '../../schedules/entities/schedule.entity';

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
  instagramUserId: string;

  @Column({ nullable: true })
  instagramUsername: string;

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

  @OneToMany(() => Schedule, (schedule) => schedule.account)
  schedules: Schedule[];
}

