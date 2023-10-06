struct Splat {
    rotation: vec4f,
    position: vec3f,
    opacity: f32,
    scale: vec3f,
    sh: array<vec3f, 16>
}

struct Uniforms {
    model_matrix: mat4x4f,
    view_matrix: mat4x4f,
    proj_matrix: mat4x4f,
    camera_pos: vec3f,
    splat_size: f32,
    screen: vec2f,
    num_splats: u32,
    num_sh_degrees: u32
};

const SH0 = 0.28209479177387814f;
const SH1 = 0.4886025119029199f;
const SH2 = array(
    1.0925484305920792f,
    -1.0925484305920792f,
    0.31539156525252005f,
    -1.0925484305920792f,
    0.5462742152960396f
);
const SH3 = array(
    -0.5900435899266435f,
    2.890611442640554f,
    -0.4570457994644658f,
    0.3731763325901154f,
    -0.4570457994644658f,
    1.445305721320277f,
    -0.5900435899266435f
);

@group(0) @binding(0) var<storage> splats: array<Splat>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) color_and_opacity: vec4f,
    @location(2) uv: vec2f
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

    // splat projection
    var rot_scale_mat = getRotScaleMatrix(splat.rotation, scale);
    // cov3d from rotation and scale (see https://datascienceplus.com/understanding-the-covariance-matrix)
    var cov3d = rot_scale_mat * transpose(rot_scale_mat);
    var cov2d = covariance2D(splat.position, uniforms.view_matrix * uniforms.model_matrix, uniforms.proj_matrix, cov3d);
    
    // calculate eigenvectors to get gaussian bounding box 
    var det: f32 = cov2d.x * cov2d.z - cov2d.y * cov2d.y;
    var mean = 0.5 * (cov2d.x + cov2d.z);

    // eigenvalues
    var l1 = mean + sqrt(mean * mean - det);
    var l2 = mean - sqrt(mean * mean - det);
    
    var a = cov2d.x;
    var b = cov2d.y;
    var d = cov2d.z;

    // eigenvectors
    var v1 = normalize(vec2f(b, d - l2)) * sqrt(l1);
    var v2 = normalize(vec2f(v1.y, -v1.x)) * sqrt(l2);

    // bbox quad
    var p = array<vec2f, 6>(
        v1 - v2,
        v1 + v2, 
        -(v1 + v2),
        v1 + v2,
        -(v1 + v2),
        -(v1 - v2)
    );

    var position = p[offset_index] * 6 / uniforms.screen;

    // uv values
    var uv = array<vec2f, 6>(
        vec2(1,1),
        vec2(-1,1),
        vec2(1,-1),
        vec2(-1,1),
        vec2(1,-1),
        vec2(-1,-1)
    );

    // set outputs
    var output: VertexOut;
    output.position = vec4f(position, 0, 1);
    output.color_and_opacity = vec4(calcColor(splat.position, splat.sh), splat.opacity);
    output.uv = uv[offset_index];
    return output;
}

fn calcColor(splat_position: vec3f, coeffs: array<vec3f, 16>) -> vec3f {
    let dir = normalize(splat_position - uniforms.camera_pos); 
    var color = SH0 * coeffs[0] + 0.5; // sh degree = 0
    
    // sh degree = 1
    if (uniforms.num_sh_degrees > 0) {
        color += SH1 * (-dir.y * coeffs[1] + dir.z * coeffs[2] - dir.x * coeffs[3]);

        // sh degree = 2
        if (uniforms.num_sh_degrees > 1) {
            let xx = dir.x * dir.x;
            let yy = dir.y * dir.y;
            let zz = dir.z * dir.z;
            let xy = dir.x * dir.y;
            let xz = dir.x * dir.z;
            let yz = dir.y * dir.z;

            color +=
                SH2[0] * xy * coeffs[4] +
                SH2[1] * yz * coeffs[5] +
                SH2[2] * (2. * zz - xx - yy) * coeffs[6] +
                SH2[3] * xz * coeffs[7] +
                SH2[4] * (xx - yy) * coeffs[8];

            // sh degree = 3
            if (uniforms.num_sh_degrees > 2) {
                color +=
                    SH3[0] * dir.y * (3. * xx - yy) * coeffs[9] +
                    SH3[1] * xy * dir.z * coeffs[10] +
                    SH3[2] * dir.y * (4. * zz - xx - yy) * coeffs[11] +
                    SH3[3] * dir.z * (2. * zz - 3. * xx - 3. * yy) * coeffs[12] +
                    SH3[4] * dir.x * (4. * zz - xx - yy) * coeffs[13] +
                    SH3[5] * dir.z * (xx - yy) * coeffs[14] +
                    SH3[6] * dir.x * (xx - 3. * yy) * coeffs[15];
            }
        }
    }

    return max(color, vec3f(0));
}

fn getRotScaleMatrix(rot: vec4f, scale: vec3f) -> mat3x3f {
    let r = rot[0];
    let x = rot[1];
    let y = rot[2];
    let z = rot[3];


    // rotate again
    var rot2 = mat3x3f(
        1, 0, 0,
        0, -1, 0,
        0, 0, -1
    );

    // rotation matrix * scale matrix
    return rot2 * mat3x3f(
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
fn covariance2D(world_pos: vec3f, view_mat: mat4x4f, proj_mat: mat4x4f, cov3d: mat3x3f) -> vec3f {
    var view_pos: vec3f = (view_mat * vec4f(world_pos, 1)).xyz;

    // this is needed in order for splats that are visible in view but clipped "quite a lot" to work
    let aspect: f32 = proj_mat[0][0] / proj_mat[1][1];
    let tanFovX: f32 = 1 / (proj_mat[0][0]);
    let tanFovY: f32 = 1 /(proj_mat[1][1] * aspect);
    let limX: f32 = 1.3 * tanFovX;
    let limY: f32 = 1.3 * tanFovY;
    view_pos.x = clamp(view_pos.x / view_pos.z, -limX, limX) * view_pos.z;
    view_pos.y = clamp(view_pos.y / view_pos.z, -limY, limY) * view_pos.z;

    let focal = uniforms.screen.x * proj_mat[0][0] / 2;

    // Jacobian
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

    var V = mat4x4f(
        cov3d[0][0], cov3d[1][0], cov3d[2][0], 0,
        cov3d[1][0], cov3d[1][1], cov3d[2][1], 0,
        cov3d[2][0], cov3d[2][1], cov3d[2][2], 0,
        0, 0, 0, 0
    );

    var cov2d: mat4x4f = T * V * transpose(T);

    // Low pass filter to make each splat at least 1px size.
    cov2d[0][0] += 0.3;
    cov2d[1][1] += 0.3;

    // we only need a,b and d of the 2x2 matrix because b = c
    return vec3f(cov2d[0][0], cov2d[0][1], cov2d[1][1]);
}





// // ------------


// struct Splat {
//     rotation: vec4f,
//     position: vec3f,
//     opacity: f32,
//     scale: vec3f,
//     sh: array<vec3f, 16>
// }

// struct Uniforms {
//     model_matrix: mat4x4f,
//     view_matrix: mat4x4f,
//     proj_matrix: mat4x4f,
//     camera_pos: vec3f,
//     splat_size: f32,
//     screen: vec2f,
//     num_splats: u32,
//     num_sh_degrees: u32
// };

// @group(0) @binding(0) var<storage> splats: array<Splat>;
// @group(1) @binding(0) var<uniform> uniforms: Uniforms;

// struct VertexOut {
//     @builtin(position) position: vec4f,
//     @location(0) color_and_opacity: vec4f,
//     @location(1) conic: vec3f,
//     @location(2) uv: vec2f,
//     @location(3) @interpolate(flat) v_index: u32,
// }

// @vertex
// fn vertexMain(
//     @location(0) xxx: f32,
//     @builtin(vertex_index) vertex_index: u32
// ) -> VertexOut {
//     var index = vertex_index % uniforms.num_splats;
//     var offset_index = (vertex_index / uniforms.num_splats);
//     var splat = splats[index];
//     var scale = splat.scale * uniforms.splat_size;

//     // SPLAT PROJECTION
//     var rot_scale_mat = getRotScaleMatrix(splat.rotation, scale);
//     // see https://datascienceplus.com/understanding-the-covariance-matrix/ "C=RSSR^−1=TT^T"
//     var cov3d = rot_scale_mat * transpose(rot_scale_mat);
//     var cov2d = covariance2D(splat.position, uniforms.view_matrix, uniforms.proj_matrix, cov3d);
//     var det: f32 = cov2d.x * cov2d.z - cov2d.y * cov2d.y;
//     var mean = 0.5 * (cov2d.x + cov2d.z);

//     // eigenvalues
//     var l1 = mean + sqrt(mean * mean - det);
//     var l2 = mean - sqrt(mean * mean - det);
    
//     var a = cov2d.x;
//     var b = cov2d.y;
//     var d = cov2d.z;

//     // eigenvectors
//     var v1 = normalize(vec2f(b, d - l2)) * sqrt(l1);
//     var v2 = normalize(vec2f(v1.y, -v1.x)) * sqrt(l2);

//     var p = array<vec2f, 6>(
//         v1 - v2,
//         v1 + v2, 
//         -(v1 + v2),
//         v1 + v2,
//         -(v1 + v2),
//         -(v1 - v2)
//     );

//     var uv = array<vec2f, 6>(
//         vec2(1,1),
//         vec2(-1,1),
//         vec2(1,-1),
//         vec2(-1,1),
//         vec2(1,-1),
//         vec2(-1,-1)
//     );
        
//     var vertex_offset = p[offset_index] * 6 / uniforms.screen;

//     // set outputs
//     var output: VertexOut;
//     output.position = vec4f(vertex_offset, 0, 1);
//     output.color_and_opacity = vec4(vec3f(1,0,1), splat.opacity);
//     output.conic = vec3f(0);
//     output.uv = uv[offset_index];
//     output.v_index = offset_index;
//     return output; 
// }

// @fragment
// fn fragmentMain(
//     @location(0) color_and_opacity: vec4f,
//     @location(1) conic: vec3f,
//     @location(2) uv: vec2f,
//      @location(3) @interpolate(flat) v_index: u32
//     ) -> @location(0) vec4f {
//        // just gaussian distribution formular https://en.wikipedia.org/wiki/Normal_distribution
//         var g = exp(-0.5 * uv * uv * 8); // *8 ?
//         var a = saturate(g.x * g.y * color_and_opacity.w);
//       	return vec4(a, 0, 0, a);
// }


// fn getRotScaleMatrix(rot: vec4f, scale: vec3f) -> mat3x3f {
//     let r = rot[0];
//     let x = rot[1];
//     let y = rot[2];
//     let z = rot[3];


//     // rotate again
//     var rot2 = mat3x3f(
//         1, 0, 0,
//         0, -1, 0,
//         0, 0, -1
//     );

//     // rotation matrix * scale matrix
//     return rot2 * mat3x3f(
//         1-2*(y*y + z*z), 2*(x*y + r*z), 2*(x*z - r*y),
//         2*(x*y - r*z), 1-2*(x*x + z*z), 2*(y*z + r*x),
//         2*(x*z + r*y), 2*(y*z - r*x), 1-2*(x*x + y*y)
//     ) * mat3x3f(
//         scale.x, 0, 0,
//         0, scale.y, 0,
//         0, 0, scale.z
//     );
// }

// // main parts from https://github.com/aras-p/UnityGaussianSplatting/tree/main
// // from "EWA Splatting" (Zwicker et al 2002) eq. 31
// fn covariance2D(world_pos: vec3f, view_mat: mat4x4f, proj_mat: mat4x4f, cov3d: mat3x3f) -> vec3f {
//     var view_pos: vec3f = (view_mat * vec4f(world_pos, 1)).xyz;

//     // this is needed in order for splats that are visible in view but clipped "quite a lot" to work
//     let aspect: f32 = proj_mat[0][0] / proj_mat[1][1];
//     let tanFovX: f32 = 1 / (proj_mat[0][0]);
//     let tanFovY: f32 = 1 /(proj_mat[1][1] * aspect);
//     let limX: f32 = 1.3 * tanFovX;
//     let limY: f32 = 1.3 * tanFovY;
//     view_pos.x = clamp(view_pos.x / view_pos.z, -limX, limX) * view_pos.z;
//     view_pos.y = clamp(view_pos.y / view_pos.z, -limY, limY) * view_pos.z;

//     // Jacobian
//     let focal = uniforms.screen.x * proj_mat[0][0] / 2;

//     // self transposed
//     var J = transpose(mat4x4f(
//         focal / view_pos.z, 0, -(focal * view_pos.x) / (view_pos.z * view_pos.z), 0,
//         0, focal / view_pos.z, -(focal * view_pos.y) / (view_pos.z * view_pos.z), 0,
//         0, 0, 0, 0,
//         0, 0, 0, 0
//     ));

//     var W: mat4x4f = view_mat;
//     W[3][0] = 0; // ? why
//     W[3][1] = 0; // ? why
//     W[3][2] = 0; // ? why

//     var T: mat4x4f = J * W;

//     var cov3d0 = vec3f(cov3d[0][0], cov3d[1][0], cov3d[2][0]);
//     var cov3d1 = vec3f(cov3d[1][1], cov3d[2][1], cov3d[2][2]);

//     // self transposed
//     var V = transpose(mat4x4f(
//         cov3d0.x, cov3d0.y, cov3d0.z, 0,
//         cov3d0.y, cov3d1.x, cov3d1.y, 0,
//         cov3d0.z, cov3d1.y, cov3d1.z, 0,
//         0, 0, 0, 0
//     ));

//     var cov2d: mat4x4f = T * V * transpose(T);

//     // Low pass filter to make each splat at least 1px size.
//     cov2d[0][0] += 0.3;
//     cov2d[1][1] += 0.3;

//     // we only need a,b and d of the 2x2 matrix because b = c
//     return vec3f(cov2d[0][0], cov2d[0][1], cov2d[1][1]);
// }
