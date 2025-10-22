import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateContentStatusValues1735000000003 implements MigrationInterface {
  name = 'UpdateContentStatusValues1735000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, check if there are any records with old status values
    const result = await queryRunner.query(`SELECT COUNT(*) as count FROM "content" WHERE "status" IN ('generated', 'queued')`);
    const hasOldValues = parseInt(result[0].count) > 0;
    
    if (hasOldValues) {
      console.log('Found existing records with old status values, updating them...');
      
      // Update existing data to map old values to new values
      await queryRunner.query(`UPDATE "content" SET "status" = 'pending' WHERE "status" = 'generated'`);
      await queryRunner.query(`UPDATE "content" SET "status" = 'approved' WHERE "status" = 'queued'`);
      
      console.log('Successfully updated existing records');
    }
    
    // Now handle the enum change
    try {
      // Drop the old enum constraint first
      await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" DROP DEFAULT`);
      await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" TYPE VARCHAR`);
      
      // Drop the old enum type
      await queryRunner.query(`DROP TYPE IF EXISTS "public"."content_status_enum"`);
      
      // Create the new enum
      await queryRunner.query(`CREATE TYPE "public"."content_status_enum" AS ENUM('pending', 'approved', 'rejected', 'published')`);
      
      // Update the column to use the new enum
      await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" TYPE "public"."content_status_enum" USING "status"::"text"::"public"."content_status_enum"`);
      await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" SET DEFAULT 'pending'`);
      
      console.log('Successfully updated content status enum');
    } catch (error) {
      console.error('Error updating enum:', error);
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the enum changes
    await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" TYPE VARCHAR`);
    await queryRunner.query(`DROP TYPE "public"."content_status_enum"`);
    
    // Revert the data changes
    await queryRunner.query(`UPDATE "content" SET "status" = 'generated' WHERE "status" = 'pending'`);
    await queryRunner.query(`UPDATE "content" SET "status" = 'queued' WHERE "status" = 'approved'`);
    
    // Recreate the old enum
    await queryRunner.query(`CREATE TYPE "public"."content_status_enum" AS ENUM('generated', 'published', 'rejected', 'queued')`);
    await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" TYPE "public"."content_status_enum" USING "status"::"text"::"public"."content_status_enum"`);
    await queryRunner.query(`ALTER TABLE "content" ALTER COLUMN "status" SET DEFAULT 'generated'`);
  }
}
