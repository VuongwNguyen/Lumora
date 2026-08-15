const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('stream');
const {
  IMAGE_UPLOAD_MAX_FILES,
  IMAGE_UPLOAD_MAX_TOTAL_SIZE,
  IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB,
  IMAGE_UPLOAD_MIME_TYPES,
  IMAGE_BULK_DELETE_MAX_ITEMS,
  publicImageUploadPolicy,
} = require('../config/uploads');
const {
  createImageKitStorage,
  hasExpectedSignature,
  imageFileFilter,
} = require('../middlewares/uploader');
const GalleryService = require('../services/gallery.service');
const GalaxyModel = require('../models/galaxy');

function validPng(payload = 'lumora') {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(payload),
  ]);
}

function store(storage, file, req = {}) {
  return new Promise((resolve, reject) => {
    storage._handleFile(req, file, (error, result) => error ? reject(error) : resolve(result));
  });
}

test('public image upload policy allows 50 photos with a 20MB combined limit', () => {
  const policy = publicImageUploadPolicy();
  assert.equal(policy.maxFiles, IMAGE_UPLOAD_MAX_FILES);
  assert.equal(policy.maxTotalSize, IMAGE_UPLOAD_MAX_TOTAL_SIZE);
  assert.equal(policy.maxTotalSize, IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB * 1024 * 1024);
  assert.equal(policy.maxFileSize, undefined);
  assert.deepEqual(policy.mimeTypes, [...IMAGE_UPLOAD_MIME_TYPES]);
  assert.equal(IMAGE_UPLOAD_MAX_FILES, 50);
  assert.equal(policy.maxBulkDeleteItems, IMAGE_BULK_DELETE_MAX_ITEMS);
  assert.equal(IMAGE_BULK_DELETE_MAX_ITEMS, 50);
  assert.equal(IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB, 20);
});

test('image signatures must match their declared allowlisted format', () => {
  assert.equal(hasExpectedSignature(validPng(), 'image/png'), true);
  assert.equal(hasExpectedSignature(Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'image/jpeg'), true);
  assert.equal(hasExpectedSignature(Buffer.from('RIFF1234WEBP'), 'image/webp'), true);
  assert.equal(hasExpectedSignature(Buffer.from('<svg></svg>'), 'image/png'), false);
});

test('upload storage streams bytes to ImageKit without creating a file buffer', async () => {
  let received = Buffer.alloc(0);
  let uploadOptions;
  const client = {
    upload(options) {
      uploadOptions = options;
      return new Promise((resolve, reject) => {
        const chunks = [];
        options.file.on('data', chunk => chunks.push(chunk));
        options.file.on('error', reject);
        options.file.on('end', () => {
          received = Buffer.concat(chunks);
          resolve({ fileId: 'ik-file', url: 'https://ik.imagekit.io/lumora/file.png', size: received.length });
        });
      });
    },
  };
  const storage = createImageKitStorage(() => client);
  const bytes = validPng('streamed-payload');
  const file = {
    originalname: 'Ký ức đẹp.png',
    mimetype: 'image/png',
    stream: Readable.from([bytes.subarray(0, 5), bytes.subarray(5)]),
  };

  const result = await store(storage, file);

  assert.deepEqual(received, bytes);
  assert.equal(result.fileId, 'ik-file');
  assert.equal(file.buffer, undefined);
  assert.equal(uploadOptions.folder, 'moon/images');
  assert.equal(
    uploadOptions.checks,
    `"file.size" <= "${IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB}mb" AND "file.mime" IN ["image/jpeg","image/png","image/webp"]`,
  );
});

test('streaming upload rejects a request when combined image bytes exceed 20MB', async () => {
  const client = {
    upload(options) {
      return new Promise((resolve, reject) => {
        options.file.resume();
        options.file.on('error', reject);
        options.file.on('end', () => resolve({ fileId: 'unexpected' }));
      });
    },
  };
  const storage = createImageKitStorage(() => client);
  const req = { imageUploadBytes: IMAGE_UPLOAD_MAX_TOTAL_SIZE - 4 };
  const file = {
    originalname: 'combined-limit.png',
    mimetype: 'image/png',
    stream: Readable.from([validPng()]),
  };

  await assert.rejects(store(storage, file, req), error => {
    assert.equal(error.code, 'LIMIT_TOTAL_FILE_SIZE');
    assert.equal(error.statusCode, 413);
    return true;
  });
  assert.ok(req.imageUploadBytes > IMAGE_UPLOAD_MAX_TOTAL_SIZE);
});

test('streaming upload rejects spoofed image contents before persistence', async () => {
  const client = {
    upload(options) {
      return new Promise((resolve, reject) => {
        options.file.resume();
        options.file.on('error', reject);
        options.file.on('end', () => resolve({ fileId: 'unexpected' }));
      });
    },
  };
  const storage = createImageKitStorage(() => client);
  const file = {
    originalname: 'not-really-an-image.png',
    mimetype: 'image/png',
    stream: Readable.from([Buffer.from('plain text masquerading as png')]),
  };

  await assert.rejects(store(storage, file), error => {
    assert.equal(error.code, 'INVALID_IMAGE_SIGNATURE');
    assert.equal(error.statusCode, 415);
    return true;
  });
});

test('file filter rejects extensions or MIME types outside JPG, PNG and WebP', async () => {
  const filter = file => new Promise(resolve => imageFileFilter({}, file, error => resolve(error)));
  assert.equal(await filter({ originalname: 'memory.png', mimetype: 'image/png' }), null);
  const gifError = await filter({ originalname: 'memory.gif', mimetype: 'image/gif' });
  assert.equal(gifError.code, 'UNSUPPORTED_IMAGE_TYPE');
  const spoofError = await filter({ originalname: 'memory.png', mimetype: 'text/plain' });
  assert.equal(spoofError.code, 'UNSUPPORTED_IMAGE_TYPE');
});

test('upload ownership is scoped to the authenticated user before file parsing', async () => {
  const originalFindOne = GalaxyModel.findOne;
  const galaxyId = '507f1f77bcf86cd799439011';
  const userId = '507f191e810c19729de860ea';
  let receivedFilter;
  GalaxyModel.findOne = filter => {
    receivedFilter = filter;
    return {
      select() { return this; },
      async lean() { return { _id: galaxyId }; },
    };
  };

  try {
    await GalleryService.requireGalaxyOwnership({ galaxyId, userId });
    assert.deepEqual(receivedFilter, { _id: galaxyId, userId });

    GalaxyModel.findOne = () => ({
      select() { return this; },
      async lean() { return null; },
    });
    await assert.rejects(
      GalleryService.requireGalaxyOwnership({ galaxyId, userId }),
      error => error.statusCode === 404,
    );
  } finally {
    GalaxyModel.findOne = originalFindOne;
  }
});

test('bulk deletion scopes every id to the owned galaxy and preserves provider failures', async () => {
  const originalRequireOwnership = GalleryService.requireGalaxyOwnership;
  const originalFind = require('../models/gallery').find;
  const GalleryModel = require('../models/gallery');
  const originalDeleteMany = GalleryModel.deleteMany;
  const originalClient = GalleryService.imageKitClient;
  const originalConsoleError = console.error;
  const galaxyId = '507f1f77bcf86cd799439011';
  const userId = '507f191e810c19729de860ea';
  const firstId = '507f191e810c19729de860eb';
  const secondId = '507f191e810c19729de860ec';
  let receivedFindFilter;
  let receivedDeleteFilter;

  GalleryService.requireGalaxyOwnership = async input => assert.deepEqual(input, { galaxyId, userId });
  GalleryModel.find = filter => {
    receivedFindFilter = filter;
    return {
      select() { return this; },
      async lean() {
        return [
          { _id: firstId, fileId: 'ik-first' },
          { _id: secondId, fileId: 'ik-second' },
        ];
      },
    };
  };
  GalleryModel.deleteMany = async filter => { receivedDeleteFilter = filter; };
  GalleryService.imageKitClient = {
    async deleteFile(fileId) {
      if (fileId === 'ik-second') throw new Error('provider unavailable');
    },
  };
  console.error = () => {};

  try {
    const result = await GalleryService.deleteGalleryItems({
      galaxyId,
      ids: [firstId, secondId],
      userId,
    });
    assert.deepEqual(receivedFindFilter, {
      _id: { $in: [firstId, secondId] },
      galaxyId,
    });
    assert.deepEqual(receivedDeleteFilter, {
      _id: { $in: [firstId] },
      galaxyId,
    });
    assert.deepEqual(result, { deletedIds: [firstId], failedIds: [secondId] });
  } finally {
    GalleryService.requireGalaxyOwnership = originalRequireOwnership;
    GalleryModel.find = originalFind;
    GalleryModel.deleteMany = originalDeleteMany;
    GalleryService.imageKitClient = originalClient;
    console.error = originalConsoleError;
  }
});
