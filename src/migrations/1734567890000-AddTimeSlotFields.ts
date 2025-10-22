import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTimeSlotFields1734567890000 implements MigrationInterface {
  name = 'AddTimeSlotFields1734567890000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('schedule_time_slots');
    const columnsToAdd = [];

    // Check if tone column exists
    if (!table?.findColumnByName('tone')) {
      columnsToAdd.push(new TableColumn({
        name: 'tone',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Content tone: professional, casual, friendly, authoritative, playful, serious',
      }));
    }

    // Check if dimensions column exists
    if (!table?.findColumnByName('dimensions')) {
      columnsToAdd.push(new TableColumn({
        name: 'dimensions',
        type: 'varchar',
        length: '20',
        isNullable: true,
        comment: 'Content dimensions: 1:1, 9:16, 4:5, 16:9',
      }));
    }

    // Check if preferredVoiceAccent column exists
    if (!table?.findColumnByName('preferredVoiceAccent')) {
      columnsToAdd.push(new TableColumn({
        name: 'preferredVoiceAccent',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Preferred voice accent: american, british, australian, neutral, canadian',
      }));
    }

    // Check if reelDuration column exists
    if (!table?.findColumnByName('reelDuration')) {
      columnsToAdd.push(new TableColumn({
        name: 'reelDuration',
        type: 'int',
        isNullable: true,
        comment: 'Reel duration in seconds: 8, 16, 24, 32',
      }));
    }

    if (columnsToAdd.length > 0) {
      await queryRunner.addColumns('schedule_time_slots', columnsToAdd);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('schedule_time_slots', [
      'tone',
      'dimensions',
      'preferredVoiceAccent',
      'reelDuration',
    ]);
  }
}
