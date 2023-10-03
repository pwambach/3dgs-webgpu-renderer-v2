export async function getDevice() {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter();

  if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
  }

  const device = await adapter.requestDevice({
    requiredLimits: {
      maxBufferSize: 2048 * 1024 * 1024,
      maxStorageBufferBindingSize: 2048 * 1024 * 1024,
    },
  });

  if (!device) {
    throw new Error("Could not get device.");
  }

  return device;
}
