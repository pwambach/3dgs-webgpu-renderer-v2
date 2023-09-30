import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import { tableFromArrays } from "apache-arrow";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};
// Select a bundle based on browser checks
const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
// Instantiate the asynchronus version of DuckDB-wasm
const worker = new Worker(bundle.mainWorker!);
const logger = new duckdb.VoidLogger();
const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

const cPromise = db.connect();
const c = await cPromise;

export async function loadIntoDB(data: any) {
  // wait for duckdb to be ready
  const conn = await cPromise;

  const columns = {
    x: [] as any,
    y: [] as any,
    z: [] as any,
    index: [] as any,
  };

  for (let i = 0; i < data.positions.length; i += 4) {
    columns.x.push(data.positions[i]);
    columns.y.push(data.positions[i + 1]);
    columns.z.push(data.positions[i + 2]);
    columns.index.push(i / 4);
  }

  columns.x = Float32Array.from(columns.x);
  columns.y = Float32Array.from(columns.y);
  columns.z = Float32Array.from(columns.z);
  columns.index = Uint32Array.from(columns.index);

  const arrowTable = tableFromArrays(columns);

  await conn.insertArrowTable(arrowTable, { name: "positions" });
}

export async function getSortedIndex({
  x,
  y,
  z,
}: {
  x: number;
  y: number;
  z: number;
}) {
  const time = Date.now();
  const result = await c.query(
    `SELECT * FROM positions ORDER BY ((x - ${x})^2 + (y - ${y})^2 + (z - ${z})^2);`
  );

  console.log(Date.now() - time, "ms");
  return result.getChild("index")?.toArray();
}