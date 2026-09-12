declare module "node:sqlite" {
  export class StatementSync {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
