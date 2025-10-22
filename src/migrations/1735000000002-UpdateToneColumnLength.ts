import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateToneColumnLength1735000000002 implements MigrationInterface {
  name = 'UpdateToneColumnLength1735000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schedule_time_slots" ALTER COLUMN "tone" TYPE character varying(200)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schedule_time_slots" ALTER COLUMN "tone" TYPE character varying(50)`);
  }
}
