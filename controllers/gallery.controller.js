const GalleryService = require("../services/gallery.service");
const { publicImageUploadPolicy } = require('../config/uploads');
const { successfullyResponse, errorResponse } = require("../context/responseHandle");

class GalleryController {
  getUploadPolicy(req, res) {
    res.set('Cache-Control', 'no-store');
    return new successfullyResponse({
      message: 'Image upload policy fetched successfully',
      meta: publicImageUploadPolicy(),
    }).json(res);
  }

  async authorizeUpload(req, res, next) {
    const galaxyId = String(req.query.galaxyId || '');
    await GalleryService.requireGalaxyOwnership({ galaxyId, userId: req.user._id });
    req.uploadGalaxyId = galaxyId;
    next();
  }

  async createGallery(req, res, next) {
    const { title, description, stage } = req.body;
    if (!req.files?.length) {
      return next(new errorResponse({ message: 'Vui lòng chọn ít nhất một ảnh', statusCode: 400 }));
    }
    await GalleryService.createGallery({
      galaxyId: req.uploadGalaxyId,
      title,
      description,
      stage,
      uploadedFiles: req.files,
    });

    return new successfullyResponse({
      message: "Gallery item created successfully",
    }).json(res);
  }

  async getGalleryItems(req, res, next) {
    const { galaxyId } = req.query;

    if (!galaxyId) {
      return next(new errorResponse({ message: "galaxyId is required", statusCode: 404 }));
    }

    const galleryItems = await GalleryService.getGalleryItems({ galaxyId });
    return new successfullyResponse({
      message: "Gallery items fetched successfully",
      meta: galleryItems,
    }).json(res);
  }

  async deleteGalleryItem(req, res, next) {
    const { id } = req.params;
    const userId = req.user._id;

    const result = await GalleryService.deleteGalleryItem({ id, userId });
    return new successfullyResponse({
      message: "Gallery item deleted successfully",
    }).json(res);
  }

  async deleteGalleryItems(req, res) {
    const result = await GalleryService.deleteGalleryItems({
      galaxyId: String(req.query.galaxyId || ''),
      ids: req.body?.ids,
      userId: req.user._id,
    });
    const partial = result.failedIds.length > 0;
    return new successfullyResponse({
      message: partial ? 'Some images could not be deleted' : 'Gallery images deleted successfully',
      statusCode: partial ? 207 : 200,
      meta: {
        deletedIds: result.deletedIds,
        failedIds: result.failedIds,
        deletedCount: result.deletedIds.length,
        failedCount: result.failedIds.length,
      },
    }).json(res);
  }

  async getMyGalleryItems(req, res, next) {
    const { galaxyId } = req.query;
    const userId = req.user._id;

    if (!galaxyId) {
      return next(new errorResponse({ message: "galaxyId is required", statusCode: 400 }));
    }

    const galleryItems = await GalleryService.getMyGalleryItems({ galaxyId, userId });
    return new successfullyResponse({
      message: "My gallery items fetched successfully",
      meta: galleryItems,
    }).json(res);
  }
}

module.exports = new GalleryController();
