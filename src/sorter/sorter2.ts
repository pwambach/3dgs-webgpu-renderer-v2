import { vec3 } from "gl-matrix";
import Worker from "./worker?worker";

export class Sorter2 extends EventTarget {
  indices: Uint32Array;
  output: Uint32Array;
  splats: Float32Array;
  stride: number;
  isSorting = false;
  needsSort = false;
  prevCameraPosition = vec3.create();
  worker = new Worker();
  time = 0;

  constructor(splats: Float32Array, stride: number) {
    super();
    this.splats = splats;
    this.stride = stride;
    this.output = new Uint32Array((splats.length / stride) * 6);
    this.indices = new Uint32Array(splats.length / stride);

    for (let i = 0; i < this.indices.length; i++) {
      this.indices[i] = i;
    }

    this.worker.onmessage = (e) => {
      console.log(`worker took ${Date.now() - this.time}ms to sort`);

      this.isSorting = false;
      this.indices = e.data[0];
      this.output = e.data[1];
      this.splats = e.data[2];
      this.dispatchEvent(new Event("sorted"));

      if (this.needsSort) {
        // this.update([1, 1, 1]);
      }

      this.needsSort = false;
    };
  }

  update(cameraPosition: vec3) {
    if (this.isSorting) {
      this.needsSort = true;
      return;
    }

    const cameraChanged = !vec3.equals(this.prevCameraPosition, cameraPosition);
    const shouldUpdate = cameraChanged;

    // if sort needed and not already sorting -> do it
    if (shouldUpdate && !this.isSorting) {
      // save camera position
      vec3.copy(this.prevCameraPosition, cameraPosition);

      this.isSorting = true;
      this.sort(cameraPosition);
    }
  }

  private sort(position: vec3) {
    console.log("real sort call");

    this.time = Date.now();

    this.worker.postMessage(
      [this.indices, this.output, this.splats, position, this.stride],
      [this.indices.buffer, this.output.buffer, this.splats.buffer]
    );
  }
}
