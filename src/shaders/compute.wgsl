struct Splat {
    position: vec3f,
    opacity: f32,
    cov3d1: vec3f,
    load_time: f32,
    cov3d2: vec3f,
    sh: array<vec3f, 16>
}

struct RenderData {
    position: vec3f,
    opacity: f32,
    v1: vec2f,
    v2: vec2f,
    m: vec2f,
    color: vec3f,
}

struct Uniforms {
    model_matrix: mat4x4f,
    view_matrix: mat4x4f,
    proj_matrix: mat4x4f,
    camera_pos: vec3f,
    splat_size: f32,
    screen: vec2f,
    num_splats: u32,
    num_sh_degrees: u32,
    time: f32,
};

@group(0) @binding(0) var<storage, read> splats: array<Splat>;
@group(0) @binding(1) var<storage, read_write> output: array<RenderData>;
@group(1) @binding(0) var<storage, read> sort_indices: array<u32>;
@group(2) @binding(0) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(8,8)
fn main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups: vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(global_invocation_id) global_invocation_id: vec3<u32>,
    ) {
    // let workgroup_index =  
    //     workgroup_id.x +
    //     workgroup_id.y * num_workgroups.x +
    //     workgroup_id.z * num_workgroups.x * num_workgroups.y;

    let workgroup_index = workgroup_id.x * num_workgroups.x + workgroup_id.y;

    let global_invocation_index = workgroup_index * 64 + local_invocation_index;

    if (global_invocation_index >= uniforms.num_splats) {
        var data: RenderData;
        data.position = vec3(9,9,9);
        data.v1 = vec2f(0);
        data.v2 = vec2f(0);
        data.m = vec2f(0);
        output[global_invocation_index] = data;
        return;
    }

    var sorted_index: u32 = sort_indices[global_invocation_index];
    var splat = splats[sorted_index];

     // get the clip position of the center of the splat 
    var clip_position = uniforms.proj_matrix * uniforms.view_matrix * uniforms.model_matrix * vec4f(splat.position, 1);
    clip_position = clip_position / clip_position.w;

    // cov2d vec3 is (a, b, d) of the 2x2 matrix
    var cov2d = covariance2D(splat.position, splat.cov3d1, splat.cov3d2);
    
    // calculate eigenvectors to get gaussian bounding box 
    var det: f32 = cov2d.x * cov2d.z - cov2d.y * cov2d.y;
    var mean = 0.5 * (cov2d.x + cov2d.z);

    // eigenvalues (see https://www.youtube.com/watch?v=e50Bj7jn9IQ)
    var l1 = mean + sqrt(mean * mean - det);
    var l2 = mean - sqrt(mean * mean - det);
    
    // eigenvectors (see https://people.math.harvard.edu/~knill/teaching/math21b2004/exhibits/2dmatrices/index.html)
    var v1 = normalize(vec2f(cov2d.y, cov2d.z - l2)) * sqrt(l1);
    var v2 = normalize(vec2f(v1.y, -v1.x)) * sqrt(l2);

    // get the quad vertice from both eigenvectors 
    var m = 6 / uniforms.screen * uniforms.splat_size * 1;//saturate(max(0, uniforms.time - splat.load_time) / 1000); // not 100% sure why * 6 fits

    // set outputs
    var data: RenderData;
    data.position = clip_position.xyz;
    data.v1 = v1;
    data.v2 = v2;
    data.m = m;
    data.color = calcColor(splat.position, splat.sh);
    data.opacity = splat.opacity;
    
    output[global_invocation_index] = data;
}


// main parts from https://github.com/aras-p/UnityGaussianSplatting/tree/main
// (see also "EWA Splatting" Zwicker et al 2002)
fn covariance2D(world_pos: vec3f, cov3d1: vec3f, cov3d2: vec3f) -> vec3f {
    var view_mat = uniforms.view_matrix * uniforms.model_matrix;
    var view_pos: vec3f = (view_mat * vec4f(world_pos, 1)).xyz;

    // "this is needed in order for splats that are visible in view but clipped "quite a lot" to work"
    // TODO check what exactly is going on here
    let tanFovX: f32 = 1 / (uniforms.proj_matrix[0][0]);
    let tanFovY: f32 = 1 / (uniforms.proj_matrix[1][1] * (uniforms.proj_matrix[0][0] / uniforms.proj_matrix[1][1]));
    let limX: f32 = 1.3 * tanFovX;
    let limY: f32 = 1.3 * tanFovY;
    view_pos.x = clamp(view_pos.x / view_pos.z, -limX, limX) * view_pos.z;
    view_pos.y = clamp(view_pos.y / view_pos.z, -limY, limY) * view_pos.z;

    let f = uniforms.screen.x * uniforms.proj_matrix[0][0] / 2;

    // Jacobian
    // self transposed
    var J = transpose(mat3x3f(
        f / view_pos.z, 0, -(f * view_pos.x) / (view_pos.z * view_pos.z),
        0, f / view_pos.z, -(f * view_pos.y) / (view_pos.z * view_pos.z),
        0, 0, 0
    ));

    var W = mat3x3f(
        view_mat[0][0], view_mat[0][1], view_mat[0][2],
        view_mat[1][0], view_mat[1][1], view_mat[1][2],
        view_mat[2][0], view_mat[2][1], view_mat[2][2],
    );

    var T: mat3x3f = J * W;

    var V = mat3x3f(
        cov3d1.x, cov3d2.x, cov3d2.y,
        cov3d2.x, cov3d1.y, cov3d2.z,
        cov3d2.y, cov3d2.z, cov3d1.z
    );

    var cov2d: mat3x3f = T * V * transpose(T);

    // Make each splat at least 1px size.
    cov2d[0][0] += 0.25;
    cov2d[1][1] += 0.25;

    // We only need a,b and d of the 2x2 matrix because b = c
    return vec3f(cov2d[0][0], cov2d[0][1], cov2d[1][1]);
}

// calculate the colors from the spherical harmonics coefficients
fn calcColor(splat_position: vec3f, coeffs: array<vec3f, 16>) -> vec3f {
    let dir = normalize(splat_position - uniforms.camera_pos); 
    var color = 0.28209479177387814f * coeffs[0] + 0.5; // sh degree = 0
    
    // sh degree = 1
    if (uniforms.num_sh_degrees > 0) {
        color += 0.4886025119029199f * (-dir.y * coeffs[1] + dir.z * coeffs[2] - dir.x * coeffs[3]);

        // sh degree = 2
        if (uniforms.num_sh_degrees > 1) {
            let xx = dir.x * dir.x;
            let yy = dir.y * dir.y;
            let zz = dir.z * dir.z;
            let xy = dir.x * dir.y;
            let xz = dir.x * dir.z;
            let yz = dir.y * dir.z;

            color +=
                1.0925484305920792f * xy * coeffs[4] +
                -1.0925484305920792f * yz * coeffs[5] +
                0.31539156525252005f * (2. * zz - xx - yy) * coeffs[6] +
                -1.0925484305920792f * xz * coeffs[7] +
                0.5462742152960396f * (xx - yy) * coeffs[8];

            // sh degree = 3
            if (uniforms.num_sh_degrees > 2) {
                color +=
                    -0.5900435899266435f * dir.y * (3. * xx - yy) * coeffs[9] +
                    2.890611442640554f * xy * dir.z * coeffs[10] +
                    -0.4570457994644658f * dir.y * (4. * zz - xx - yy) * coeffs[11] +
                    0.3731763325901154f * dir.z * (2. * zz - 3. * xx - 3. * yy) * coeffs[12] +
                    -0.4570457994644658f * dir.x * (4. * zz - xx - yy) * coeffs[13] +
                    1.445305721320277f * dir.z * (xx - yy) * coeffs[14] +
                    -0.5900435899266435f * dir.x * (xx - 3. * yy) * coeffs[15];
            }
        }
    }

    return max(color, vec3f(0));
}