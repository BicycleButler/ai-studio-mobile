export interface IRandomProvider {
  random(): number;
}

export class DefaultRandomProvider implements IRandomProvider {
  public random(): number {
    return Math.random();
  }
}

export const defaultRandomProvider: IRandomProvider = new DefaultRandomProvider();
