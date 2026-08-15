const IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB = 20;
const IMAGE_UPLOAD_MAX_TOTAL_SIZE = IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB * 1024 * 1024;
const IMAGE_UPLOAD_MAX_FILES = 50;
const IMAGE_BULK_DELETE_MAX_ITEMS = 50;
const IMAGE_UPLOAD_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const IMAGE_UPLOAD_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.webp']);

function publicImageUploadPolicy() {
  return {
    maxTotalSize: IMAGE_UPLOAD_MAX_TOTAL_SIZE,
    maxFiles: IMAGE_UPLOAD_MAX_FILES,
    maxBulkDeleteItems: IMAGE_BULK_DELETE_MAX_ITEMS,
    mimeTypes: [...IMAGE_UPLOAD_MIME_TYPES],
    extensions: [...IMAGE_UPLOAD_EXTENSIONS],
  };
}

module.exports = {
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_BULK_DELETE_MAX_ITEMS,
  IMAGE_UPLOAD_MAX_FILES,
  IMAGE_UPLOAD_MAX_TOTAL_SIZE,
  IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB,
  IMAGE_UPLOAD_MIME_TYPES,
  publicImageUploadPolicy,
};
