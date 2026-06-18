import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const start = source.indexOf("const migrateEntry");
const end = source.indexOf("function getDday", start);

if (start < 0 || end < 0) {
  throw new Error("Sync helpers were not found in src/index.html");
}

const context = {};
vm.createContext(context);
vm.runInContext(
  `${source.slice(start, end)}\n;globalThis.syncModel={migrateEntry,migrateContact,isLiveRecord,mergeRecords};`,
  context,
);

const { migrateEntry, migrateContact, isLiveRecord, mergeRecords } = context.syncModel;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const localDelete = mergeRecords(
  [{ id: "a", updatedAt: 100, deletedAt: 200 }],
  [{ id: "a", updatedAt: 150 }],
  migrateEntry,
  true,
);
assert(localDelete[0].deletedAt === 200, "Newer local deletion must win");

const remoteDelete = mergeRecords(
  [{ id: "a", updatedAt: 100 }],
  [{ id: "a", updatedAt: 110, deletedAt: 160 }],
  migrateEntry,
  true,
);
assert(remoteDelete[0].deletedAt === 160, "Newer remote deletion must win");

const additions = mergeRecords(
  [{ id: "a", updatedAt: 100 }],
  [{ id: "b", updatedAt: 100 }],
  migrateEntry,
  true,
);
assert(additions.map(item => item.id).join(",") === "a,b", "Independent additions must survive");

const remoteOrder = mergeRecords(
  [{ id: "a", updatedAt: 1 }, { id: "b", updatedAt: 1 }],
  [{ id: "b", updatedAt: 1 }, { id: "a", updatedAt: 1 }],
  migrateContact,
  false,
);
assert(remoteOrder.map(item => item.id).join(",") === "b,a", "Remote order must apply when clean");
assert([localDelete[0], { id: "b" }].filter(isLiveRecord).length === 1, "Tombstones must stay hidden");

console.log("OK: sync merge model passed 5 cases.");
