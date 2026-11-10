import mongoose from "mongoose";
import { env } from "./env";

type DatabaseCache = {
  connection?: mongoose.Connection;
  pending?: Promise<mongoose.Connection>;
};
const globalDatabase = globalThis as typeof globalThis & { databaseCache?: DatabaseCache };
const databaseCache = globalDatabase.databaseCache ??= {};

// Keep route wrappers compatible while sharing one bounded pool per Node process.
export function withDatabaseScope<Args extends unknown[], Result>(
  handler: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return handler;
}

export async function client() {
  const scope = databaseCache;
  if (!scope.pending) {
    scope.connection = mongoose.createConnection(env.MONGODB_URI, {
      maxPoolSize: 5,
      minPoolSize: 0,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
      maxIdleTimeMS: 60_000,
      waitQueueTimeoutMS: 10_000,
    });
    scope.pending = scope.connection.asPromise().catch(async (error) => {
      const failedConnection = scope.connection;
      scope.pending = undefined;
      scope.connection = undefined;
      await failedConnection?.close().catch(() => {});
      throw error;
    });
  }
  return { connection: await scope.pending };
}

// Templates only hold schemas. Bind model operations to the shared connection.
export function scopedModel<T extends object>(template: T): T {
  function currentModel() {
    const connection = databaseCache.connection;
    if (!connection || connection.readyState !== 1) {
      throw new Error("Call client() before using a database model.");
    }
    const model = template as mongoose.Model<unknown>;
    return connection.models[model.modelName] ??
      connection.model(model.modelName, model.schema, model.collection.name);
  }
  return new Proxy(template, {
    get(_target, property) {
      const model = currentModel();
      const value = Reflect.get(model, property);
      return typeof value === "function" ? value.bind(model) : value;
    },
    construct(_target, args) {
      return Reflect.construct(currentModel(), args);
    },
  });
}
