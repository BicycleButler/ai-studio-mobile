import { defaultTimeProvider, ITimeProvider } from "./timeProvider";
import { IRandomProvider, defaultRandomProvider } from "./randomProvider";

export interface IIdGenerator {
  generate(prefix: string, explicitSuffix?: string): string;
}

export class DefaultIdGenerator implements IIdGenerator {
  private timeProvider: ITimeProvider;
  private randomProvider: IRandomProvider;

  constructor(timeProvider?: ITimeProvider, randomProvider?: IRandomProvider) {
    this.timeProvider = timeProvider || defaultTimeProvider;
    this.randomProvider = randomProvider || defaultRandomProvider;
  }

  public generate(prefix: string, explicitSuffix?: string): string {
    const now = this.timeProvider.now();
    const randomSuffix = this.randomProvider.random().toString(36).substring(2, 7);
    const suffixToUse = explicitSuffix ? `${explicitSuffix}_${randomSuffix}` : randomSuffix;
    return `${prefix}_${now}_${suffixToUse}`;
  }
}

export const defaultIdGenerator = new DefaultIdGenerator();

export function generateUniqueId(prefix: string, explicitSuffix?: string): string {
  return defaultIdGenerator.generate(prefix, explicitSuffix);
}
