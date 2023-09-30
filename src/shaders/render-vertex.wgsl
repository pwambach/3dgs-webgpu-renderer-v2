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

const SH0 = 0.28209479177387814f;

@group(0) @binding(0) var<storage> splats: array<Splat>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) color_and_opacity: vec4f,
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
        // var vertex_offset = vec2f(f32(offset_index&1), f32((offset_index>>1)&1)) * 2 - 1;
        var vertex_offset = p[offset_index];

        var clip_position = uniforms.projMatrix * uniforms.viewMatrix * vec4f(splat.position, 1);
        clip_position = vec4f(clip_position.xy + vertex_offset * 0.02, clip_position.zw);
        var output: VertexOut;
        output.position = clip_position;
        output.color_and_opacity = vec4(calcColor(splat.sh), splat.opacity);
        return output;
}

fn calcColor(coeffs: vec3f) -> vec3f {
    return SH0 * coeffs + 0.5;
}
