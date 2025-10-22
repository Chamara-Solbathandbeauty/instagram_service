import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTimeSlotFields1734567890000 implements MigrationInterface {
  name = 'AddTimeSlotFields1734567890000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('schedule_time_slots', [
      new TableColumn({
        name: 'tone',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Content tone: professional, casual, friendly, authoritative, playful, serious',
      }),
      new TableColumn({
        name: 'dimensions',
        type: 'varchar',
        length: '20',
        isNullable: true,
        comment: 'Content dimensions: 1:1, 9:16, 4:5, 16:9',
      }),
      new TableColumn({
        name: 'preferredVoiceAccent',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Preferred voice accent: american, british, australian, neutral, canadian',
      }),
      new TableColumn({
        name: 'reelDuration',
        type: 'int',
        isNullable: true,
        comment: 'Reel duration in seconds: 8, 16, 24, 32',
      }),
    ]);
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
