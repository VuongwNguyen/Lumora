const crypto = require('crypto');
const path = require('path');
const { Transform } = require('stream');
const ImageKit = require('imagekit');
const multer = require('multer');
const { errorResponse } = require('../context/responseHandle');
const {
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_MAX_FILES,
  IMAGE_UPLOAD_MAX_TOTAL_SIZE,
  IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB,
  IMAGE_UPLOAD_MIME_TYPES,
} = require('../config/uploads');

let imageKitClient;

function getImageKitClient() {
  if (!imageKitClient) {
    imageKitClient = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }
  return imageKitClient;
}

function uploadError(message, statusCode, code) {
  const error = new errorResponse({ message, statusCode });
  error.code = code;
  return error;
}

function hasExpectedSignature(buffer, mimetype) {
  if (mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimetype === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

class ImageSignatureStream extends Transform {
  constructor(mimetype, accountBytes = () => {}) {
    super();
    this.mimetype = mimetype;
    this.accountBytes = accountBytes;
    this.pending = [];
    this.pendingLength = 0;
    this.validated = false;
  }

  _validatePending() {
    const buffered = Buffer.concat(this.pending, this.pendingLength);
    if (!hasExpectedSignature(buffered, this.mimetype)) {
      throw uploadError('Nội dung file không khớp định dạng ảnh', 415, 'INVALID_IMAGE_SIGNATURE');
    }
    this.validated = true;
    this.pending = [];
    this.pendingLength = 0;
    this.push(buffered);
  }

  _transform(chunk, encoding, callback) {
    try {
      this.accountBytes(chunk.length);
      if (this.validated) {
        callback(null, chunk);
        return;
      }
      this.pending.push(chunk);
      this.pendingLength += chunk.length;
      if (this.pendingLength < 12) {
        callback();
        return;
      }
      this._validatePending();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    if (this.validated) {
      callback();
      return;
    }
    try {
      this._validatePending();
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

function safeFileName(originalname) {
  const extension = path.extname(originalname).toLowerCase();
  const stem = path.basename(originalname, extension)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'memory';
  return `${Date.now()}-${crypto.randomUUID()}-${stem}${extension}`;
}

function createImageKitStorage(clientFactory = getImageKitClient) {
  return {
    _handleFile(req, file, callback) {
      let client;
      try {
        client = clientFactory();
      } catch {
        callback(uploadError('Dịch vụ lưu trữ ảnh chưa được cấu hình', 503, 'IMAGE_STORAGE_UNAVAILABLE'));
        return;
      }

      const validationStream = new ImageSignatureStream(file.mimetype, length => {
        req.imageUploadBytes = (req.imageUploadBytes || 0) + length;
        if (req.imageUploadBytes > IMAGE_UPLOAD_MAX_TOTAL_SIZE) {
          throw uploadError(
            `Tổng dung lượng ảnh vượt quá ${IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB}MB`,
            413,
            'LIMIT_TOTAL_FILE_SIZE',
          );
        }
      });
      let uploadPromise;
      try {
        uploadPromise = client.upload({
          file: validationStream,
          fileName: safeFileName(file.originalname),
          folder: 'moon/images',
          useUniqueFileName: true,
          checks: `"file.size" <= "${IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB}mb" AND "file.mime" IN ["image/jpeg","image/png","image/webp"]`,
        });
      } catch {
        callback(uploadError('Không thể tải ảnh lên kho lưu trữ', 502, 'IMAGEKIT_UPLOAD_FAILED'));
        return;
      }
      file.stream.pipe(validationStream);
      Promise.resolve(uploadPromise).then(result => callback(null, {
        fileId: result.fileId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        size: result.size,
      })).catch((error) => {
        if (error?.code === 'INVALID_IMAGE_SIGNATURE' || error?.code === 'LIMIT_TOTAL_FILE_SIZE') callback(error);
        else callback(uploadError('Không thể tải ảnh lên kho lưu trữ', 502, 'IMAGEKIT_UPLOAD_FAILED'));
      });
    },

    _removeFile(req, file, callback) {
      if (!file.fileId) {
        callback(null);
        return;
      }
      let client;
      try {
        client = clientFactory();
      } catch {
        callback(null);
        return;
      }
      client.deleteFile(file.fileId)
        .then(() => callback(null))
        .catch(() => callback(null));
    },
  };
}

function imageFileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!IMAGE_UPLOAD_MIME_TYPES.includes(file.mimetype) || !IMAGE_UPLOAD_EXTENSIONS.includes(extension)) {
    callback(uploadError('Chỉ hỗ trợ ảnh JPG, PNG và WebP', 415, 'UNSUPPORTED_IMAGE_TYPE'));
    return;
  }
  callback(null, true);
}

const uploader = multer({
  storage: createImageKitStorage(),
  limits: {
    fileSize: IMAGE_UPLOAD_MAX_TOTAL_SIZE,
    files: IMAGE_UPLOAD_MAX_FILES,
    fields: 4,
    fieldSize: 2000,
    parts: IMAGE_UPLOAD_MAX_FILES + 4,
  },
  fileFilter: imageFileFilter,
});

module.exports = uploader;
module.exports.ImageSignatureStream = ImageSignatureStream;
module.exports.createImageKitStorage = createImageKitStorage;
module.exports.hasExpectedSignature = hasExpectedSignature;
module.exports.imageFileFilter = imageFileFilter;
