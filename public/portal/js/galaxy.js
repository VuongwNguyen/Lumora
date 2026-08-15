class GalaxyManager {
  constructor() {
    this.galaxyId = new URLSearchParams(window.location.search).get('galaxyId');
    this.token = localStorage.getItem('token');
    this.uploadPolicy = null;
    this.init();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.25s ease forwards';
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  async init() {
    if (!this.galaxyId || !this.token) {
      window.location.href = '/portal/';
      return;
    }
    await this.loadUploadPolicy();
    this.setupLightbox();
    this.setupEventListeners();
    await this.loadImages();
    await this.loadGalaxyInfo();
  }

  async loadUploadPolicy() {
    try {
      const response = await fetch('/gallary/upload-policy');
      if (!response.ok) throw new Error('upload policy unavailable');
      this.uploadPolicy = (await response.json()).meta;
      const maxSizeMb = this.uploadPolicy.maxTotalSize / 1024 / 1024;
      document.getElementById('uploadHint').textContent = window.t.setupUploadLimits(
        this.uploadPolicy.maxFiles,
        maxSizeMb,
      );
      document.getElementById('fileInput').accept = this.uploadPolicy.mimeTypes.join(',');
    } catch {
      this.showToast(window.t.setupUploadPolicyFail, 'error');
    }
  }

  setupLightbox() {
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    document.getElementById('lightbox-close').addEventListener('click', () => lb.classList.remove('open'));
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.classList.remove('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('open'); });
    this._openLightbox = (src) => { lbImg.src = src; lb.classList.add('open'); };
  }

  setupEventListeners() {
    document.getElementById('uploadBtn').onclick = () => this.handleUpload();
    document.getElementById('copyLinkBtn').onclick = () => this.copyGalaxyLink();
    document.getElementById('deleteGalaxyBtn').onclick = () => this.deleteGalaxy();

    document.getElementById('fileInput').onchange = (e) => {
      const count = e.target.files.length;
      const hint = document.getElementById('uploadHint');
      hint.textContent = count > 0
        ? window.t.filesSelected(count)
        : window.t.uploadHint;
    };

    const zone = document.getElementById('uploadZone');
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
      const itemFiles = Array.from(e.dataTransfer?.items || [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter(Boolean);
      const files = itemFiles.length ? itemFiles : Array.from(e.dataTransfer?.files || []);
      if (files.length) {
        const input = document.getElementById('fileInput');
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        input.files = dt.files;
        document.getElementById('uploadHint').textContent = window.t.filesSelected(files.length);
        void this.handleUpload();
      }
    });
  }

  async loadGalaxyInfo() {
    try {
      const res = await fetch(`/galaxies/${this.galaxyId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const galaxy = await res.json();
        const name = galaxy.name || galaxy.meta?.name || 'Galaxy';
        this._galaxyTemplate = galaxy.template || galaxy.meta?.template || 'galaxy';
        document.getElementById('galaxyName').textContent = name;
        document.title = `${name} — Portal`;
      }
    } catch (e) {
      console.error('Error loading galaxy info:', e);
    }
  }

  async loadImages() {
    try {
      const res = await fetch(`/gallary/my-items?galaxyId=${this.galaxyId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (!res.ok) throw new Error('Failed to load images');
      const data = await res.json();
      this.renderImages(data.meta || []);
    } catch (e) {
      console.error('Error loading images:', e);
      const grid = document.getElementById('imageGrid');
      const empty = document.createElement('div');
      empty.className = 'grid-empty';
      const icon = document.createElement('div');
      icon.className = 'empty-icon';
      icon.textContent = '⚠️';
      const msg = document.createElement('div');
      msg.textContent = window.t.loadError;
      empty.appendChild(icon);
      empty.appendChild(msg);
      grid.replaceChildren(empty);
    }
  }

  renderImages(images) {
    const grid = document.getElementById('imageGrid');
    const label = document.getElementById('imagesLabel');

    label.textContent = window.t.images;

    if (images.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'grid-empty';
      const icon = document.createElement('div');
      icon.className = 'empty-icon';
      icon.textContent = '🌌';
      const msg = document.createElement('div');
      msg.textContent = window.t.noImages;
      empty.appendChild(icon);
      empty.appendChild(msg);
      grid.replaceChildren(empty);
      return;
    }

    const badge = document.createElement('span');
    badge.className = 'count-badge';
    badge.textContent = images.length;
    label.appendChild(badge);

    const items = images.map(image => {
      const wrap = document.createElement('div');
      wrap.className = 'masonry-item';

      const img = document.createElement('img');
      img.src = `${image.imageUrl}?tr=w-500,q-80`;
      img.alt = image.title || '';
      img.loading = 'lazy';
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => this._openLightbox(`${image.imageUrl}?tr=w-1200,q-90`));

      const overlay = document.createElement('div');
      overlay.className = 'masonry-overlay';

      const del = document.createElement('button');
      del.className = 'delete-image';
      del.title = 'Delete';
      del.textContent = '×';
      del.addEventListener('click', () => this.deleteImage(image._id));

      overlay.appendChild(del);
      wrap.appendChild(img);
      wrap.appendChild(overlay);
      return wrap;
    });

    grid.replaceChildren(...items);
  }

  async handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    if (files.length === 0) {
      this.showToast(window.t.selectImages, 'error');
      return;
    }
    if (!this.uploadPolicy) {
      this.showToast(window.t.setupUploadPolicyFail, 'error');
      return;
    }
    if (files.length > this.uploadPolicy.maxFiles) {
      this.showToast(window.t.setupUploadTooMany(this.uploadPolicy.maxFiles), 'error');
      return;
    }
    const unsupported = Array.from(files).find(file => !this.uploadPolicy.mimeTypes.includes(file.type));
    if (unsupported) {
      this.showToast(window.t.setupUploadUnsupported(unsupported.name), 'error');
      return;
    }
    const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
    if (totalSize > this.uploadPolicy.maxTotalSize) {
      this.showToast(window.t.setupUploadTotalTooLarge(
        this.uploadPolicy.maxTotalSize / 1024 / 1024,
      ), 'error');
      return;
    }

    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    formData.append('title', 'Uploaded image');
    formData.append('description', 'Image uploaded from portal');

    const progressWrap = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressLabel = document.getElementById('progressLabel');
    progressWrap.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const percent = Math.round(event.loaded / event.total * 100);
          progressBar.style.width = `${percent}%`;
          progressLabel.textContent = `${window.t.uploading} ${percent}%`;
        }
      };
      xhr.onload = () => {
        progressWrap.classList.add('hidden');
        if (xhr.status >= 200 && xhr.status < 300) {
          fileInput.value = '';
          document.getElementById('uploadHint').textContent = window.t.setupUploadLimits(
            this.uploadPolicy.maxFiles,
            this.uploadPolicy.maxTotalSize / 1024 / 1024,
          );
          this.loadImages();
          this.showToast(window.t.uploadSuccess, 'success');
        } else {
          this.showToast(window.t.uploadFailed, 'error');
        }
      };
      xhr.onerror = () => {
        progressWrap.classList.add('hidden');
        this.showToast(window.t.uploadFailed, 'error');
      };
      xhr.open('POST', `/gallary/upload?galaxyId=${encodeURIComponent(this.galaxyId)}`);
      xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      xhr.send(formData);
    } catch (e) {
      console.error('Upload error:', e);
      this.showToast(window.t.uploadFailed, 'error');
      progressWrap.classList.add('hidden');
    }
  }

  async deleteImage(imageId) {
    if (!confirm(window.t.confirmDeleteImage)) return;
    try {
      const res = await fetch(`/gallary/items/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        this.loadImages();
        this.showToast(window.t.imageDeleted, 'success');
      } else {
        this.showToast(window.t.deleteImageFailed, 'error');
      }
    } catch (e) {
      console.error('Delete error:', e);
      this.showToast(window.t.deleteImageFailed, 'error');
    }
  }

  copyGalaxyLink() {
    const link = `${window.location.origin}/view/?galaxyId=${this.galaxyId}`;
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast(window.t.linkCopied, 'success');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => this.showToast(window.t.linkCopied, 'success'))
        .catch(fallback);
    } else {
      fallback();
    }
  }

  async deleteGalaxy() {
    if (!confirm(window.t.confirmDeleteGalaxy)) return;
    if (!confirm(window.t.confirmDeleteGalaxy2)) return;
    try {
      const res = await fetch(`/galaxies/${this.galaxyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        this.showToast(window.t.galaxyDeleted, 'success');
        setTimeout(() => { window.location.href = '/portal/'; }, 1400);
      } else {
        this.showToast(window.t.deleteGalaxyFailed, 'error');
      }
    } catch (e) {
      console.error('Delete galaxy error:', e);
      this.showToast(window.t.deleteGalaxyFailed, 'error');
    }
  }
}

const galaxyManager = new GalaxyManager();
