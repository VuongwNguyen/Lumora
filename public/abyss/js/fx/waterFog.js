import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Hấp thụ theo BƯỚC SÓNG cho toàn scene.
//
// fog_fragment gốc của three là một phép lerp ĐƠN SẮC:
//
//     gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
//
// Mọi kênh màu mất đi cùng một tốc độ, nên vật ở xa không "chìm vào nước" mà
// chỉ *ngả dần về đúng một màu*. Đó chính xác là cảm giác "3D scene phủ teal",
// và không lượng saturation hay fog density nào chữa được — sai ở mô hình.
//
// Nước biển hấp thụ đỏ nhanh hơn lam khoảng ba lần (đỏ ~0.45/m, lục ~0.12/m,
// lam ~0.02/m ở nước trong). Đó là lý do thợ lặn thấy máu chảy ra màu xanh lục
// và ảnh dưới nước không chỉnh màu thì luôn ám lam. Tách hệ số dập tắt thành
// ba kênh là đủ để mắt đọc ra "vật này đang ở dưới nước", và chỉ tốn thêm vài
// phép nhân trên mỗi fragment.
//
// TỈ LỆ, không phải giá trị tuyệt đối: fogDensity vẫn do core/depth.js điều
// khiển theo bảng D90 của mục 13.2. Ba số dưới đây nhân vào density đó, và
// trung bình có trọng số theo độ sáng (0.2126, 0.7152, 0.0722) ra ~1.11 — tức
// tầm nhìn tổng thể gần như giữ nguyên bảng cũ, chỉ khác là giờ nó CÓ MÀU.
//
// Áp dụng qua ShaderChunk nên MỌI vật liệu có fog đều hưởng: 40+ material của
// abyss không phải sửa một dòng nào, và vật liệu thêm sau này cũng tự đúng.
// ---------------------------------------------------------------------------

export const ABSORPTION = Object.freeze({ r: 1.50, g: 1.00, b: 0.78 });

const WATER_FOG_FRAGMENT = `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		// Giữ nguyên dạng exp2 của three (fogDensity * dist bình phương) để bảng
		// D90 mục 13.2 còn đọc được, chỉ tách density thành ba kênh.
		vec3 opticalDepth = fogDensity * vec3( ${ABSORPTION.r}, ${ABSORPTION.g}, ${ABSORPTION.b} ) * vFogDepth;
		vec3 transmittance = exp( - opticalDepth * opticalDepth );
		// Beer-Lambert: phần còn sót lại của vật + phần nước tán xạ vào thay chỗ.
		gl_FragColor.rgb = gl_FragColor.rgb * transmittance + fogColor * ( 1.0 - transmittance );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
	#endif
#endif
`;

let patched = false;

// Vá TRƯỚC khi bất kỳ vật liệu nào compile. Gọi lại nhiều lần vô hại.
//
// Kiểm tra `vFogDepth` trước khi ghi đè: tên varying này chỉ có từ r150 trở đi
// (trước đó là `fogDepth`). Nếu ai đó nâng/hạ phiên bản three trong importmap
// mà chunk đổi hình dạng, thà giữ fog gốc còn hơn đẩy ra một shader không
// compile được và mất trắng cả scene.
export function patchWaterFog() {
  if (patched) return true;
  const original = THREE.ShaderChunk.fog_fragment;
  if (typeof original !== 'string' || !original.includes('vFogDepth')) {
    console.warn('[abyss] fog_fragment không đúng hình dạng r152, giữ fog gốc của three');
    return false;
  }
  THREE.ShaderChunk.fog_fragment = WATER_FOG_FRAGMENT;
  patched = true;
  return true;
}
