import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PostingSchedule } from './posting-schedule.entity';
import { ScheduleTimeSlot } from './schedule-time-slot.entity';
import { Content } from '../content/content.entity';

export enum QueueStatus {
  PENDING = 'pending',
  READY = 'ready',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('content_queue')
@Index(['scheduleId', 'timeSlotId', 'queueDate'], { unique: false })
@Index(['scheduleId', 'queueDate', 'priority'], { unique: false })
export class ContentQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number;

  @ManyToOne(() => PostingSchedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: PostingSchedule;

  @Column({ nullable: true })
  timeSlotId: number;

  @ManyToOne(() => ScheduleTimeSlot, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'timeSlotId' })
  timeSlot: ScheduleTimeSlot;

  @Column({ type: 'date' })
  queueDate: Date; // The date this content is queued for

  @Column({ type: 'time', nullable: true })
  queueTime: string; // The time slot for this queue entry

  @Column({ type: 'int', default: 0 })
  priority: number; // Higher number = higher priority

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.PENDING,
  })
  status: QueueStatus;

  @Column({ type: 'int', default: 0 })
  position: number; // Position in the queue for this time slot

  @Column({ type: 'text', nullable: true })
  notes: string; // Additional notes for this queue entry

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date; // When this queue entry was processed

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
