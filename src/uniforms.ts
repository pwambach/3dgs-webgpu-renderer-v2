import { mat4, vec3 } from "gl-matrix";

// struct Uniforms {
//     model_matrix: mat4x4f, 0
//     view_matrix: mat4x4f, 16
//     proj_matrix: mat4x4f, 32
//     camera_pos: vec3f, 48
//     splat_size: f32, 51
//     screen: vec2f, 52
//     num_splats: u32, 54
//     time: f32, 55
// };

export class Uniforms extends EventTarget {
  private device: GPUDevice;
  private dirty = false;
  private numValues = 16 + 16 + 16 + 3 + 1 + 2 + 1 + 1 + 4; // last "1" ist for alignment
  private typedArray = new Float32Array(this.numValues);
  private initTime: number;
  buffer?: GPUBuffer;

  constructor({ device, initTime }: { device: GPUDevice; initTime: number }) {
    super();
    this.device = device;
    this.initTime = initTime;

    const loop = () => {
      if (this.dirty && this.buffer) {
        this.setTime();
        device.queue.writeBuffer(this.buffer, 0, this.typedArray);
        this.dirty = false;
        this.dispatchEvent(new Event("change"));
      }
      requestAnimationFrame(loop);
    };

    this.splatSize = 1;
    this.screen = [window.innerWidth, window.innerHeight];
    this.createBuffer();

    loop();
  }

  createBuffer() {
    this.buffer = this.device.createBuffer({
      label: "uniforms",
      size: this.typedArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  set modelMatrix(m: mat4) {
    this.typedArray.set(m, 0);
    this.dirty = true;
  }

  set viewMatrix(m: mat4) {
    this.typedArray.set(m, 16);
    this.dirty = true;
  }

  set projectionMatrix(m: mat4) {
    this.typedArray.set(m, 32);
    this.dirty = true;
  }

  set cameraPos(v: vec3) {
    this.typedArray.set(v, 48);
    this.dirty = true;
  }

  set splatSize(v: number) {
    this.typedArray[51] = v;
    this.dirty = true;
  }

  set screen(s: [number, number]) {
    this.typedArray.set(s, 52);
    this.dirty = true;
  }

  set numSplats(v: number) {
    const u32array = new Uint32Array(this.typedArray.buffer);
    u32array.set([v], 54);
    this.dirty = true;
  }

  set numShDegrees(v: number) {
    const u32array = new Uint32Array(this.typedArray.buffer);
    u32array.set([v], 55);
    this.dirty = true;
  }

  setTime() {
    this.typedArray.set([Date.now() - this.initTime], 56);
    this.dirty = true;
  }
}
