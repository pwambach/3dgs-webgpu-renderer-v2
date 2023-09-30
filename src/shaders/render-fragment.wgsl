// main parts from https://github.com/aras-p/UnityGaussianSplatting/tree/main

@fragment
fn fragmentMain(
    @location(0) color_and_opacity: vec4f,
    @location(1) conic: vec3f,
    @location(2) uv_px: vec2f
    ) -> @location(0) vec4f {
    // return vec4f(color_and_opacity.xyz, 1.0);
    let p = -0.5 * (conic.x * uv_px.x * uv_px.x + conic.z * uv_px.y * uv_px.y) + conic.y * uv_px.x * uv_px.y;
    var a = color_and_opacity.w * saturate(exp(p));

    if (a < 0.004) {
        discard;
    }

    return vec4<f32>(color_and_opacity.xyz * a, a);
}