export class Splats {
  private device: GPUDevice;
  private typedArraySplats = new Float32Array();
  vertexBuffer: GPUBuffer;
  splatsBuffer: GPUBuffer;
  sortBuffer: GPUBuffer;
  outputBuffer: GPUBuffer;

  // struct Splat {
  //  position: vec3f,
  //  opacity: f32,
  //  cov3d1: vec3f,
  //  load_time: f32,
  //  cov3d2: vec3f,
  //  sh: array<vec3f, 16>
  // }

  // struct RenderOutput {
  //   position: vec3f,
  //   opacity: f32,
  //   v1: vec2f,
  //   v2: vec2f,
  //   color: vec3f,
  // }

  constructor({
    device,
    splats,
    numSplatFloats,
    numOutputFloats,
  }: {
    device: GPUDevice;
    splats: Float32Array;
    numSplatFloats: number;
    numOutputFloats: number;
  }) {
    this.device = device;
    this.typedArraySplats = splats;

    // vertex buffer
    const vertices = new Float32Array([
      1, -1, 1, 1, -1, -1, 1, 1, -1, -1, -1, 1,
    ]);
    this.vertexBuffer = this.device.createBuffer({
      label: "vertices",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    // splats buffer
    this.splatsBuffer = this.device.createBuffer({
      label: "splats buffer",
      size: this.typedArraySplats.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const splatCount = this.typedArraySplats.length / numSplatFloats;

    // output buffer
    this.outputBuffer = this.device.createBuffer({
      label: "output buffer",
      size: splatCount * numOutputFloats * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const tmp = new Uint32Array(splatCount);
    for (let i = 0; i < tmp.length; i++) {
      // tmp[i] = tmp.length - 1 - i;
      tmp[i] = i;
    }

    console.log(tmp);

    // sort buffer
    this.sortBuffer = this.device.createBuffer({
      label: "sort buffer",
      size: tmp.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.uploadSort(tmp);
  }

  uploadSplats(byteStart: number, byteEnd: number) {
    if (byteEnd === 0) {
      this.device.queue.writeBuffer(
        this.splatsBuffer,
        0,
        this.typedArraySplats,
        0
      );
      return;
    }

    this.device.queue.writeBuffer(
      this.splatsBuffer,
      byteStart,
      this.typedArraySplats,
      byteStart / Float32Array.BYTES_PER_ELEMENT,
      (byteEnd - byteStart) / Float32Array.BYTES_PER_ELEMENT
    );
  }

  uploadSort(values: Uint32Array) {
    console.log({ values });

    this.device.queue.writeBuffer(this.sortBuffer, 0, values);
  }
}
