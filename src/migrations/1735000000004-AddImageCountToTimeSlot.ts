import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageCountToTimeSlot1735000000004 implements MigrationInterface {
  name = 'AddImageCountToTimeSlot1735000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('schedule_time_slots');
    if (!table?.findColumnByName('imageCount')) {
      await queryRunner.query(`
        ALTER TABLE "schedule_time_slots" 
        ADD COLUMN "imageCount" integer DEFAULT 1 NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "schedule_time_slots" 
      DROP COLUMN "imageCount"
    `);
  }
}

