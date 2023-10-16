// import debounce from "lodash.debounce";
import { Loader } from "./loader/loader";
import { Renderer } from "./renderer/renderer";
import { OrbitCamera } from "./orbit-camera";
import { vec3, mat4 } from "gl-matrix";
import { Splats } from "./splats";
import { Uniforms } from "./uniforms";
import { Sorter } from "./sorter/sorter";
import { Pane } from "./pane";

const initTime = Date.now();
let renderer: Renderer = new Renderer("canvas");
await renderer.init();
let uniforms: Uniforms = new Uniforms({ device: renderer.device!, initTime });
const camera = new OrbitCamera({
  position: vec3.fromValues(-5, 0, 0),
  lookAt: vec3.fromValues(0, -1, -0.2),
});
const loader = new Loader("/truck/point_cloud.ply", initTime);
new Pane(uniforms, camera);

let splats: Splats | null = null;

async function start() {
  uniforms.modelMatrix = mat4.fromXRotation(mat4.create(), -0.1);
  uniforms.viewMatrix = camera.getViewMatrix();
  uniforms.projectionMatrix = camera.getProjectionMatrix();
  uniforms.cameraPos = camera.controls.position;

  let firstChunkLoaded = false;
  loader.load();
  loader.addEventListener("update", (e: CustomEventInit) => {
    if (!firstChunkLoaded) {
      onFirstChunk(e.detail);
      firstChunkLoaded = true;
    }

    splats!.uploadStorage(e.detail.info.byteStart, e.detail.info.byteEnd);
    renderer.draw(loader.processedSplats);
    uniforms.setTime();
  });

  loader.addEventListener("end", async () => {
    const sorter = new Sorter(
      loader.attributes.splats,
      loader.floatsPerSplatOut
    );
    sorter.addEventListener("sorted", () => {
      splats?.uploadIndices(sorter.output);
      renderer.draw(loader.processedSplats);
    });
    const loop = () => {
      sorter.update(camera.controls.position);
      requestAnimationFrame(loop);
    };
    loop();
  });

  // on camera change
  camera.addEventListener("change", () => {
    uniforms.projectionMatrix = camera.getProjectionMatrix();
    uniforms.viewMatrix = camera.getViewMatrix();
    uniforms.cameraPos = camera.controls.position;
  });

  // render on uniforms change (camera, splatSize, etc.)
  uniforms.addEventListener("change", () => {
    renderer.draw(loader.processedSplats);

    // make sure the last buffer upload is also rendered
    // (note: this won't render twice per frame because the renderer uses a draw queue)
    requestAnimationFrame(() => {
      renderer.draw(loader.processedSplats);
    });
  });

  // window resize listener
  window.addEventListener("resize", () => {
    uniforms.screen = [window.innerWidth, window.innerHeight];
    uniforms.projectionMatrix = camera.getProjectionMatrix();
  });
}

function onFirstChunk(detail: any) {
  if (!renderer) {
    throw new Error("no renderer");
  }

  if (!uniforms) {
    throw new Error("no uniforms");
  }

  splats = new Splats({
    device: renderer.device!,
    vertices: detail.attributes.splats,
    vertexCount: detail.info.totalSplats,
  });

  splats.uploadIndices();
  splats.uploadVertices();

  uniforms.numSplats = detail.info.totalSplats;

  renderer.setIndexBuffer(splats.indexBuffer!);
  renderer.setVertexBuffer(splats.vertexBuffer!);
  renderer.createRenderPipeline();
  renderer.createBindGroup0(splats.storageBuffer!);
  renderer.createBindGroup1(uniforms.buffer!);
}

start();
