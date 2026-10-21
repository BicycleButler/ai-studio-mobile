export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class ConsoleLogger implements ILogger {
  public debug(message: string, ...args: any[]): void {
    console.debug(message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    console.info(message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }
}

export class NoOpLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
}

export const defaultLogger = new ConsoleLogger();
