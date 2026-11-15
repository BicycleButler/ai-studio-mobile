import {
  IntegrationConnection,
  IntegrationCredentialsPayload,
  IntegrationProviderId,
} from "../../types/integrations";
import { IIdGenerator, DefaultIdGenerator } from "../idGenerator";
import { STORAGE_KEYS } from "./constants";
import { encryptSecret, decryptSecret } from "./encryption";
import { IStorageFactory, DefaultStorageFactory } from "./StorageFactory";
import { IMutableCollection } from "./types";
import { ITimeProvider, DefaultTimeProvider } from "../timeProvider";
import { Observable, IObservable } from "../observable";
import { getIntegrationDefinition } from "../integrationCatalog";

export interface IIntegrationConnectionService {
  connectionsObservable: IObservable<IntegrationConnection[]>;
  loadConnections(): IntegrationConnection[];
  saveConnections(connections: IntegrationConnection[]): void;
  upsertConnection(
    data: Omit<IntegrationConnection, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): IntegrationConnection;
  deleteConnection(id: string): void;
  toggleConnectionEnabled(id: string, enabled?: boolean): void;
  getConnectionById(id: string): IntegrationConnection | undefined;
  getConnectionsByProvider(providerId: IntegrationProviderId): IntegrationConnection[];
  toCredentialsPayload(conn: IntegrationConnection): IntegrationCredentialsPayload;
}

export interface IntegrationConnectionServiceConfig {
  storageFactory?: IStorageFactory;
  idGenerator?: IIdGenerator;
  timeProvider?: ITimeProvider;
}

export class IntegrationConnectionService implements IIntegrationConnectionService {
  private collection: IMutableCollection<IntegrationConnection>;
  private idGenerator: IIdGenerator;
  private timeProvider: ITimeProvider;
  public connectionsObservable: IObservable<IntegrationConnection[]>;

  constructor(config: IntegrationConnectionServiceConfig = {}) {
    this.idGenerator = config.idGenerator || new DefaultIdGenerator();
    this.timeProvider = config.timeProvider || new DefaultTimeProvider();
    const factory = config.storageFactory || new DefaultStorageFactory();

    this.collection = factory.createCollection<IntegrationConnection>(
      STORAGE_KEYS.INTEGRATION_CONNECTIONS,
      {
        transformIn: (c) => ({
          ...c,
          token: c.token ? encryptSecret(c.token) : "",
          serviceAccountJson: c.serviceAccountJson ? encryptSecret(c.serviceAccountJson) : "",
        }),
        transformOut: (c) => ({
          ...c,
          token: c.token ? decryptSecret(c.token) : "",
          serviceAccountJson: c.serviceAccountJson ? decryptSecret(c.serviceAccountJson) : "",
        }),
      }
    );

    this.connectionsObservable = new Observable<IntegrationConnection[]>(this.loadConnections());
  }

  public loadConnections(): IntegrationConnection[] {
    return this.collection.load();
  }

  public saveConnections(connections: IntegrationConnection[]): void {
    this.collection.save(connections);
    this.connectionsObservable.notify(this.loadConnections());
  }

  public upsertConnection(
    data: Omit<IntegrationConnection, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): IntegrationConnection {
    const existing = data.id ? this.getConnectionById(data.id) : undefined;
    const now = this.timeProvider.now();
    const def = getIntegrationDefinition(data.providerId);

    const record: IntegrationConnection = {
      ...data,
      id: data.id || this.idGenerator.generate("intg"),
      name: data.name.trim() || def?.name || data.providerId,
      authMethod: data.authMethod || def?.defaultAuthMethod || "token",
      token: data.token?.trim() || "",
      serviceAccountJson: data.serviceAccountJson?.trim() || "",
      projectId: data.projectId?.trim() || "",
      databaseId: data.databaseId?.trim() || (data.providerId === "firebase" ? "(default)" : ""),
      region: data.region?.trim() || "",
      bucket: data.bucket?.trim() || "",
      owner: data.owner?.trim() || "",
      repo: data.repo?.trim() || "",
      branch: data.branch?.trim() || "",
      teamId: data.teamId?.trim() || "",
      accountLabel: data.accountLabel?.trim() || existing?.accountLabel || "",
      enabled: data.enabled ?? true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const list = [...this.loadConnections()];
    const idx = list.findIndex((c) => c.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }
    this.saveConnections(list);
    return record;
  }

  public deleteConnection(id: string): void {
    const filtered = this.loadConnections().filter((c) => c.id !== id);
    this.saveConnections(filtered);
  }

  public toggleConnectionEnabled(id: string, enabled?: boolean): void {
    const list = this.loadConnections();
    const updated = list.map((c) =>
      c.id === id
        ? {
            ...c,
            enabled: enabled !== undefined ? enabled : !c.enabled,
            updatedAt: this.timeProvider.now(),
          }
        : c
    );
    this.saveConnections(updated);
  }

  public getConnectionById(id: string): IntegrationConnection | undefined {
    return this.loadConnections().find((c) => c.id === id);
  }

  public getConnectionsByProvider(providerId: IntegrationProviderId): IntegrationConnection[] {
    return this.loadConnections().filter((c) => c.providerId === providerId && c.enabled);
  }

  public toCredentialsPayload(conn: IntegrationConnection): IntegrationCredentialsPayload {
    return {
      providerId: conn.providerId,
      authMethod: conn.authMethod,
      token: conn.token || undefined,
      serviceAccountJson: conn.serviceAccountJson || undefined,
      projectId: conn.projectId || undefined,
      databaseId: conn.databaseId || undefined,
      teamId: conn.teamId || undefined,
    };
  }
}
