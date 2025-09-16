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
import { TimeSlot } from './time-slot.entity';
import { ScheduleContent } from '../../schedule-content/entities/schedule-content.entity';

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

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ScheduleFrequency,
    default: ScheduleFrequency.WEEKLY,
  })
  frequency: ScheduleFrequency;

  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.ACTIVE,
  })
  status: ScheduleStatus;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column('int', { array: true, nullable: true })
  customDays: number[];

  @Column({ default: 'UTC' })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => IgAccount, (account) => account.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: IgAccount;

  @Column()
  accountId: number;

  @OneToMany(() => TimeSlot, (timeSlot) => timeSlot.schedule, { cascade: true })
  timeSlots: TimeSlot[];

  @OneToMany(() => ScheduleContent, (scheduleContent) => scheduleContent.schedule)
  scheduleContent: ScheduleContent[];
}

