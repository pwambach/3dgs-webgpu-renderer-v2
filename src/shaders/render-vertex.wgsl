struct Splat {
    rotation: vec4f,
    position: vec3f,
    opacity: f32,
    scale: vec3f,
    sh: vec3f
}

struct Uniforms {
    model_matrix: mat4x4f,
    view_matrix: mat4x4f,
    proj_matrix: mat4x4f,
    camera_pos: vec3f,
    splat_size: f32,
    screen: vec2f,
    num_splats: u32
};

const SH0 = 0.28209479177387814f;

@group(0) @binding(0) var<storage> splats: array<Splat>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) color_and_opacity: vec4f,
    @location(1) conic: vec3f,
    @location(2) uv_px: vec2f
}

@vertex
fn vertexMain(
    @location(0) xxx: f32,
    @builtin(vertex_index) vertex_index: u32
) -> VertexOut {
        var index = vertex_index % uniforms.num_splats;
        var offset_index = (vertex_index / uniforms.num_splats);
        var splat = splats[index];

        var scale = splat.scale * uniforms.splat_size;

        // SPLAT PROJECTION
        var rot_scale_mat = getRotScaleMatrix(normalize(splat.rotation), scale);
        // see https://datascienceplus.com/understanding-the-covariance-matrix/ "C=RSSR^−1=TT^T"
        var cov3d = rot_scale_mat * transpose(rot_scale_mat);

        var cov2d = covariance2D(splat.position, uniforms.view_matrix, uniforms.proj_matrix, cov3d);
        var det: f32 = cov2d[0][0] * cov2d[1][1] - cov2d[1][0] * cov2d[1][0];
        
        var clip_position = uniforms.proj_matrix * uniforms.view_matrix * vec4f(splat.position, 1);
        var w: f32 = clip_position.w;

        var mid: f32 = 0.5 * (cov2d[0][0] + cov2d[1][1]);
        var lambda1: f32 = mid + sqrt(max(0.1f, mid * mid - det));
        var lambda2: f32 = mid - sqrt(max(0.1f, mid * mid - det));
        var radius_px: f32 = ceil(3 * sqrt(max(lambda1, lambda2)));
        var radius_ndc = vec2f(radius_px) / uniforms.screen;

        var p = array<vec2f, 6>(vec2f(-1,-1), vec2f(1,-1), vec2f(1,1), vec2f(-1,-1), vec2f(1,1), vec2f(-1,1));
        var vertex_offset = p[offset_index];
        // var vertex_offset = vec2f(f32(offset_index&1), f32((offset_index>>1)&1)) * 2 - 1;

        var output: VertexOut;
        // output.position = uniforms.proj_matrix * uniforms.view_matrix * vec4f(splat.position, 1);
        // output.position = vec4f(output.position.xy + vertex_offset * 0.005, output.position.zw);
        output.position = vec4f(clip_position.xy / w + 2 * radius_ndc * vertex_offset, clip_position.z / w, 1);
        output.color_and_opacity = vec4(calcColor(splat.sh), splat.opacity);
        output.conic = vec3f(cov2d[1][1], cov2d[1][0], cov2d[0][0]) * (1 / det);
        output.uv_px = vertex_offset * radius_px;
        return output;
}

fn calcColor(coeffs: vec3f) -> vec3f {
    return SH0 * coeffs + 0.5;
}

fn getRotScaleMatrix(rot: vec4f, scale: vec3f) -> mat3x3f {
    let r = rot[0];
    let x = rot[1];
    let y = rot[2];
    let z = rot[3];

    // rotation matrix * scale matrix
    return mat3x3f(
        1-2*(y*y + z*z), 2*(x*y + r*z), 2*(x*z - r*y),
        2*(x*y - r*z), 1-2*(x*x + z*z), 2*(y*z + r*x),
        2*(x*z + r*y), 2*(y*z - r*x), 1-2*(x*x + y*y)
    ) * mat3x3f(
        scale.x, 0, 0,
        0, scale.y, 0,
        0, 0, scale.z
    );
}

// main parts from https://github.com/aras-p/UnityGaussianSplatting/tree/main
// from "EWA Splatting" (Zwicker et al 2002) eq. 31
fn covariance2D(world_pos: vec3f, view_mat: mat4x4f, proj_mat: mat4x4f, cov3d: mat3x3f) -> mat4x4f {
    var view_pos: vec3f = (view_mat * vec4f(world_pos, 1)).xyz;

    // this is needed in order for splats that are visible in view but clipped "quite a lot" to work
    let aspect: f32 = proj_mat[0][0] / proj_mat[1][1];
    let tanFovX: f32 = 1 / (proj_mat[0][0]);
    let tanFovY: f32 = 1 /(proj_mat[1][1] * aspect);
    let limX: f32 = 1.3 * tanFovX;
    let limY: f32 = 1.3 * tanFovY;
    view_pos.x = clamp(view_pos.x / view_pos.z, -limX, limX) * view_pos.z;
    view_pos.y = clamp(view_pos.y / view_pos.z, -limY, limY) * view_pos.z;

    // Jacobian
    let focal = uniforms.screen.x * proj_mat[0][0] / 2;

    // self transposed
    var J = transpose(mat4x4f(
        focal / view_pos.z, 0, -(focal * view_pos.x) / (view_pos.z * view_pos.z), 0,
        0, focal / view_pos.z, -(focal * view_pos.y) / (view_pos.z * view_pos.z), 0,
        0, 0, 0, 0,
        0, 0, 0, 0
    ));

    var W: mat4x4f = view_mat;
    W[3][0] = 0; // ? why
    W[3][1] = 0; // ? why
    W[3][2] = 0; // ? why

    var T: mat4x4f = J * W;

    var cov3d0 = vec3f(cov3d[0][0], cov3d[1][0], cov3d[2][0]);
    var cov3d1 = vec3f(cov3d[1][1], cov3d[2][1], cov3d[2][2]);

    // self transposed
    var V = transpose(mat4x4f(
        cov3d0.x, cov3d0.y, cov3d0.z, 0,
        cov3d0.y, cov3d1.x, cov3d1.y, 0,
        cov3d0.z, cov3d1.y, cov3d1.z, 0,
        0, 0, 0, 0
    ));

    var cov2d: mat4x4f = T * V * transpose(T);

    // Low pass filter to make each splat at least 1px size.
    cov2d[0][0] += 0.3;
    cov2d[1][1] += 0.3;

    return cov2d;
}
