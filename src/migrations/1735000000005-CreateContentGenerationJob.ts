import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateContentGenerationJob1735000000005 implements MigrationInterface {
  name = 'CreateContentGenerationJob1735000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'content_generation_jobs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'scheduleId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'generationWeek',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: "'pending'",
          },
          {
            name: 'progress',
            type: 'int',
            default: 0,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'userInstructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'generatedContentCount',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'content_generation_jobs',
      new TableIndex({
        name: 'IDX_content_generation_jobs_schedule_status',
        columnNames: ['scheduleId', 'status'],
      })
    );

    await queryRunner.createIndex(
      'content_generation_jobs',
      new TableIndex({
        name: 'IDX_content_generation_jobs_userId',
        columnNames: ['userId'],
      })
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'content_generation_jobs',
      new TableForeignKey({
        columnNames: ['scheduleId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'posting_schedules',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'content_generation_jobs',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('content_generation_jobs');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('content_generation_jobs', fk);
      }
    }

    await queryRunner.dropTable('content_generation_jobs');
  }
}

