import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddPublishedMediaTable1735000000001 implements MigrationInterface {
  name = 'AddPublishedMediaTable1735000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create published_media table
    await queryRunner.createTable(
      new Table({
        name: 'published_media',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'contentId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'accountId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'instagramMediaId',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'instagramUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'instagramPermalink',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'publishedAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
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
      true,
    );

    // Add foreign key constraints
    await queryRunner.createForeignKey(
      'published_media',
      new TableForeignKey({
        columnNames: ['contentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'content',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'published_media',
      new TableForeignKey({
        columnNames: ['accountId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ig_accounts',
        onDelete: 'CASCADE',
      }),
    );

    // Add unique index for contentId and accountId combination
    await queryRunner.createIndex(
      'published_media',
      new TableIndex({
        name: 'IDX_published_media_content_account',
        columnNames: ['contentId', 'accountId'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('published_media');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('published_media', foreignKey);
      }
    }

    // Drop indexes
    await queryRunner.dropIndex('published_media', 'IDX_published_media_content_account');

    // Drop table
    await queryRunner.dropTable('published_media');
  }
}
