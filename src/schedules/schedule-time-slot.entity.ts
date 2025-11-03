import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { PostingSchedule } from './posting-schedule.entity';
import { ScheduleContent } from './schedule-content.entity';
import { ContentQueue } from './content-queue.entity';

export enum PostType {
  POST_WITH_IMAGE = 'post_with_image',
  REEL = 'reel',
  STORY = 'story',
}

@Entity('schedule_time_slots')
export class ScheduleTimeSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number;

  @ManyToOne(() => PostingSchedule, schedule => schedule.timeSlots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: PostingSchedule;

  @Column({ type: 'time' })
  startTime: string; // Format: "09:00:00"

  @Column({ type: 'time' })
  endTime: string; // Format: "17:00:00"

  @Column({ type: 'int', default: 1 })
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({
    type: 'enum',
    enum: PostType,
    default: PostType.POST_WITH_IMAGE,
  })
  postType: PostType; // Type of content to post in this time slot

  @Column({ type: 'text', nullable: true })
  label: string; // e.g., "Morning Posts", "Evening Stories"

  @Column({ type: 'varchar', length: 200, nullable: true })
  tone: string; // e.g., "professional", "casual", "friendly", "authoritative"

  @Column({ type: 'varchar', length: 20, nullable: true })
  dimensions: string; // e.g., "1:1", "9:16", "4:5", "16:9"

  @Column({ type: 'varchar', length: 50, nullable: true })
  preferredVoiceAccent: string; // e.g., "american", "british", "australian", "neutral"

  @Column({ type: 'int', nullable: true })
  reelDuration: number; // Duration in seconds: 8, 16, 24, 32

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'video' })
  storyType: string; // 'image' or 'video' - only for story post types

  @Column({ type: 'int', default: 1 })
  imageCount: number; // Number of images to generate (1-5), only for post_with_image type

  @OneToMany(() => ScheduleContent, scheduleContent => scheduleContent.timeSlot, { cascade: true })
  scheduleContent: ScheduleContent[];

  @OneToMany(() => ContentQueue, contentQueue => contentQueue.timeSlot, { cascade: true })
  contentQueue: ContentQueue[];

  @CreateDateColumn()
  createdAt: Date;
}
