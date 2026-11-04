export interface ITimeProvider {
  now(): number;
  date(timestamp?: number): Date;
}

export class DefaultTimeProvider implements ITimeProvider {
  public now(): number {
    return Date.now();
  }

  public date(timestamp?: number): Date {
    return timestamp !== undefined ? new Date(timestamp) : new Date();
  }
}

export const defaultTimeProvider: ITimeProvider = new DefaultTimeProvider();
