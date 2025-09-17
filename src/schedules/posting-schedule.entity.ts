import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IgAccount } from '../ig-accounts/entities/ig-account.entity';
import { ScheduleTimeSlot } from './schedule-time-slot.entity';
import { ScheduleContent } from './schedule-content.entity';
import { ContentQueue } from './content-queue.entity';

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  CUSTOM = 'custom',
}

export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  INACTIVE = 'inactive',
}

@Entity('posting_schedules')
export class PostingSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  accountId: number;

  @ManyToOne(() => IgAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: IgAccount;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ScheduleFrequency,
    default: ScheduleFrequency.DAILY,
  })
  frequency: ScheduleFrequency;

  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.ACTIVE,
  })
  status: ScheduleStatus;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  customDays: number[]; // For custom frequency: [1,2,3,4,5] = Mon-Fri

  @Column({ type: 'jsonb', nullable: true })
  timezone: string;

  @OneToMany(() => ScheduleTimeSlot, slot => slot.schedule, { cascade: true })
  timeSlots: ScheduleTimeSlot[];

  @OneToMany(() => ScheduleContent, scheduleContent => scheduleContent.schedule, { cascade: true })
  scheduleContent: ScheduleContent[];

  @OneToMany(() => ContentQueue, contentQueue => contentQueue.schedule, { cascade: true })
  contentQueue: ContentQueue[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
