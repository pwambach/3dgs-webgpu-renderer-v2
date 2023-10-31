import { vec3 } from "gl-matrix";
import WorkerUrl from "./worker?url";

export class Sorter extends EventTarget {
  indices: Uint32Array;
  indicesT: Uint32Array;
  positions: Float32Array;
  positionsCopy: Float32Array;
  isSorting = false;
  prevCameraPosition = vec3.create();
  worker = new Worker(WorkerUrl);
  time = 0;
  lastProcessedSplats = 0;

  constructor(positions: Float32Array) {
    super();
    this.positions = positions;
    this.positionsCopy = new Float32Array(positions.length);
    this.indices = new Uint32Array(positions.length / 3); // 3 = x,y,z
    this.indicesT = new Uint32Array(positions.length / 3);

    for (let i = 0; i < this.indices.length; i++) {
      this.indicesT[i] = i;
    }

    this.worker.onmessage = (e) => {
      console.log(`worker took ${Date.now() - this.time}ms to sort`);

      this.indices = e.data[0];
      this.indicesT = e.data[1];
      this.positionsCopy = e.data[2];
      this.isSorting = false;
      this.dispatchEvent(new Event("sorted"));
    };

    this.worker.onerror = (e) => {
      console.log("Worker Error", e);
    };
  }

  update(cameraPosition: vec3, processedSplats: number) {
    if (this.isSorting) {
      return;
    }

    const cameraChanged = !vec3.equals(this.prevCameraPosition, cameraPosition);
    // save camera position
    vec3.copy(this.prevCameraPosition, cameraPosition);

    const processedSplatsChanged = processedSplats !== this.lastProcessedSplats;

    // if sort needed and not already sorting -> do it
    if ((processedSplatsChanged || cameraChanged) && !this.isSorting) {
      this.isSorting = true;

      const needsCopy = this.lastProcessedSplats < this.positions.length / 3;
      this.lastProcessedSplats = processedSplats;

      if (needsCopy) {
        this.positionsCopy.set(this.positions);
      }

      this.sort();
    }
  }

  private sort() {
    this.time = Date.now();
    this.worker.postMessage(
      [
        this.indices,
        this.indicesT,
        this.positionsCopy,
        this.prevCameraPosition,
      ],
      [this.indices.buffer, this.indicesT.buffer, this.positionsCopy.buffer]
    );
  }
}
