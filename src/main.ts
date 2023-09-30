import debounce from "lodash.debounce";
import { Loader } from "./loader/loader";
import { Renderer } from "./renderer/renderer";
import { PerspectiveCamera } from "./perspective-camera";
import { vec3, mat4 } from "gl-matrix";
import { Splats } from "./splats";
import { Uniforms } from "./uniforms";
import { Sorter } from "./sorter/sorter";

let splats: Splats | null = null;
let renderer: Renderer | null = null;
let uniforms: Uniforms | null = null;
const sorter = new Sorter();
const loader = new Loader("/train/point_cloud.ply");
const camera = new PerspectiveCamera({
  position: vec3.fromValues(10, 0, 10),
  lookAt: vec3.fromValues(0, 0, 0),
});

async function start() {
  renderer = new Renderer("canvas");
  await renderer.init();

  uniforms = new Uniforms({ device: renderer.device! });
  uniforms.modelMatrix = mat4.create();
  uniforms.viewMatrix = camera.getViewMatrix();
  uniforms.projectionMatrix = camera.getProjectionMatrix();
  uniforms.cameraPos = camera.position;

  let firstChunkLoaded = false;

  loader.load();

  loader.addEventListener("update", (e: CustomEventInit) => {
    if (!firstChunkLoaded) {
      onFirstChunk(e.detail);
      firstChunkLoaded = true;
    }

    if (splats) {
      splats.uploadStorage(e.detail.info.byteStart, e.detail.info.byteEnd);
      renderer!.draw(loader.processedSplats);
    }
  });

  loader.addEventListener("end", async () => {
    await sorter.init(loader.attributes.splats, 4, loader.floatsPerSplatOut);
  });

  // render on camera change
  camera.addEventListener("change", () => {
    if (!uniforms) return;
    uniforms.projectionMatrix = camera.getProjectionMatrix();
    uniforms.viewMatrix = camera.getViewMatrix();
    uniforms.cameraPos = camera.position;

    renderer?.draw(loader.processedSplats);

    // make sure the last buffer upload is also rendered
    // (note: this won't render twice per frame because the renderer uses a draw queue)
    requestAnimationFrame(() => {
      renderer?.draw(loader.processedSplats);
    });
  });

  // sort on camera change
  const debouncedSort = debounce(
    () => {
      const [x, y, z] = camera.position;
      sorter.sortByDistance({ x, y, z }).then((sortedIndices) => {
        splats?.uploadIndices(sortedIndices);
        renderer?.draw(loader.processedSplats);
      });
    },
    1000,
    { maxWait: 1000 }
  );
  camera.addEventListener("change", debouncedSort);

  // window resize listener
  window.addEventListener("resize", () => {
    if (splats && uniforms && renderer) {
      uniforms.screen = [window.innerWidth, window.innerHeight];
      uniforms.projectionMatrix = camera.getProjectionMatrix();
      renderer.draw(loader.processedSplats);
    }
  });

  // const pane = new Pane();
  // pane.addEventListener("change", () => {
  //   state.setUniforms();
  // });

  // camera.addEventListener('change', () => {
  //   sorter.sort(state.indexBuffer, () => state.uploadIndexBuffer()
  // })
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
  renderer.setIndexBuffer(splats.indexBuffer!);
  renderer.setVertexBuffer(splats.vertexBuffer!);

  renderer.createRenderPipeline();
  renderer.createBindGroup0(splats.storageBuffer!);
  renderer.createBindGroup1(uniforms.buffer!);
}

start();
