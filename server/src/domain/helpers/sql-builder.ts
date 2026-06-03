export class SqlBuilder {
  readonly values: unknown[] = [];
  readonly sets: string[] = [];

  add(column: string, value: unknown, transform?: (v: unknown) => unknown): void {
    this.values.push(transform ? transform(value) : value);
    this.sets.push(`${column} = $${this.values.length}`);
  }

  addOptional(column: string, value: unknown, transform?: (v: unknown) => unknown): void {
    if (value === undefined) return;
    this.add(column, value, transform);
  }

  addWithSkip(column: string, value: unknown, skipValue: unknown, transform?: (v: unknown) => unknown): void {
    if (value === skipValue) return;
    this.add(column, value, transform);
  }

  addSkipNull(column: string, value: unknown, transform?: (v: unknown) => unknown): void {
    if (value == null) return;
    this.add(column, value, transform);
  }

  get setClause(): string {
    return this.sets.join(', ');
  }

  get hasSets(): boolean {
    return this.sets.length > 0;
  }
}
