import { getDevice } from "../webgpu";
import renderShaderCode from "../shaders/render.wgsl?raw";

export class Renderer {
  private canvas: HTMLCanvasElement | null;
  private ctx: GPUCanvasContext | null;
  private renderShaderModule?: GPUShaderModule;
  private canvasFormat?: GPUTextureFormat;
  private renderPipeline?: GPURenderPipeline;
  private bindGroup0?: GPUBindGroup;
  private bindGroup0Layout?: GPUBindGroupLayout;
  private bindGroup1?: GPUBindGroup;
  private bindGroup1Layout?: GPUBindGroupLayout;
  device?: GPUDevice;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

    if (!this.canvas) {
      throw new Error(`Canvas element '${canvasId}' not found.`);
    }

    this.ctx = this.canvas.getContext("webgpu");

    if (!this.ctx) {
      throw new Error("Cannot create GPU context.");
    }

    const handleResize = () => {
      this.canvas!.width = window.innerWidth;
      this.canvas!.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);
  }

  async init() {
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.device = await getDevice();

    this.ctx!.configure({
      device: this.device,
      format: this.canvasFormat,
      alphaMode: "opaque",
    });

    this.renderShaderModule = this.device.createShaderModule({
      label: "render shader",
      code: renderShaderCode,
    });
  }

  createRenderPipeline() {
    if (!this.renderShaderModule) {
      throw new Error("Shader module not defined");
    }

    if (!this.device) {
      throw new Error("Device not ready");
    }

    if (!this.canvasFormat) {
      throw new Error("Canvas format not defined");
    }

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 14 * 4,
      attributes: [
        {
          format: "float32x4",
          offset: 0,
          shaderLocation: 0,
        },
        {
          format: "float32x3",
          offset: 16,
          shaderLocation: 1,
        },
        {
          format: "float32",
          offset: 28,
          shaderLocation: 2,
        },
        {
          format: "float32x3",
          offset: 32,
          shaderLocation: 3,
        },
        {
          format: "float32x3",
          offset: 44,
          shaderLocation: 4,
        },
      ],
    };

    this.bindGroup0Layout = this.device.createBindGroupLayout({
      label: "bind group layout 0",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });

    this.bindGroup1Layout = this.device.createBindGroupLayout({
      label: "bind group layout 1",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform",
          },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroup0Layout, this.bindGroup1Layout],
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: "render pipeline",
      layout: pipelineLayout,
      vertex: {
        module: this.renderShaderModule,
        entryPoint: "vertexMain",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: this.renderShaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: this.canvasFormat,
            blend: {
              color: {
                srcFactor: "one-minus-dst-alpha",
                dstFactor: "one",
                operation: "add",
              },
              alpha: {
                srcFactor: "one-minus-dst-alpha",
                dstFactor: "one",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
    });
  }

  createBindGroup0(storageBuffer: GPUBuffer) {
    if (!this.device || !this.bindGroup0Layout) {
      throw new Error("Device not ready");
    }

    this.bindGroup0 = this.device.createBindGroup({
      label: "bind group 0",
      layout: this.bindGroup0Layout,
      entries: [
        {
          binding: 0,
          resource: { buffer: storageBuffer },
        },
      ],
    });
  }

  createBindGroup1(uniformsBuffer: GPUBuffer) {
    if (!this.device || !this.bindGroup1Layout) {
      throw new Error("Device not ready");
    }

    this.bindGroup1 = this.device.createBindGroup({
      label: "bind group 1",
      layout: this.bindGroup1Layout,
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformsBuffer },
        },
      ],
    });
  }

  draw({
    vertexBuffer,
    indexBuffer,
    vertexCount,
  }: {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    vertexCount: number;
  }) {
    if (!this.device || !this.ctx || !this.renderPipeline) {
      return;
    }

    const encoder = this.device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.ctx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(this.renderPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, "uint32");
    pass.setBindGroup(0, this.bindGroup0!);
    pass.setBindGroup(1, this.bindGroup1!);
    pass.drawIndexed(vertexCount * 6);
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }
}
