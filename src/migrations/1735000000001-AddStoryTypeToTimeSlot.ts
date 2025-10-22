import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoryTypeToTimeSlot1735000000001 implements MigrationInterface {
  name = 'AddStoryTypeToTimeSlot1735000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('schedule_time_slots');
    if (!table?.findColumnByName('storyType')) {
      await queryRunner.query(`
        ALTER TABLE "schedule_time_slots" 
        ADD COLUMN "storyType" varchar(20) DEFAULT 'video'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "schedule_time_slots" 
      DROP COLUMN "storyType"
    `);
  }
}
