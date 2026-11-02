import { defaultTimeProvider, ITimeProvider } from "./timeProvider";
export interface IIdGenerator {
  generate(prefix: string, explicitSuffix?: string): string;
}

export class DefaultIdGenerator implements IIdGenerator {
  private timeProvider: ITimeProvider;

  constructor(timeProvider?: ITimeProvider) {
    this.timeProvider = timeProvider || defaultTimeProvider;
  }

  public generate(prefix: string, explicitSuffix?: string): string {
    const now = this.timeProvider.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const suffixToUse = explicitSuffix ? `${explicitSuffix}_${randomSuffix}` : randomSuffix;
    return `${prefix}_${now}_${suffixToUse}`;
  }
}

export const defaultIdGenerator = new DefaultIdGenerator();

export function generateUniqueId(prefix: string, explicitSuffix?: string): string {
  return defaultIdGenerator.generate(prefix, explicitSuffix);
}
