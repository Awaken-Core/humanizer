import { expect, mock, test } from "bun:test";

const connections: Array<ReturnType<typeof makeConnection>> = [];
function makeConnection() {
  const connection = {
    readyState: 1,
    models: {} as Record<string, object>,
    close: mock(async () => {}),
    asPromise: async () => connection,
    model(name: string) {
      const model = { owner: connection, find() { return this.owner; } };
      connection.models[name] = model;
      return model;
    },
  };
  return connection;
}
mock.module("../src/lib/env", () => ({ env: { MONGODB_URI: "mongodb://test/humanizer" } }));
mock.module("mongoose", () => ({ default: {
  createConnection: () => {
    const connection = makeConnection();
    connections.push(connection);
    return connection;
  },
} }));
const { client, scopedModel, withDatabaseScope } = await import("../src/lib/db");

test("does not connect on import or for handlers that do not need MongoDB", async () => {
  expect(connections).toHaveLength(0);
  expect(await withDatabaseScope(async () => "ok")()).toBe("ok");
  expect(connections).toHaveLength(0);
});

test("reuses the pool across requests without closing it", async () => {
  await withDatabaseScope(async () => {
    const first = await client();
    const second = await client();
    expect(first.connection).toBe(second.connection);
    expect(connections[0].close).not.toHaveBeenCalled();
  })();
  expect(connections).toHaveLength(1);
  await withDatabaseScope(async () => { await client(); })();
  expect(connections).toHaveLength(1);
  expect(connections[0].close).not.toHaveBeenCalled();
});

test("concurrent requests resolve model operations to the shared connection", async () => {
  const template = { modelName: "Document", schema: {}, collection: { name: "documents" }, find() {} };
  const model = scopedModel(template);
  await Promise.all([1, 2, 3].map(() => withDatabaseScope(async () => {
    const { connection } = await client();
    await Promise.resolve();
    expect(model.find()).toBe(connection);
  })()));
  expect(connections).toHaveLength(1);
  expect(connections[0].close).not.toHaveBeenCalled();
});

test("keeps the pool available when a handler throws", async () => {
  await expect(withDatabaseScope(async () => {
    await client();
    throw new Error("handler failed");
  })()).rejects.toThrow("handler failed");
  expect(connections[0].close).not.toHaveBeenCalled();
});

test("supports database access outside route wrappers", async () => {
  expect((await client()).connection).toBe(connections[0]);
});
