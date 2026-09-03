// Dò sức mạnh thiết bị và co ảnh cho vừa với nó. Dùng chung cho mọi universe.
//
// Là ES module, KHÔNG phải script cổ điển gắn biến vào window như các file khác
// trong thư mục này: nó chỉ được import từ universe (đều là `type="module"`),
// nên không cần đi vòng qua global.

export function detectPerformanceTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const pixelRatio = window.devicePixelRatio || 1;
  const lowPower = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') && (cores <= 4 || memory <= 4);
  if (lowPower || cores <= 2 || memory <= 2) return 'low';
  if (pixelRatio > 1.5 || cores >= 8 || memory >= 8) return 'high';
  return 'mid';
}

// Ảnh của Lumora nằm trên ImageKit, và ImageKit resize được PHÍA SERVER. Điều
// đó quan trọng hơn vẻ ngoài của nó: trình duyệt sẽ GIẢI NÉN một tấm 768px chứ
// không phải 2145px, tức là ít hơn ~8 lần công decode trên luồng chính và ít
// hơn ~8 lần bitmap trong RAM. Cách thu nhỏ bằng canvas (abyss/scene/relics.js)
// tiết kiệm được VRAM nhưng VẪN phải tải và giải nén bản gốc trước.
//
// `c-at_max` co ảnh vừa trong hộp maxEdge×maxEdge, giữ tỉ lệ, và KHÔNG phóng to
// ảnh vốn đã nhỏ hơn — nên nó chặn đúng CẠNH DÀI NHẤT bất kể ảnh dọc hay ngang.
// Đã kiểm: 1242×2145 -> 445×768, 156 KB -> 34 KB.
export function sizedImageUrl(url, maxEdge) {
  if (!url || !maxEdge) return url;
  try {
    const u = new URL(url, location.href);
    if (!/(^|\.)imagekit\.io$/i.test(u.hostname)) return url;
    // Ảnh đã có sẵn transform thì tôn trọng: người dùng hoặc backend đã chọn.
    if (u.searchParams.has('tr')) return url;
    u.searchParams.set('tr', `w-${maxEdge},h-${maxEdge},c-at_max`);
    return u.toString();
  } catch {
    return url;
  }
}
