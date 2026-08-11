// routes/payment.routes.js
const router = require('express').Router();
const asyncHandler = require('../context/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const PaymentController = require('../controllers/payment.controller');

router.post('/create', requireAuth, asyncHandler(PaymentController.createPaymentLink));
router.post('/dev-activate', requireAuth, asyncHandler(PaymentController.devActivate));
router.post('/webhook', asyncHandler(PaymentController.webhook));
router.get('/status', requireAuth, asyncHandler(PaymentController.getStatus));
router.get('/history', requireAuth, asyncHandler(PaymentController.getHistory));
router.get('/cancel', asyncHandler(PaymentController.cancel));

module.exports = router;
