// routes/payment.routes.js
const router = require('express').Router();
const asyncHandler = require('../context/asyncHandler');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const PaymentController = require('../controllers/payment.controller');

router.post('/create', requireAuth, asyncHandler(PaymentController.createPaymentLink));
router.post('/admin-simulate', requireAdmin, asyncHandler(PaymentController.adminSimulate));
router.post('/webhook', asyncHandler(PaymentController.webhook));
router.get('/status', requireAuth, asyncHandler(PaymentController.getStatus));
router.get('/history', requireAuth, asyncHandler(PaymentController.getHistory));
router.get('/cancel', asyncHandler(PaymentController.cancel));

module.exports = router;
