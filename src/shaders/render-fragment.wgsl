@fragment
fn fragmentMain(
    @location(0) color_and_opacity: vec4f
    ) -> @location(0) vec4f {
    return vec4f(color_and_opacity.xyz, 1.0);
}
