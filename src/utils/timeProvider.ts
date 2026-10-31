export interface ITimeProvider {
  now(): number;
  date(): Date;
}

export class DefaultTimeProvider implements ITimeProvider {
  public now(): number {
    return Date.now();
  }

  public date(): Date {
    return new Date();
  }
}

export const defaultTimeProvider = new DefaultTimeProvider();
