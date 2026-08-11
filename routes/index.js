// routes/index.js
const router = require("express").Router();

router.use("/gallary", require("./gallary.routes"));
router.use("/auth", require("./auth.routes"));
router.use("/galaxies", require("./galaxies.routes"));
router.use("/media", require("./media.routes"));
router.use("/payment", require("./payment.routes"));
router.use("/compliance", require("./compliance.routes"));
router.use("/support", require("./support.routes"));
router.use("/activity", require("./activity.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/llm", require("./llm.routes"));

module.exports = router;
