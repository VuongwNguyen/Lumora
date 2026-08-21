/**
 * Cổng telemetry dùng chung cho QA tự động (tests/visual).
 *
 * Chỉ bật khi URL có ?debug=1 — production không lộ thêm gì. Mục đích là biến
 * "scene trông ổn" thành số đọc được: draw call, tam giác, fps, texture MB.
 *
 * Dùng trong universe:
 *
 *   window.LumoraDebug?.attach({ template: 'aurora', scene, camera, renderer });
 *
 * Gọi được ở bất kỳ đâu miễn ba object kia đã tồn tại. Trả về handle hoặc null
 * khi không bật debug, nên chỗ gọi không cần kiểm tra gì thêm.
 *
 * Tự đếm fps bằng rAF riêng thay vì bắt universe phải tự đo — mỗi universe có
 * một vòng animate khác nhau và ta không muốn sửa vòng đó chỉ để lấy fps.
 */
(function attachLumoraDebug(root) {
  const ENABLED = new URLSearchParams(root.location.search).get('debug') === '1';

  function sampleFps() {
    let frames = 0;
    let fps = 0;
    let since = root.performance.now();
    (function tick() {
      frames += 1;
      const now = root.performance.now();
      if (now - since >= 500) {
        fps = Math.round((frames * 1000) / (now - since));
        frames = 0;
        since = now;
      }
      root.requestAnimationFrame(tick);
    })();
    return () => fps;
  }

  // Ước lượng VRAM texture: RGBA8 + mipmap đầy đủ = w * h * 4 * 4/3.
  function textureBytes(scene) {
    let bytes = 0;
    const counted = new Set();
    scene.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        for (const key of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap']) {
          const image = material[key]?.image;
          if (!image?.width || counted.has(material[key])) continue;
          counted.add(material[key]);
          bytes += image.width * image.height * 4 * 4 / 3;
        }
      }
    });
    return Math.round(bytes / 1e6);
  }

  root.LumoraDebug = {
    get enabled() { return ENABLED; },

    attach({ template, scene, camera, renderer, extra = {} } = {}) {
      if (!ENABLED) return null;
      if (!template || !scene || !renderer) {
        console.warn('[LumoraDebug] thiếu template/scene/renderer, bỏ qua');
        return null;
      }
      const fps = sampleFps();
      const handle = {
        template,
        scene,
        camera,
        renderer,
        get info() { return renderer.info; },
        get fps() { return fps(); },
        get textureBytes() { return textureBytes(scene); },
        get canvas() {
          const element = renderer.domElement;
          return {
            css: { w: Math.round(element.clientWidth), h: Math.round(element.clientHeight) },
            buffer: { w: element.width, h: element.height },
          };
        },
      };
      // KHÔNG dùng `...extra`: object spread GỌI getter rồi copy giá trị, không
      // copy accessor — mọi getter trong extra sẽ bị đóng băng ở giá trị lúc
      // attach. Đã cắn thật: `depth` của abyss mãi báo 40 dù camera đã đi 300 m.
      Object.defineProperties(handle, Object.getOwnPropertyDescriptors(extra));
      root.__lumora = handle;
      return handle;
    },
  };
})(window);
