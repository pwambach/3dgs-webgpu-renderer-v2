struct RenderOutput {
    position: vec3f,
    opacity: f32,
    v1: vec2f,
    v2: vec2f,
    m: vec2f,
    color: vec3f,
}

@group(0) @binding(0) var<storage, read> output: array<RenderOutput>;

struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) color_and_opacity: vec4f,
    @location(1) uv: vec2f
}

@vertex
fn vertexMain(
    @location(0) offset: vec2f,
    @builtin(instance_index) instance_index: u32
) -> VertexOut {
    var data = output[instance_index];
    
    // get the quad vertice from both eigenvectors 
    var position = (offset.x * data.v1 + offset.y * data.v2) * data.m;

    // set outputs
    var output: VertexOut;
    // add bbox offset to splat clip position
    output.position = vec4f(data.position.xy + position, data.position.z, 1);
    output.color_and_opacity = vec4(data.color, data.opacity);
    output.uv = offset;
    return output;
}
