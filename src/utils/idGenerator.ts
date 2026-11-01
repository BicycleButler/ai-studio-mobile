import { defaultTimeProvider } from "./timeProvider";
export interface IIdGenerator {
  generate(prefix: string, explicitSuffix?: string): string;
}

export class DefaultIdGenerator implements IIdGenerator {
  public generate(prefix: string, explicitSuffix?: string): string {
    const now = defaultTimeProvider.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const suffixToUse = explicitSuffix ? `${explicitSuffix}_${randomSuffix}` : randomSuffix;
    return `${prefix}_${now}_${suffixToUse}`;
  }
}

export const defaultIdGenerator = new DefaultIdGenerator();

export function generateUniqueId(prefix: string, explicitSuffix?: string): string {
  return defaultIdGenerator.generate(prefix, explicitSuffix);
}
