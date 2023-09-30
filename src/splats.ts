export class Splats {
  private device: GPUDevice;
  private typedArrayVertices = new Float32Array();
  private typedArrayIndices = new Uint32Array();
  private typedArrayStorage = new Float32Array();
  vertexBuffer: GPUBuffer | null = null;
  indexBuffer: GPUBuffer | null = null;
  storageBuffer: GPUBuffer | null = null;
  vertexBufferLayout: GPUVertexBufferLayout | null = null;

  // struct Vertex {
  //   rotation: vec4f,
  //   position: vec3f,
  //   opacity: f32,
  //   scale: vec3f,
  //   sh: vec3f
  // }

  constructor({
    device,
    vertices,
    vertexCount,
  }: {
    device: GPUDevice;
    vertices: Float32Array;
    vertexCount: number;
  }) {
    this.device = device;
    this.typedArrayVertices = new Float32Array(vertexCount * 6); // for 6 quad points;
    this.typedArrayIndices = new Uint32Array(vertexCount * 6); // for 6 quad points
    this.typedArrayStorage = vertices;
    this.createVertexBuffer();
    this.createIndexBuffer();
    this.createStorageBuffer();
  }

  createVertexBuffer() {
    this.vertexBuffer = this.device.createBuffer({
      label: "vertices",
      size: this.typedArrayVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    for (let i = 0; i < this.typedArrayVertices.length; i++) {
      this.typedArrayVertices[i] = 1;
    }
  }

  createIndexBuffer() {
    this.indexBuffer = this.device.createBuffer({
      label: "indices",
      size: this.typedArrayIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    const totalVertices = this.typedArrayIndices.length / 6;

    for (let i = 0; i < totalVertices; i++) {
      for (let j = 0; j < 6; j++) {
        this.typedArrayIndices[i * 6 + j] = j * totalVertices + i;
      }
    }
  }

  createStorageBuffer() {
    this.storageBuffer = this.device.createBuffer({
      label: "storage",
      size: this.typedArrayStorage.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  uploadVertices() {
    if (!this.vertexBuffer) {
      console.warn("Vertex buffer not set.");
      return;
    }

    this.device.queue.writeBuffer(
      this.vertexBuffer,
      0,
      this.typedArrayVertices
    );
  }

  uploadIndices(indices?: Uint32Array) {
    if (!this.indexBuffer) {
      console.warn("Index buffer not set.");
      return;
    }

    if (indices) {
      this.typedArrayIndices = indices;
    }

    this.device.queue.writeBuffer(this.indexBuffer, 0, this.typedArrayIndices);
  }

  uploadStorage(byteStart: number, byteEnd: number) {
    if (!this.storageBuffer) {
      console.warn("Storage buffer not set.");
      return;
    }

    this.device.queue.writeBuffer(
      this.storageBuffer,
      byteStart,
      this.typedArrayStorage,
      byteStart / Float32Array.BYTES_PER_ELEMENT,
      (byteEnd - byteStart) / Float32Array.BYTES_PER_ELEMENT
    );
  }
}
