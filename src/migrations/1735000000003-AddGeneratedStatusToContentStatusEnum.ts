import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGeneratedStatusToContentStatusEnum1735000000004 implements MigrationInterface {
    name = 'AddGeneratedStatusToContentStatusEnum1735000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add 'generated' to the content_status_enum
        await queryRunner.query(`ALTER TYPE "content_status_enum" ADD VALUE 'generated'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: PostgreSQL doesn't support removing enum values directly
        // This would require recreating the enum and updating all references
        // For now, we'll leave the enum value in place
        console.log('Warning: Cannot remove enum value "generated" from content_status_enum. Manual cleanup required if needed.');
    }
}
