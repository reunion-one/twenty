import { type PoolClient } from 'pg';

import { type CompiledStatement } from 'src/engine/twenty-orm/sql/utils/compile-named-parameters.util';
import { computeTwentyOrmException } from 'src/engine/twenty-orm/error-handling/compute-twenty-orm-exception.util';
import { type QueryExecutor } from 'src/engine/twenty-orm/executor/types/query-executor.type';

export class ClientQueryExecutor implements QueryExecutor {
  private readonly client: PoolClient;
  private readonly onQueryError?: () => void;

  constructor({
    client,
    onQueryError,
  }: {
    client: PoolClient;
    onQueryError?: () => void;
  }) {
    this.client = client;
    this.onQueryError = onQueryError;
  }

  async execute(
    statement: CompiledStatement,
  ): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.query({
        text: statement.text,
        values: statement.values,
      });

      return result.rows as Record<string, unknown>[];
    } catch (error) {
      this.onQueryError?.();
      throw computeTwentyOrmException(error);
    }
  }
}
