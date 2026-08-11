const router = require('express').Router();
const ComplianceController = require('../controllers/compliance.controller');

router.get('/public', (req, res) => ComplianceController.getPublicConfig(req, res));

module.exports = router;
