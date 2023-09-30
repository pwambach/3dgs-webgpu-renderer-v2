struct Splat {
    rotation: vec4f,
    position: vec3f,
    opacity: f32,
    scale: vec3f,
    sh: vec3f
}

struct Uniforms {
    modelMatrix: mat4x4f,
    viewMatrix: mat4x4f,
    projMatrix: mat4x4f,
    cameraPos: vec3f,
    splatSize: f32,
    screen: vec2f
};

@group(0) @binding(0) var<storage> splats: array<Splat>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOut {
    @builtin(position) position: vec4f
}

@vertex
fn vertexMain(
    @location(0) xxx: f32,
    @builtin(vertex_index) vertex_index: u32
) -> VertexOut {
        var index = vertex_index % 559263;
        var offset_index = (vertex_index / 559263);
        var splat = splats[index];

        var p = array<vec2f, 6>(vec2f(-1,-1), vec2f(1,-1), vec2f(1,1), vec2f(-1,-1), vec2f(1,1), vec2f(-1,1));
        var vertex_offset = p[offset_index];
        // var vertex_offset = vec2f(f32(offset_index&1), f32((offset_index>>1)&1)) * 2 - 1;

        var clip_position = uniforms.projMatrix * uniforms.viewMatrix * vec4f(splat.position, 1);
        clip_position = vec4f(clip_position.xy + vertex_offset * 0.005, clip_position.zw);
        var output: VertexOut;
        output.position = clip_position;
        return output;
}

@fragment
fn fragmentMain(
    ) -> @location(0) vec4f {
    return vec4f(0.0, 0.0, 1.0, 1.0);
}
