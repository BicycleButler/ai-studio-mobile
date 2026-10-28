import { ISerializer } from "./types";

export class JsonSerializer implements ISerializer {
  public serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  public deserialize<T>(raw: string): T {
    return JSON.parse(raw) as T;
  }
}
