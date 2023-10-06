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


// @fragment
// fn fragmentMain(
//     @location(0) color_and_opacity: vec4f,
//     @location(1) conic: vec3f,
//     @location(2) uv_px: vec2f
//     ) -> @location(0) vec4f {
//     // return vec4f(color_and_opacity.xyz, 1.0);
//     let p = -0.5 * (conic.x * uv_px.x * uv_px.x + conic.z * uv_px.y * uv_px.y) + conic.y * uv_px.x * uv_px.y;
//     var a = color_and_opacity.w * saturate(exp(p));

//     if (a < 0.004) {
//         discard;
//     }

//     return vec4<f32>(color_and_opacity.xyz * a, a);
// }