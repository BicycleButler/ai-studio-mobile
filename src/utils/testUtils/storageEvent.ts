export class StorageEventCtor extends Event {
  public key: string | null;
  public newValue: string | null;

  constructor(type: string, init?: StorageEventInit) {
    super(type, init);
    this.key = init?.key ?? null;
    this.newValue = init?.newValue ?? null;
  }
}
