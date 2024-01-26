# WebGPU Viewer for 3D Gaussian Splatting

This is an experimental web renderer for 3D Gaussian Splatting data (original paper: [INRIA](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting)).

https://github.com/pwambach/3dgs-webgpu-renderer-v2/assets/1611635/c88ad3a2-d08b-4351-9159-1ba2baec6cdc

Features:

- ✅ WebGPU based custom rendering pipeline
- ✅ Compute shaders for minimal calculation redundancy
- ✅ Streamed Data Loading and Rendering
- ✅ WebWorker for data parsing
- ✅ WebWorker for splat sorting
- ✅ Integration of camera and orbit controls from three.js
- 🚧 GPU Sorting
- 🚧 Support for compressed splats
- 🚧 GPU Memory optimizations (float16, compressed textures, etc. see (https://aras-p.info/blog/2023/09/13/Making-Gaussian-Splats-smaller)
