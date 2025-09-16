import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Schedule } from '../../schedules/entities/schedule.entity';
import { Content } from '../../content/entities/content.entity';
import { TimeSlot } from '../../schedules/entities/time-slot.entity';

export enum ScheduleContentStatus {
  QUEUED = 'queued',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('schedule_content')
export class ScheduleContent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  scheduledDate: Date;

  @Column({ type: 'time', nullable: true })
  scheduledTime: string;

  @Column({
    type: 'enum',
    enum: ScheduleContentStatus,
    default: ScheduleContentStatus.QUEUED,
  })
  status: ScheduleContentStatus;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  failureReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Schedule, (schedule) => schedule.scheduleContent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: Schedule;

  @Column()
  scheduleId: number;

  @ManyToOne(() => Content, (content) => content.scheduleContent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentId' })
  content: Content;

  @Column()
  contentId: number;

  @ManyToOne(() => TimeSlot, (timeSlot) => timeSlot.scheduleContent, { nullable: true })
  @JoinColumn({ name: 'timeSlotId' })
  timeSlot: TimeSlot;

  @Column({ nullable: true })
  timeSlotId: number;
}

