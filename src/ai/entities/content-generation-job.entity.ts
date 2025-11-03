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
import { PostingSchedule } from '../../schedules/posting-schedule.entity';
import { User } from '../../users/entities/user.entity';

export enum ContentGenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('content_generation_jobs')
@Index(['scheduleId', 'status'])
@Index(['userId'])
export class ContentGenerationJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number;

  @ManyToOne(() => PostingSchedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: PostingSchedule;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  generationWeek: string;

  @Column({
    type: 'enum',
    enum: ContentGenerationStatus,
    default: ContentGenerationStatus.PENDING,
  })
  status: ContentGenerationStatus;

  @Column({ type: 'int', default: 0 })
  progress: number; // 0-100

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  userInstructions: string;

  @Column({ type: 'int', nullable: true })
  generatedContentCount: number; // Number of content pieces generated

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

