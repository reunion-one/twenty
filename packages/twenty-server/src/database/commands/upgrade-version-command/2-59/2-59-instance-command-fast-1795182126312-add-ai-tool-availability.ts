import { type QueryRunner } from 'typeorm';
import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.59.0', 1795182126312)
export class AddAiToolAvailabilityFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "core"."keyValuePair_type_enum" ADD VALUE IF NOT EXISTS 'AI_TOOL_AVAILABILITY'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core"."keyValuePair" WHERE "type" = 'AI_TOOL_AVAILABILITY'`,
    );
  }
}
