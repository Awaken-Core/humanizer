import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";
import { env } from "./env";

type DatabaseScope = {
  connection?: mongoose.Connection;
  pending?: Promise<mongoose.Connection>;
};
const databaseScope = new AsyncLocalStorage<DatabaseScope>();

// Workers sockets belong to the request that opened them.
export function withDatabaseScope<Args extends unknown[], Result>(
  handler: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return (...args) => databaseScope.run({}, async () => {
    const scope = databaseScope.getStore()!;
    try {
      return await handler(...args);
    } finally {
      await scope.connection?.close();
    }
  });
}

export async function client() {
  const scope = databaseScope.getStore();
  if (!scope) throw new Error("Database access requires withDatabaseScope.");
  if (!scope.pending) {
    scope.connection = mongoose.createConnection(env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });
    scope.pending = scope.connection.asPromise();
  }
  return { connection: await scope.pending };
}

// Templates only hold schemas. Bind model operations to the request connection.
export function scopedModel<T extends object>(template: T): T {
  function currentModel() {
    const connection = databaseScope.getStore()?.connection;
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
