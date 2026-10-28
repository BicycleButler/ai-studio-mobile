export interface ISerializer {
  serialize<T>(value: T): string;
  deserialize<T>(raw: string): T;
}
