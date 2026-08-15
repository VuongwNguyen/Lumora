const asyncHandler = require("../context/asyncHandler");
const router = require("express").Router();
const uploader = require("../middlewares/uploader");
const ImageKit = require("../middlewares/ImageKit");
const { requireAuth } = require("../middlewares/auth");
const GalleryController = require("../controllers/gallery.controller");
const { IMAGE_UPLOAD_MAX_FILES } = require('../config/uploads');

router.get('/upload-policy', (req, res) => GalleryController.getUploadPolicy(req, res));
router.post(
  "/upload",
  requireAuth,
  asyncHandler(GalleryController.authorizeUpload),
  uploader.array("files", IMAGE_UPLOAD_MAX_FILES),
  asyncHandler(GalleryController.createGallery),
  ImageKit.deleteImage
);
router.get(
  "/items",
  asyncHandler(GalleryController.getGalleryItems)
);
router.post(
  '/items/bulk-delete',
  requireAuth,
  asyncHandler(GalleryController.deleteGalleryItems)
);
router.delete(
  "/items/:id",
  requireAuth,
  asyncHandler(GalleryController.deleteGalleryItem)
);
router.get(
  "/my-items",
  requireAuth,
  asyncHandler(GalleryController.getMyGalleryItems)
);

module.exports = router;
