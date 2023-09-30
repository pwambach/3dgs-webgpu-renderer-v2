import { mat4, vec3 } from "gl-matrix";

// struct Uniforms {
//     modelMatrix: mat4x4f, 0
//     viewMatrix: mat4x4f, 16
//     projMatrix: mat4x4f, 32
//     cameraPos: vec3f, 48
//     splatSize: f32, 51
//     screen: vec2f, 52
// };

export class Uniforms {
  private device: GPUDevice;
  private dirty = false;
  private numValues = 16 + 16 + 16 + 3 + 1 + 2 + 2;
  private typedArray = new Float32Array(this.numValues);
  buffer?: GPUBuffer;

  constructor({ device }: { device: GPUDevice }) {
    this.device = device;

    const loop = () => {
      if (this.dirty && this.buffer) {
        device.queue.writeBuffer(this.buffer, 0, this.typedArray);
        this.dirty = false;
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
}
