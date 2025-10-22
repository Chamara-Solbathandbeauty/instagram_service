import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateContentStatusValues1735000000003 implements MigrationInterface {
  name = 'UpdateContentStatusValues1735000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, add 'generated' to the enum if it doesn't exist
    try {
      await queryRunner.query(`ALTER TYPE "content_status_enum" ADD VALUE 'generated'`);
      console.log('Successfully added "generated" to content_status_enum');
    } catch (error) {
      // If the value already exists, that's fine
      if (error.message.includes('already exists')) {
        console.log('Value "generated" already exists in enum');
      } else {
        throw error;
      }
    }

    // Since we can't use the new enum value in the same transaction,
    // we'll skip the data migration for now and just ensure the enum is updated
    console.log('Enum updated successfully. Data migration will be handled in a separate step if needed.');
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
