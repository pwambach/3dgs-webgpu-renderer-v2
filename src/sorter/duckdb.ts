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

let stmt = null;

export async function loadIntoDB(
  splats: Float32Array,
  offset: number,
  stride: number
) {
  // wait for duckdb to be ready
  const conn = await cPromise;

  const columns = {
    x: [] as any,
    y: [] as any,
    z: [] as any,
    index: [] as any,
  };

  for (let i = 0; i < splats.length; i += stride) {
    columns.x.push(splats[i + offset]);
    columns.y.push(splats[i + offset + 1]);
    columns.z.push(splats[i + offset + 2]);
    columns.index.push(i / stride);
  }

  columns.x = Float32Array.from(columns.x);
  columns.y = Float32Array.from(columns.y);
  columns.z = Float32Array.from(columns.z);
  columns.index = Uint32Array.from(columns.index);

  const arrowTable = tableFromArrays(columns);
  await conn.insertArrowTable(arrowTable, { name: "positions" });

  stmt = await conn.prepare(
    `SELECT index FROM positions ORDER BY ((x - ?)^2 + (y - ?)^2 + (z - ?)^2);`
  );
}

export async function sortByDistance(p: [x: number, y: number, z: number]) {
  const time = Date.now();

  // @ts-ignore
  const result = await stmt!.query(p[0], p[1], p[2]);

  console.log(Date.now() - time, "ms");
  return result.getChild("index")?.toArray();
}
