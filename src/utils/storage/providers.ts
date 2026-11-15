import { ModelInfo, ModelProviderId, ProviderConnection } from "../../types";
import { IIdGenerator, DefaultIdGenerator } from "../idGenerator";
import { STORAGE_KEYS } from "./constants";
import { encryptSecret, decryptSecret } from "./encryption";
import { IStorageFactory, DefaultStorageFactory } from "./StorageFactory";
import { IMutableCollection } from "./types";
import { ITimeProvider, DefaultTimeProvider } from "../timeProvider";
import { Observable, IObservable } from "../observable";
import { buildModelsForConnection, getProviderDefinition } from "../providerCatalog";

export interface IProviderConnectionService {
  connectionsObservable: IObservable<ProviderConnection[]>;
  loadConnections(): ProviderConnection[];
  saveConnections(connections: ProviderConnection[]): void;
  upsertConnection(
    data: Omit<ProviderConnection, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): ProviderConnection;
  deleteConnection(id: string): void;
  toggleConnectionEnabled(id: string, enabled?: boolean): void;
  getConnectionById(id: string): ProviderConnection | undefined;
  resolveConnectionForRequest(
    modelId: string,
    providerId?: ModelProviderId,
    connectionId?: string
  ): ProviderConnection | undefined;
  getEnabledProviderModels(): ModelInfo[];
  hasAnyEnabledConnection(): boolean;
}

export interface ProviderConnectionServiceConfig {
  storageFactory?: IStorageFactory;
  idGenerator?: IIdGenerator;
  timeProvider?: ITimeProvider;
}

export class ProviderConnectionService implements IProviderConnectionService {
  private collection: IMutableCollection<ProviderConnection>;
  private idGenerator: IIdGenerator;
  private timeProvider: ITimeProvider;
  public connectionsObservable: IObservable<ProviderConnection[]>;

  constructor(config: ProviderConnectionServiceConfig = {}) {
    this.idGenerator = config.idGenerator || new DefaultIdGenerator();
    this.timeProvider = config.timeProvider || new DefaultTimeProvider();
    const factory = config.storageFactory || new DefaultStorageFactory();

    this.collection = factory.createCollection<ProviderConnection>(
      STORAGE_KEYS.PROVIDER_CONNECTIONS,
      {
        transformIn: (c) => ({
          ...c,
          apiKey: c.apiKey ? encryptSecret(c.apiKey) : "",
        }),
        transformOut: (c) => ({
          ...c,
          apiKey: c.apiKey ? decryptSecret(c.apiKey) : "",
        }),
      }
    );

    this.connectionsObservable = new Observable<ProviderConnection[]>(this.loadConnections());
  }

  public loadConnections(): ProviderConnection[] {
    return this.collection.load();
  }

  public saveConnections(connections: ProviderConnection[]): void {
    this.collection.save(connections);
    this.connectionsObservable.notify(this.loadConnections());
  }

  public upsertConnection(
    data: Omit<ProviderConnection, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): ProviderConnection {
    const existing = data.id ? this.getConnectionById(data.id) : undefined;
    const now = this.timeProvider.now();
    const def = getProviderDefinition(data.providerId);

    const record: ProviderConnection = {
      ...data,
      id: data.id || this.idGenerator.generate("prov"),
      name: data.name.trim() || def?.name || data.providerId,
      apiKey: data.apiKey?.trim() || "",
      baseUrl: data.baseUrl?.trim() || def?.defaultBaseUrl || "",
      customModels: (data.customModels || []).map((m) => m.trim()).filter(Boolean),
      discoveredModels: data.discoveredModels || existing?.discoveredModels,
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

  public getConnectionById(id: string): ProviderConnection | undefined {
    return this.loadConnections().find((c) => c.id === id);
  }

  public resolveConnectionForRequest(
    modelId: string,
    providerId?: ModelProviderId,
    connectionId?: string
  ): ProviderConnection | undefined {
    const connections = this.loadConnections().filter((c) => c.enabled);

    if (connectionId) {
      const exact = connections.find((c) => c.id === connectionId);
      if (exact) return exact;
    }

    if (providerId) {
      const byProvider = connections.filter((c) => c.providerId === providerId);
      const modelMatch = byProvider.find((c) =>
        buildModelsForConnection(c).some((m) => m.id === modelId)
      );
      if (modelMatch) return modelMatch;
      if (byProvider.length > 0) return byProvider[0];
    }

    for (const conn of connections) {
      if (buildModelsForConnection(conn).some((m) => m.id === modelId)) {
        return conn;
      }
    }

    return undefined;
  }

  public getEnabledProviderModels(): ModelInfo[] {
    const connections = this.loadConnections().filter((c) => c.enabled);
    const models: ModelInfo[] = [];
    for (const conn of connections) {
      models.push(...buildModelsForConnection(conn));
    }
    return models;
  }

  public hasAnyEnabledConnection(): boolean {
    return this.loadConnections().some((c) => {
      if (!c.enabled) return false;
      const def = getProviderDefinition(c.providerId);
      if (def?.requiresApiKey) {
        return Boolean(c.apiKey && c.apiKey.trim().length > 0);
      }
      return true;
    });
  }
}
