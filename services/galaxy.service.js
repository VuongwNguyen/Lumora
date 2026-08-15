const GalaxyModel = require("../models/galaxy");
const SubscriptionModel = require("../models/subscription");
const { PLANS, FREE_MAX_GALAXIES, planHasFeature } = require("../config/plans");
const { errorResponse } = require("../context/responseHandle");
const { getEntitlementBypassMode, getRoleEntitlementPlan } = require('../config/runtime');
const { normalizeSoundscape, validateSoundscape } = require('../config/soundscapes');

class GalaxyService {
  async createGalaxy({ userId, name, userRole }) {
    const existing = await GalaxyModel.findOne({ userId, name });
    if (existing) {
      throw new errorResponse({ message: "Galaxy name already exists", statusCode: 409 });
    }

    const accessMode = getEntitlementBypassMode({ role: userRole });
    if (accessMode !== 'admin') {
      const count = await GalaxyModel.countDocuments({ userId, status: 'active' });
      const rolePlan = getRoleEntitlementPlan({ role: userRole });
      const sub = rolePlan
        ? null
        : await SubscriptionModel.findOne({ userId, status: 'active', isSimulation: { $ne: true }, expiredAt: { $gt: new Date() } });
      const effectivePlan = rolePlan || sub?.plan;
      const max = effectivePlan ? (PLANS[effectivePlan]?.maxGalaxies ?? FREE_MAX_GALAXIES) : FREE_MAX_GALAXIES;
      if (count >= max) {
        throw new errorResponse({ message: `Bạn đã đạt giới hạn ${max} galaxy. Nâng cấp plan để tạo thêm.`, statusCode: 403 });
      }
    }

    return await GalaxyModel.create({ userId, name });
  }

  async getMyGalaxies(userId) {
    return await GalaxyModel.find({ userId, status: "active" }).sort({ createdAt: -1 });
  }

  async getGalaxy({ galaxyId, userId }) {
    const galaxy = await GalaxyModel.findOne({ _id: galaxyId, userId });
    if (!galaxy) {
      throw new errorResponse({ message: "Galaxy not found", statusCode: 404 });
    }
    return galaxy;
  }

  async deleteGalaxy({ galaxyId, userId }) {
    const galaxy = await GalaxyModel.findById(galaxyId);
    if (!galaxy) {
      throw new errorResponse({ message: "Galaxy not found", statusCode: 404 });
    }
    if (galaxy.userId.toString() !== userId.toString()) {
      throw new errorResponse({ message: "Forbidden", statusCode: 403 });
    }

    // Delete all images from ImageKit
    const GalleryModel = require("../models/gallery");
    const images = await GalleryModel.find({ galaxyId });
    
    if (images.length > 0) {
      const ImageKit = require("imagekit");
      const imagekit = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      });

      await Promise.allSettled(
        images.map(async (image) => {
          try {
            const fileId = image.fileId;
            if (!fileId) return;
            await imagekit.deleteFile(fileId);
          } catch (error) {
            console.error(`Failed to delete image ${image._id}:`, error);
          }
        })
      );

      // Delete all gallery items
      await GalleryModel.deleteMany({ galaxyId });
    }

    await GalaxyModel.findByIdAndDelete(galaxyId);
  }

  async getGalaxyView(galaxyId) {
    const galaxy = await GalaxyModel.findById(galaxyId)
      .populate("themeId", "name colors");
    if (!galaxy || galaxy.status !== "active") {
      throw new errorResponse({ message: "Galaxy not found", statusCode: 404 });
    }
    return {
      _id: galaxy._id,
      name: galaxy.name,
      caption: galaxy.caption,
      theme: galaxy.themeId || null,
      // The legacy catalog is intentionally quarantined: public viewers never
      // receive a stored or provider URL until every track has a valid license.
      music: null,
      soundscape: {
        ...normalizeSoundscape(galaxy.soundscape),
        seed: String(galaxy._id),
      },
      template: galaxy.template || 'galaxy',
      storyType: galaxy.storyType || null,
      occasion: galaxy.occasion || null,
      chapters: galaxy.chapters || [],
      seEffect: galaxy.seEffect || 'none',
    };
  }

  async updateGalaxy({ galaxyId, userId, user, data }) {
    const allowedFields = new Set([
      'name', 'themeId', 'backgroundMusicId', 'caption', 'template',
      'soundscape', 'seEffect', 'storyType', 'occasion', 'chapters',
    ]);
    data = Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowedFields.has(key)));
    const galaxy = await GalaxyModel.findOne({ _id: galaxyId, userId });
    if (!galaxy) {
      throw new errorResponse({ message: "Galaxy not found", statusCode: 404 });
    }

    if (data.name !== undefined) {
      if (typeof data.name !== "string" || !data.name.trim()) {
        throw new errorResponse({ message: "name is required", statusCode: 400 });
      }
      data.name = data.name.trim();
      const duplicate = await GalaxyModel.exists({
        _id: { $ne: galaxyId },
        userId,
        name: data.name,
      });
      if (duplicate) {
        throw new errorResponse({ message: "Galaxy name already exists", statusCode: 409 });
      }
    }

    if (data.template !== undefined && !['galaxy', 'fall'].includes(data.template)) {
      throw new errorResponse({ message: 'Invalid galaxy template', statusCode: 400 });
    }

    if (data.soundscape !== undefined) {
      if (!validateSoundscape(data.soundscape)) {
        throw new errorResponse({ message: 'Invalid soundscape configuration', statusCode: 400 });
      }
      data.soundscape = normalizeSoundscape(data.soundscape);
    }

    if (data.backgroundMusicId !== undefined && data.backgroundMusicId !== null && user.role !== 'admin') {
      throw new errorResponse({
        message: 'Background music is temporarily unavailable while licensing is reviewed',
        statusCode: 503,
      });
    }

    const accessMode = getEntitlementBypassMode({ role: user.role });
    if (accessMode !== 'admin') {
      const wantsFallUniverse = data.template === 'fall';
      const wantsTheme = data.themeId !== undefined;
      const wantsCaption = data.caption !== undefined;

      if (wantsTheme || wantsCaption || wantsFallUniverse) {
        const rolePlan = getRoleEntitlementPlan({ role: user.role });
        const sub = rolePlan
          ? null
          : await SubscriptionModel.findOne({ userId, status: "active", isSimulation: { $ne: true }, expiredAt: { $gt: new Date() } });
        const hasActiveSub = Boolean(rolePlan || (sub && sub.expiredAt > new Date()));
        const effectivePlan = rolePlan || sub?.plan;

        if (!hasActiveSub) {
          throw new errorResponse({ message: "Active subscription required", statusCode: 403 });
        }

        // caption cần pro
        if (wantsCaption && !planHasFeature(effectivePlan, 'text'))
          throw new errorResponse({ message: 'Current plan does not include captions', statusCode: 403 });
        if (wantsFallUniverse && !planHasFeature(effectivePlan, 'fall_universe'))
          throw new errorResponse({ message: 'Current plan does not include Fall universe', statusCode: 403 });
        if (wantsTheme && !planHasFeature(effectivePlan, 'themes'))
          throw new errorResponse({ message: 'Current plan does not include themes', statusCode: 403 });
      }
    }

    return await GalaxyModel.findByIdAndUpdate(galaxyId, data, { new: true });
  }
}

module.exports = new GalaxyService();
