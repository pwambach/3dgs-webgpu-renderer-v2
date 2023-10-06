@fragment
fn fragmentMain(
    @location(0) color_and_opacity: vec4f,
    @location(2) uv: vec2f
    ) -> @location(0) vec4f {
    // just gaussian distribution formular https://en.wikipedia.org/wiki/Normal_distribution
    var g = exp(-0.5 * uv * uv * 8); // *8 ?
    var a = saturate(g.x * g.y * color_and_opacity.w);
    return vec4(color_and_opacity.xyz * a, a);
}
