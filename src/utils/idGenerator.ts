import { ITimeProvider, DefaultTimeProvider } from "./timeProvider";
import { IRandomProvider, DefaultRandomProvider } from "./randomProvider";

export interface IIdGenerator {
  generate(prefix: string, explicitSuffix?: string): string;
}

export class DefaultIdGenerator implements IIdGenerator {
  private timeProvider: ITimeProvider;
  private randomProvider: IRandomProvider;

  constructor(timeProvider?: ITimeProvider, randomProvider?: IRandomProvider) {
    this.timeProvider = timeProvider || new DefaultTimeProvider();
    this.randomProvider = randomProvider || new DefaultRandomProvider();
  }

  public generate(prefix: string, explicitSuffix?: string): string {
    const now = this.timeProvider.now();
    const randomSuffix = this.randomProvider.random().toString(36).substring(2, 7);
    const suffixToUse = explicitSuffix ? `${explicitSuffix}_${randomSuffix}` : randomSuffix;
    return `${prefix}_${now}_${suffixToUse}`;
  }
}
