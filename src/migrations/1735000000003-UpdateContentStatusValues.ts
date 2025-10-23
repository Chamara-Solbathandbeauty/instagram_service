import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateContentStatusValues1735000000003 implements MigrationInterface {
  name = 'UpdateContentStatusValues1735000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if 'generated' already exists in the enum
    const enumValues = await queryRunner.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'content_status_enum')
    `);
    
    const hasGenerated = enumValues.some((row: any) => row.enumlabel === 'generated');
    
    if (!hasGenerated) {
      try {
        await queryRunner.query(`ALTER TYPE "content_status_enum" ADD VALUE 'generated'`);
        console.log('Successfully added "generated" to content_status_enum');
      } catch (error) {
        console.log('Error adding "generated" to enum:', error.message);
        throw error;
      }
    } else {
      console.log('Value "generated" already exists in enum');
    }

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
