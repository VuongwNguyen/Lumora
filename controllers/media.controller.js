const MediaService = require('../services/media.service');
const SoundCloudService = require('../services/soundcloud.service');
const { successfullyResponse, errorResponse } = require('../context/responseHandle');

class MediaController {
  async createTheme(req, res, next) {
    const theme = await MediaService.createTheme(req.body);
    return new successfullyResponse({ message: 'Theme created', meta: theme }).json(res);
  }

  async getThemes(req, res, next) {
    const themes = await MediaService.getThemes();
    return new successfullyResponse({ message: 'Themes fetched', meta: themes }).json(res);
  }

  async updateTheme(req, res, next) {
    const theme = await MediaService.updateTheme(req.params.id, req.body);
    return new successfullyResponse({ message: 'Theme updated', meta: theme }).json(res);
  }

  async deleteTheme(req, res, next) {
    await MediaService.deleteTheme(req.params.id);
    return new successfullyResponse({ message: 'Theme deleted' }).json(res);
  }

  async createMusic(req, res, next) {
    const music = await MediaService.createMusic(req.body);
    return new successfullyResponse({ message: 'Music created', meta: music }).json(res);
  }

  async getMusics(req, res, next) {
    const musics = await MediaService.getMusics();
    return new successfullyResponse({ message: 'Musics fetched', meta: musics }).json(res);
  }

  async getSoundscapes(req, res, next) {
    const soundscapes = MediaService.getSoundscapes();
    return new successfullyResponse({ message: 'Soundscapes fetched', meta: soundscapes }).json(res);
  }

  musicQuarantined(req, res, next) {
    return next(new errorResponse({
      message: 'Background music is temporarily unavailable while licensing is reviewed',
      statusCode: 503,
    }));
  }

  async updateMusic(req, res, next) {
    const music = await MediaService.updateMusic(req.params.id, req.body);
    return new successfullyResponse({ message: 'Music updated', meta: music }).json(res);
  }

  async deleteMusic(req, res, next) {
    await MediaService.deleteMusic(req.params.id);
    return new successfullyResponse({ message: 'Music deleted' }).json(res);
  }

  async uploadMusic(req, res, next) {
    if (!req.musicUrl) {
      return next(new errorResponse({ message: 'Upload failed', statusCode: 400 }));
    }
    return new successfullyResponse({ message: 'Music uploaded', meta: { url: req.musicUrl } }).json(res);
  }

  async searchSoundCloud(req, res, next) {
    const q = (req.query.q || '').trim();
    if (!q) return new successfullyResponse({ message: 'Empty query', meta: [] }).json(res);
    const tracks = await SoundCloudService.searchTracks(q);
    return new successfullyResponse({ message: 'SoundCloud search', meta: tracks }).json(res);
  }

  async resolveSoundCloud(req, res, next) {
    const url = (req.query.url || '').trim();
    if (!url) return next(new errorResponse({ message: 'Thiếu url', statusCode: 400 }));
    const track = await SoundCloudService.resolveByUrl(url);
    return new successfullyResponse({ message: 'SoundCloud resolved', meta: track }).json(res);
  }

  async previewSoundCloud(req, res, next) {
    const url = await SoundCloudService.getStreamUrl(req.params.trackId);
    return res.redirect(302, url);
  }

  async streamMusic(req, res, next) {
    const music = await MediaService.getMusicById(req.params.id);
    if (!music || music.status !== 'active') {
      return next(new errorResponse({ message: 'Music not found', statusCode: 404 }));
    }
    if (music.source === 'soundcloud') {
      const url = await SoundCloudService.getStreamUrl(music.trackId);
      return res.redirect(302, url);
    }
    return res.redirect(302, music.url);
  }
}

module.exports = new MediaController();
