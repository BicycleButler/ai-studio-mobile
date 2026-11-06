export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export class ConsoleLogger implements ILogger {
  public debug(_message: string, ..._args: unknown[]): void {
    console.debug(_message, ..._args);
  }

  public info(_message: string, ..._args: unknown[]): void {
    console.info(_message, ..._args);
  }

  public warn(_message: string, ..._args: unknown[]): void {
    console.warn(_message, ..._args);
  }

  public error(_message: string, ..._args: unknown[]): void {
    console.error(_message, ..._args);
  }
}

export class NoOpLogger implements ILogger {
  public debug(_message: string, ..._args: unknown[]): void {}
  public info(_message: string, ..._args: unknown[]): void {}
  public warn(_message: string, ..._args: unknown[]): void {}
  public error(_message: string, ..._args: unknown[]): void {}
}

export interface ILoggerFactory {
  createLogger(context?: string): ILogger;
}

export class DefaultLoggerFactory implements ILoggerFactory {
  public createLogger(_context?: string): ILogger {
    return new ConsoleLogger();
  }
}

export class NoOpLoggerFactory implements ILoggerFactory {
  public createLogger(_context?: string): ILogger {
    return new NoOpLogger();
  }
}


