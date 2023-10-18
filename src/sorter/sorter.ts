import { vec3 } from "gl-matrix";
import WorkerUrl from "./worker?url";

export class Sorter extends EventTarget {
  indices: Uint32Array;
  splats: Float32Array;
  stride: number;
  isSorting = false;
  prevCameraPosition = vec3.create();
  worker = new Worker(WorkerUrl);
  time = 0;

  constructor(splats: Float32Array, stride: number) {
    super();
    this.splats = splats;
    this.stride = stride;
    this.indices = new Uint32Array(splats.length / stride);

    for (let i = 0; i < this.indices.length; i++) {
      this.indices[i] = i;
    }

    this.worker.onmessage = (e) => {
      // console.log(`worker took ${Date.now() - this.time}ms to sort`);

      this.indices = e.data[0];
      this.splats = e.data[1];
      this.isSorting = false;
      this.dispatchEvent(new Event("sorted"));
    };

    this.worker.onerror = (e) => {
      console.log("Worker Error", e);
    };
  }

  update(cameraPosition: vec3) {
    if (this.isSorting) {
      return;
    }

    const cameraChanged = !vec3.equals(this.prevCameraPosition, cameraPosition);
    // save camera position
    vec3.copy(this.prevCameraPosition, cameraPosition);

    // if sort needed and not already sorting -> do it
    if (cameraChanged && !this.isSorting) {
      this.isSorting = true;
      this.sort();
    }
  }

  private sort() {
    this.time = Date.now();
    this.worker.postMessage(
      [this.indices, this.splats, this.prevCameraPosition, this.stride],
      [this.indices.buffer, this.splats.buffer]
    );
  }
}
