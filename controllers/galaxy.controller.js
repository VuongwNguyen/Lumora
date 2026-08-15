const GalaxyService = require("../services/galaxy.service");
const { successfullyResponse, errorResponse } = require("../context/responseHandle");
const { safeLog } = require('../middlewares/activityTracking');

class GalaxyController {
  async createGalaxy(req, res, next) {
    const { name } = req.body;
    if (!name) {
      return next(new errorResponse({ message: "name is required", statusCode: 400 }));
    }
    const galaxy = await GalaxyService.createGalaxy({ userId: req.user._id, name, userRole: req.user.role });
    return new successfullyResponse({
      message: "Galaxy created",
      meta: galaxy,
      statusCode: 201,
    }).json(res);
  }

  async getMyGalaxies(req, res, next) {
    const galaxies = await GalaxyService.getMyGalaxies(req.user._id);
    return new successfullyResponse({
      message: "Galaxies fetched",
      meta: galaxies,
    }).json(res);
  }

  async getGalaxy(req, res, next) {
    const galaxy = await GalaxyService.getGalaxy({ galaxyId: req.params.id, userId: req.user._id });
    return new successfullyResponse({ message: "Galaxy fetched", meta: galaxy }).json(res);
  }

  async deleteGalaxy(req, res, next) {
    await GalaxyService.deleteGalaxy({ galaxyId: req.params.id, userId: req.user._id });
    return new successfullyResponse({ message: "Galaxy deleted" }).json(res);
  }

  async getGalaxyView(req, res, next) {
    const view = await GalaxyService.getGalaxyView(req.params.id);
    return new successfullyResponse({ message: "Galaxy view fetched", meta: view }).json(res);
  }

  async updateGalaxy(req, res, next) {
    const updatesSoundscape = Object.hasOwn(req.body || {}, 'soundscape');
    try {
      const galaxy = await GalaxyService.updateGalaxy({
        galaxyId: req.params.id,
        userId: req.user._id,
        user: req.user,
        data: req.body
      });
      if (updatesSoundscape) {
        safeLog({
          action: 'Soundscape Saved', feature: 'galaxy', status: 1, galaxyId: req.params.id,
          metadata: { preset: galaxy.soundscape?.preset || 'none' },
        }, req);
      }
      return new successfullyResponse({ message: "Galaxy updated", meta: galaxy }).json(res);
    } catch (error) {
      if (updatesSoundscape) {
        safeLog({
          action: 'Soundscape Save Failed', feature: 'galaxy', status: 0, galaxyId: req.params.id,
          metadata: { errorType: 'soundscape_save_fail', errorMsg: error.message },
        }, req);
      }
      throw error;
    }
  }
}

module.exports = new GalaxyController();
