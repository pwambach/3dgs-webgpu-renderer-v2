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
const loader = new Loader("/truck/point_cloud2.ply", initTime);
const pane = new Pane(uniforms, camera);

let splats: Splats | null = null;

async function start() {
  uniforms.modelMatrix = mat4.fromXRotation(mat4.create(), -0.2);
  uniforms.viewMatrix = camera.getViewMatrix();
  uniforms.projectionMatrix = camera.getProjectionMatrix();
  uniforms.cameraPos = camera.controls.position;
  uniforms.numShDegrees = 3;

  let firstChunkLoaded = false;
  loader.load();
  loader.addEventListener("update", (e: CustomEventInit) => {
    if (!firstChunkLoaded) {
      onFirstChunk(e.detail);
      firstChunkLoaded = true;
    }

    splats!.uploadSplats(e.detail.info.byteStart, e.detail.info.byteEnd);
    renderer.draw(loader.splatCount, pane.params.splatLimit);
    uniforms.setTime();

    if (!pane.params.splatCount) {
      pane.setSplatCount(loader.splatCount);
    }
  });

  loader.addEventListener("end", async () => {
    splats?.uploadSplats(0, 0);

    const sorter = new Sorter(
      loader.attributes.splats,
      loader.floatsPerSplatOut
    );

    sorter.addEventListener("sorted", () => {
      splats?.uploadSort(sorter.indices);
      renderer.draw(loader.splatCount, pane.params.splatLimit);
    });

    const loop = () => {
      sorter.update(camera.controls.position);
      requestAnimationFrame(loop);
    };
    loop();

    let loadAnimation = true;
    const loadAnimationLoop = () => {
      if (!loadAnimation) return;
      uniforms.setTime();
      requestAnimationFrame(loadAnimationLoop);
    };
    loadAnimationLoop();

    setTimeout(() => {
      loadAnimation = false;
    }, 10000);
  });

  // on camera change
  camera.addEventListener("change", () => {
    uniforms.projectionMatrix = camera.getProjectionMatrix();
    uniforms.viewMatrix = camera.getViewMatrix();
    uniforms.cameraPos = camera.controls.position;
  });

  // render on uniforms change (camera, splatSize, etc.)
  uniforms.addEventListener("change", () => {
    renderer.draw(loader.splatCount, pane.params.splatLimit);

    // make sure the last buffer upload is also rendered
    // (note: this won't render twice per frame because the renderer uses a draw queue)
    // requestAnimationFrame(() => {
    //   renderer.draw(loader.splatCount, pane.params.splatLimit);
    // });
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

  uniforms.numSplats = loader.splatCount;

  splats = new Splats({
    device: renderer.device!,
    splats: detail.attributes.splats,
    numSplatFloats: loader.floatsPerSplatOut,
    numOutputFloats: 12,
  });

  renderer.setVertexBuffer(splats.vertexBuffer);
  renderer.createRenderPipeline();
  renderer.createBindGroupsData(
    splats.splatsBuffer,
    splats.outputBuffer,
    splats.sortBuffer
  );
  renderer.createBindGroupUniforms(uniforms.buffer!);
}

start();
