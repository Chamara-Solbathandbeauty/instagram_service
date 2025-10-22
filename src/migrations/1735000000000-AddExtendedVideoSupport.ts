import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class AddExtendedVideoSupport1735000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if video_segments table exists
    const videoSegmentsTable = await queryRunner.getTable('video_segments');
    if (!videoSegmentsTable) {
      // Create video_segments table
      await queryRunner.createTable(
        new Table({
          name: 'video_segments',
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
            },
            {
              name: 'segmentNumber',
              type: 'int',
            },
            {
              name: 'gcsUri',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'prompt',
              type: 'text',
            },
            {
              name: 'duration',
              type: 'int',
              default: 8,
            },
            {
              name: 'status',
              type: 'enum',
              enum: ['pending', 'generating', 'completed', 'failed'],
              default: "'pending'",
            },
            {
              name: 'operationName',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'errorMessage',
              type: 'text',
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
        true,
      );
    }

    // Check if foreign key exists
    const videoSegmentsTableForFK = await queryRunner.getTable('video_segments');
    const hasForeignKey = videoSegmentsTableForFK?.foreignKeys?.some(fk => 
      fk.columnNames.includes('contentId') && fk.referencedTableName === 'content'
    );

    if (!hasForeignKey) {
      // Add foreign key
      await queryRunner.createForeignKey(
        'video_segments',
        new TableForeignKey({
          columnNames: ['contentId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'content',
          onDelete: 'CASCADE',
        }),
      );
    }

    // Add columns to content table
    const contentTable = await queryRunner.getTable('content');
    if (contentTable && !contentTable.findColumnByName('desiredDuration')) {
      await queryRunner.addColumn(
        'content',
        new TableColumn({
          name: 'desiredDuration',
          type: 'int',
          isNullable: true,
          default: 8,
        }),
      );
    }

    if (contentTable && !contentTable.findColumnByName('videoScript')) {
      await queryRunner.addColumn(
        'content',
        new TableColumn({
          name: 'videoScript',
          type: 'json',
          isNullable: true,
        }),
      );
    }

    if (contentTable && !contentTable.findColumnByName('isExtendedVideo')) {
      await queryRunner.addColumn(
        'content',
        new TableColumn({
          name: 'isExtendedVideo',
          type: 'boolean',
          default: false,
        }),
      );
    }

    // Add columns to media table
    const mediaTable = await queryRunner.getTable('media');
    if (mediaTable && !mediaTable.findColumnByName('isSegmented')) {
      await queryRunner.addColumn(
        'media',
        new TableColumn({
          name: 'isSegmented',
          type: 'boolean',
          default: false,
        }),
      );
    }

    if (mediaTable && !mediaTable.findColumnByName('segmentCount')) {
      await queryRunner.addColumn(
        'media',
        new TableColumn({
          name: 'segmentCount',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (mediaTable && !mediaTable.findColumnByName('gcsUri')) {
      await queryRunner.addColumn(
        'media',
        new TableColumn({
          name: 'gcsUri',
          type: 'text',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns from media table
    await queryRunner.dropColumn('media', 'gcsUri');
    await queryRunner.dropColumn('media', 'segmentCount');
    await queryRunner.dropColumn('media', 'isSegmented');

    // Remove columns from content table
    await queryRunner.dropColumn('content', 'isExtendedVideo');
    await queryRunner.dropColumn('content', 'videoScript');
    await queryRunner.dropColumn('content', 'desiredDuration');

    // Drop video_segments table
    await queryRunner.dropTable('video_segments');
  }
}
