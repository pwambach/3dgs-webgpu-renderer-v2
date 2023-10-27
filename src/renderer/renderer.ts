import { getDevice } from "../webgpu";
import computeCode from "../shaders/compute.wgsl?raw";
import renderVertexCode from "../shaders/render-vertex.wgsl?raw";
import renderFragmentCode from "../shaders/render-fragment.wgsl?raw";

export class Renderer {
  private canvas: HTMLCanvasElement | null;
  private ctx: GPUCanvasContext | null;
  private computeModule?: GPUShaderModule;
  private renderVertexModule?: GPUShaderModule;
  private renderFragmentModule?: GPUShaderModule;
  private canvasFormat?: GPUTextureFormat;
  private renderPipeline?: GPURenderPipeline;
  private computePipeline?: GPUComputePipeline;
  private bindGroupDataCompute?: GPUBindGroup;
  private bindGroupSort?: GPUBindGroup;
  private bindGroupSortLayout?: GPUBindGroupLayout;
  private bindGroupDataComputeLayout?: GPUBindGroupLayout;
  private bindGroupDataRender?: GPUBindGroup;
  private bindGroupDataRenderLayout?: GPUBindGroupLayout;
  private bindGroupUniforms?: GPUBindGroup;
  private bindGroupUniformsLayout?: GPUBindGroupLayout;
  private vertexBuffer?: GPUBuffer;
  private nextDrawCount = 0;
  private nextDrawLimit = 0;
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
      this.canvas!.width = window.innerWidth * window.devicePixelRatio;
      this.canvas!.height = window.innerHeight * window.devicePixelRatio;
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

    this.computeModule = this.device.createShaderModule({
      label: "compute shader",
      code: computeCode,
    });

    this.renderVertexModule = this.device.createShaderModule({
      label: "render vertex shader",
      code: renderVertexCode,
    });

    this.renderFragmentModule = this.device.createShaderModule({
      label: "render fragment shader",
      code: renderFragmentCode,
    });

    this.startDrawLoop();
  }

  setVertexBuffer(buffer: GPUBuffer) {
    this.vertexBuffer = buffer;
  }

  createRenderPipeline() {
    if (!this.renderVertexModule || !this.renderFragmentModule) {
      throw new Error("Shader modules not defined");
    }

    if (!this.device) {
      throw new Error("Device not ready");
    }

    if (!this.canvasFormat) {
      throw new Error("Canvas format not defined");
    }

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 2 * 4,
      attributes: [
        {
          format: "float32x2",
          offset: 0,
          shaderLocation: 0,
        },
      ],
    };

    this.bindGroupDataComputeLayout = this.device.createBindGroupLayout({
      label: "bind group data compute layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "read-only-storage",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "storage",
          },
        },
      ],
    });

    this.bindGroupSortLayout = this.device.createBindGroupLayout({
      label: "bind group sort layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });

    this.bindGroupDataRenderLayout = this.device.createBindGroupLayout({
      label: "bind group data render layout",
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

    this.bindGroupUniformsLayout = this.device.createBindGroupLayout({
      label: "bind group layout uniforms",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform",
          },
        },
      ],
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          this.bindGroupDataComputeLayout,
          this.bindGroupSortLayout,
          this.bindGroupUniformsLayout,
        ],
      }),
      compute: {
        module: this.computeModule!,
        entryPoint: "main",
      },
    });

    const renderPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupDataRenderLayout],
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: "render pipeline",
      layout: renderPipelineLayout,
      vertex: {
        module: this.renderVertexModule,
        entryPoint: "vertexMain",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: this.renderFragmentModule,
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

  createBindGroupsData(
    splatsBuffer: GPUBuffer,
    outputBuffer: GPUBuffer,
    sortBuffer: GPUBuffer
  ) {
    if (
      !this.device ||
      !this.bindGroupDataComputeLayout ||
      !this.bindGroupDataRenderLayout ||
      !this.bindGroupSortLayout
    ) {
      throw new Error("Device not ready");
    }

    this.bindGroupDataCompute = this.device.createBindGroup({
      label: "bind group data compute",
      layout: this.bindGroupDataComputeLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: splatsBuffer },
        },
        {
          binding: 1,
          resource: { buffer: outputBuffer },
        },
      ],
    });

    this.bindGroupSort = this.device.createBindGroup({
      label: "bind group sort",
      layout: this.bindGroupSortLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: sortBuffer },
        },
      ],
    });

    this.bindGroupDataRender = this.device.createBindGroup({
      label: "bind group data render",
      layout: this.bindGroupDataRenderLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: outputBuffer },
        },
      ],
    });
  }

  createBindGroupUniforms(uniformsBuffer: GPUBuffer) {
    if (!this.device || !this.bindGroupUniformsLayout) {
      throw new Error("Device not ready");
    }

    this.bindGroupUniforms = this.device.createBindGroup({
      label: "bind group uniforms",
      layout: this.bindGroupUniformsLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformsBuffer },
        },
      ],
    });
  }

  startDrawLoop() {
    const loop = () => {
      if (this.nextDrawCount > 0) {
        this.drawVertices(this.nextDrawCount, this.nextDrawLimit);
        this.nextDrawCount = 0;
      }

      requestAnimationFrame(loop);
    };

    loop();
  }

  draw(count: number, limit: number) {
    this.nextDrawCount = count;
    this.nextDrawLimit = limit;
  }

  drawVertices(count: number, limit: number) {
    if (
      count === 0 ||
      limit === 0 ||
      !this.device ||
      !this.ctx ||
      !this.renderPipeline ||
      !this.computePipeline ||
      !this.vertexBuffer
    ) {
      return;
    }

    const encoder = this.device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.bindGroupDataCompute!);
    computePass.setBindGroup(1, this.bindGroupSort!);
    computePass.setBindGroup(2, this.bindGroupUniforms!);
    computePass.dispatchWorkgroups(Math.ceil(count / 128));
    computePass.end();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.ctx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setBindGroup(0, this.bindGroupDataRender!);
    renderPass.draw(6, limit);
    renderPass.end();

    this.device.queue.submit([encoder.finish()]);
  }
}
