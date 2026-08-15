const GalleryModel = require("../models/gallery");
const GalaxyModel = require("../models/galaxy");
const { Types } = require('mongoose');
const ImageKit = require('imagekit');
const { IMAGE_BULK_DELETE_MAX_ITEMS } = require('../config/uploads');
const { errorResponse } = require("../context/responseHandle");

class GalleryService {
  getImageKitClient() {
    if (!this.imageKitClient) {
      this.imageKitClient = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      });
    }
    return this.imageKitClient;
  }

  async requireGalaxyOwnership({ galaxyId, userId }) {
    if (!Types.ObjectId.isValid(galaxyId)) {
      throw new errorResponse({ message: 'galaxyId is invalid', statusCode: 400 });
    }
    const galaxy = await GalaxyModel.findOne({ _id: galaxyId, userId }).select('_id').lean();
    if (!galaxy) {
      throw new errorResponse({ message: 'Galaxy not found', statusCode: 404 });
    }
    return galaxy;
  }

  async createGallery({ galaxyId, title, description, stage, uploadedFiles = [] }) {
    const cleanTitle = String(title || 'Uploaded image').trim().slice(0, 120);
    const cleanDescription = String(description || 'Image uploaded to Lumora').trim().slice(0, 500);
    const cleanStage = stage == null ? null : String(stage).trim().slice(0, 80);
    const documents = uploadedFiles.map((file, index) => ({
        galaxyId,
        title: cleanTitle,
        description: cleanDescription,
        imageUrl: file.url,
        fileId: file.fileId || null,
        stage: cleanStage,
        order: index,
    }));
    if (!documents.length) {
      throw new errorResponse({ message: 'At least one uploaded image is required', statusCode: 400 });
    }
    return GalleryModel.insertMany(documents);
  }

  async getGalleryItems({ galaxyId }) {
    const galleryItems = await GalleryModel.find({ galaxyId, status: 'active' })
      .sort({ createdAt: -1 });

    if (!galleryItems) {
      throw new errorResponse({ message: 'error while fetching gallery items', statusCode: 404 });
    }

    const STAGE_ORDER = {
      // position 0 — chapter đầu
      intro: 0, departure: 0, past: 0,
      // position 1 — chapter giữa / memories
      memory: 1, memories: 1, moments: 1, journey: 1,
      // position 2 — highlight (optional)
      highlight: 2,
      // position 3 — chapter cuối
      ending: 3, hope: 3, reveal: 3,
    };
    const hasStages = galleryItems.some(item => item.stage);
    if (hasStages) {
      galleryItems.sort((a, b) => {
        const sa = STAGE_ORDER[a.stage] ?? 99;
        const sb = STAGE_ORDER[b.stage] ?? 99;
        if (sa !== sb) return sa - sb;
        return (a.order || 0) - (b.order || 0);
      });
    }

    return galleryItems;
  }

  async deleteGalleryItem({ id, userId }) {
    // Find image and verify ownership through galaxy
    const image = await GalleryModel.findById(id).populate('galaxyId');
    if (!image) {
      throw new errorResponse({
        message: "Image not found",
        statusCode: 404,
      });
    }

    if (image.galaxyId.userId.toString() !== userId.toString()) {
      throw new errorResponse({
        message: "Not authorized",
        statusCode: 403,
      });
    }

    // Delete from ImageKit
    if (image.imageUrl) {
      try {
        const fileId = image.fileId;
        if (!fileId) throw new Error("No fileId stored");
        await this.getImageKitClient().deleteFile(fileId);
      } catch (error) {
        console.error("Failed to delete image from ImageKit:", error);
      }
    }

    await GalleryModel.findByIdAndDelete(id);
    return;
  }

  async deleteGalleryItems({ galaxyId, ids, userId }) {
    await this.requireGalaxyOwnership({ galaxyId, userId });
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > IMAGE_BULK_DELETE_MAX_ITEMS) {
      throw new errorResponse({
        message: `Select between 1 and ${IMAGE_BULK_DELETE_MAX_ITEMS} images`,
        statusCode: 400,
      });
    }
    const normalizedIds = [...new Set(ids.map(id => String(id)))];
    if (normalizedIds.length !== ids.length || normalizedIds.some(id => !Types.ObjectId.isValid(id))) {
      throw new errorResponse({ message: 'Image ids are invalid', statusCode: 400 });
    }

    const images = await GalleryModel.find({
      _id: { $in: normalizedIds },
      galaxyId,
    }).select('_id fileId').lean();
    if (images.length !== normalizedIds.length) {
      throw new errorResponse({ message: 'One or more images were not found', statusCode: 404 });
    }

    let imagekit = null;
    if (images.some(image => image.fileId)) {
      try {
        imagekit = this.getImageKitClient();
      } catch {
        throw new errorResponse({ message: 'Image storage is unavailable', statusCode: 503 });
      }
    }
    const deletionResults = await Promise.allSettled(images.map(image => (
      image.fileId ? imagekit.deleteFile(image.fileId) : Promise.resolve()
    )));
    const deletedIds = [];
    const failedIds = [];
    deletionResults.forEach((result, index) => {
      const id = String(images[index]._id);
      if (result.status === 'fulfilled') deletedIds.push(id);
      else failedIds.push(id);
    });

    if (deletedIds.length) {
      await GalleryModel.deleteMany({ _id: { $in: deletedIds }, galaxyId });
    }
    if (failedIds.length) {
      console.error(`[gallery] ImageKit bulk delete failed for ${failedIds.length} image(s)`);
    }
    return { deletedIds, failedIds };
  }

  async getMyGalleryItems({ galaxyId, userId }) {
    // Verify user owns galaxy
    const galaxy = await GalaxyModel.findById(galaxyId);
    if (!galaxy || galaxy.userId.toString() !== userId.toString()) {
      throw new errorResponse({
        message: "Not authorized",
        statusCode: 403,
      });
    }

    // Return ALL images including inactive
    const galleryItems = await GalleryModel.find({ galaxyId })
      .sort({ createdAt: -1 });

    return galleryItems;
  }
}

module.exports = new GalleryService();
