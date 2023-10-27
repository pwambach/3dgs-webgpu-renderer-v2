import { mat4 } from "gl-matrix";
import WorkerUrl from "./worker?url";

type Attributes = Record<string, Float32Array>;

export class Loader extends EventTarget {
  worker = new Worker(WorkerUrl, { type: "module" });
  attributes: Attributes = {};
  splatCount: number = 0;
  floatsPerSplatOut: number = 0;
  processedSplats: number = 0;
  splats: Float32Array = new Float32Array(0);
  positions: Float32Array = new Float32Array(0);
  splatIndex = 0;
  modelMatrix: mat4;

  constructor({ modelMatrix }: { modelMatrix: mat4 }) {
    super();

    this.modelMatrix = modelMatrix;

    this.worker.onmessage = (event) => {
      const type = event.data[0];

      if (type === "end") {
        this.dispatchEvent(new Event("end"));
        return;
      }

      const info = event.data[1];
      this.splatCount = info.totalSplats;
      this.floatsPerSplatOut = info.floatsPerSplatOut;
      this.processedSplats = info.processedSplats;

      if (this.splats.byteLength === 0) {
        this.splats = new Float32Array(
          this.splatCount * this.floatsPerSplatOut
        );
        this.positions = new Float32Array(this.splatCount * 3);
      }

      const splatsSlice = event.data[2];
      const positionsSlice = event.data[3];

      this.splats.set(splatsSlice, this.splatIndex * info.floatsPerSplatOut);
      this.positions.set(positionsSlice, this.splatIndex * 3);
      this.splatIndex = info.processedSplats;

      this.dispatchEvent(
        new CustomEvent("update", {
          detail: {
            info,
            splats: this.splats,
            positions: this.positions,
          },
        })
      );
    };

    this.worker.onerror = (e) => {
      console.log("Loader Worker Error", e);
    };
  }

  load(url: string) {
    this.worker.postMessage([url, this.modelMatrix]);
  }
}
