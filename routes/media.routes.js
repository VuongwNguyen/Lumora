const router = require('express').Router();
const asyncHandler = require('../context/asyncHandler');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const MediaController = require('../controllers/media.controller');

// Public routes - user xem danh sách
router.get('/themes', asyncHandler(MediaController.getThemes));
router.get('/soundscapes', asyncHandler(MediaController.getSoundscapes));
router.get('/soundscape-instruments', asyncHandler(MediaController.getSoundscapeInstruments));
router.get('/story-emotions', asyncHandler(MediaController.getStoryEmotions));
router.get('/musics', requireAdmin, asyncHandler(MediaController.getMusics));

// Admin routes - cần thêm middleware kiểm tra admin
router.post('/themes', requireAuth, requireAdmin, asyncHandler(MediaController.createTheme));
router.put('/themes/:id', requireAuth, requireAdmin, asyncHandler(MediaController.updateTheme));
router.delete('/themes/:id', requireAuth, requireAdmin, asyncHandler(MediaController.deleteTheme));

router.post('/upload-music', requireAdmin, MediaController.musicQuarantined);
router.post('/musics', requireAdmin, MediaController.musicQuarantined);
router.put('/musics/:id', requireAdmin, MediaController.musicQuarantined);
router.delete('/musics/:id', requireAuth, requireAdmin, asyncHandler(MediaController.deleteMusic));

// SoundCloud
router.get('/soundcloud/search', requireAdmin, MediaController.musicQuarantined);
router.get('/soundcloud/resolve', requireAdmin, MediaController.musicQuarantined);
router.get('/soundcloud/preview/:trackId', requireAdmin, MediaController.musicQuarantined);

// Legacy catalog remains stored for audit but cannot be streamed.
router.get('/musics/:id/stream', requireAdmin, MediaController.musicQuarantined);

module.exports = router;
