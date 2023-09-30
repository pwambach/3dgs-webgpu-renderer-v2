import { Loader } from "./loader/loader";
import { Renderer } from "./renderer/renderer";
import { PerspectiveCamera } from "./perspective-camera";
import { vec3, mat4 } from "gl-matrix";
import { Splats } from "./splats";
import { Uniforms } from "./uniforms";

let splats: Splats | null = null;
let renderer: Renderer | null = null;
let loader = new Loader("/train/point_cloud.ply");

async function start() {
  renderer = new Renderer("canvas");
  await renderer.init();

  let firstChunkLoaded = false;

  loader.load();

  loader.addEventListener("update", (e: CustomEventInit) => {
    if (!firstChunkLoaded) {
      onFirstChunk(e.detail);
      firstChunkLoaded = true;
    }

    if (splats) {
      splats.uploadStorage(e.detail.info.byteStart, e.detail.info.byteEnd);
      renderer!.draw({
        vertexBuffer: splats!.vertexBuffer!,
        indexBuffer: splats!.indexBuffer!,
        vertexCount: loader.processedSplats,
      });
    }
  });

  loader.addEventListener("end", () => {
    renderer!.draw({
      vertexBuffer: splats!.vertexBuffer!,
      indexBuffer: splats!.indexBuffer!,
      vertexCount: loader.splatCount,
    });
  });

  // const pane = new Pane();
  // pane.addEventListener("change", () => {
  //   state.setUniforms();
  // });

  // const sorter = new Sorter()
  // camera.addEventListener('change', () => {
  //   sorter.sort(state.indexBuffer, () => state.uploadIndexBuffer()
  // })
}

function onFirstChunk(detail: any) {
  if (!renderer) {
    throw new Error("no renderer");
  }

  splats = new Splats({
    device: renderer.device!,
    vertices: detail.attributes.splats,
    vertexCount: detail.info.totalSplats,
  });

  splats.uploadIndices();
  splats.uploadVertices();

  const uniforms = new Uniforms({ device: renderer.device! });
  renderer.createRenderPipeline();
  renderer.createBindGroup0(splats.storageBuffer!);
  renderer.createBindGroup1(uniforms.buffer!);

  const camera = new PerspectiveCamera({
    position: vec3.fromValues(10, 0, 10),
    lookAt: vec3.fromValues(0, 0, 0),
  });

  uniforms.projectionMatrix = camera.getProjectionMatrix();
  uniforms.viewMatrix = camera.getViewMatrix();
  uniforms.cameraPos = camera.position;

  uniforms.modelMatrix = mat4.create();
  camera.addEventListener("change", () => {
    uniforms.projectionMatrix = camera.getProjectionMatrix();
    uniforms.viewMatrix = camera.getViewMatrix();
    uniforms.cameraPos = camera.position;

    if (splats && renderer && splats.vertexBuffer && splats.indexBuffer) {
      renderer.draw({
        vertexBuffer: splats.vertexBuffer,
        indexBuffer: splats.indexBuffer,
        vertexCount: detail.info.totalSplats,
      });
    }
  });

  window.addEventListener("resize", () => {
    uniforms.screen = [window.innerWidth, window.innerHeight];
    if (splats && renderer && splats.vertexBuffer && splats.indexBuffer) {
      renderer.draw({
        vertexBuffer: splats.vertexBuffer,
        indexBuffer: splats.indexBuffer,
        vertexCount: loader.splatCount,
      });
    }
  });
}

start();
