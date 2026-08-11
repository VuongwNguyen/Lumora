const router = require('express').Router();
const { requireAdmin } = require('../middlewares/auth');
const { getStats, getUsers, getUserDetail, grantSubscription, revokeSubscription, changeRole, toggleUserStatus, banUser, getPayments, getCancellationChart } = require('../controllers/admin.controller');
const asyncHandler = require('../context/asyncHandler');
const ActivityAdminController = require('../controllers/activityAdmin.controller');

router.use(requireAdmin);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/subscription', grantSubscription);
router.delete('/users/:id/subscription', revokeSubscription);
router.patch('/users/:id/role', changeRole);
router.patch('/users/:id/status', toggleUserStatus);
router.patch('/users/:id/ban', banUser);
router.get('/payments', getPayments);
router.get('/cancellation-chart', getCancellationChart);
router.get('/activities', asyncHandler(ActivityAdminController.list));
router.get('/activities/overview', asyncHandler(ActivityAdminController.overview));
router.get('/activities/actions', asyncHandler(ActivityAdminController.actions));
router.get('/activities/errors', asyncHandler(ActivityAdminController.errors));
router.get('/activities/blocked', asyncHandler(ActivityAdminController.blocked));
router.get('/activities/performance', asyncHandler(ActivityAdminController.performance));
router.get('/activities/funnel', asyncHandler(ActivityAdminController.funnel));
router.get('/activities/journey/:sessionId', asyncHandler(ActivityAdminController.journey));

module.exports = router;
