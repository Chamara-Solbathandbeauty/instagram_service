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
import { Schedule } from './schedule.entity';
import { ScheduleContent } from '../schedule-content.entity';

export enum PostType {
  REEL = 'reel',
  STORY = 'story',
  POST_WITH_IMAGE = 'post_with_image',
}

@Entity('time_slots')
export class TimeSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'int' })
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.

  @Column({
    type: 'enum',
    enum: PostType,
    default: PostType.POST_WITH_IMAGE,
  })
  postType: PostType;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ nullable: true })
  label: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Schedule, (schedule) => schedule.timeSlots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: Schedule;

  @Column()
  scheduleId: number;

  @OneToMany(() => ScheduleContent, (scheduleContent) => scheduleContent.timeSlot)
  scheduleContent: ScheduleContent[];
}

