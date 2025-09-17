import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PostingSchedule } from './posting-schedule.entity';
import { ScheduleTimeSlot } from './schedule-time-slot.entity';
import { Content } from '../content/content.entity';

export enum ScheduleContentStatus {
  QUEUED = 'queued',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('schedule_content')
@Index(['scheduleId', 'scheduledDate', 'timeSlotId'], { unique: false })
@Index(['contentId'], { unique: true }) // Each content can only be scheduled once
export class ScheduleContent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number;

  @ManyToOne(() => PostingSchedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: PostingSchedule;

  @Column()
  contentId: number;

  @ManyToOne(() => Content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentId' })
  content: Content;

  @Column({ nullable: true })
  timeSlotId: number;

  @ManyToOne(() => ScheduleTimeSlot, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'timeSlotId' })
  timeSlot: ScheduleTimeSlot;

  @Column({ type: 'date' })
  scheduledDate: Date; // The specific date this content should be published

  @Column({ type: 'time', nullable: true })
  scheduledTime?: string; // The specific time (HH:MM:SS) for publishing

  @Column({
    type: 'enum',
    enum: ScheduleContentStatus,
    default: ScheduleContentStatus.QUEUED,
  })
  status: ScheduleContentStatus;

  @Column({ type: 'int', default: 0 })
  priority: number; // Higher number = higher priority

  @Column({ type: 'text', nullable: true })
  notes: string; // Additional notes for this scheduled content

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date; // When the content was actually published

  @Column({ type: 'text', nullable: true })
  failureReason: string; // Reason if publishing failed

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
