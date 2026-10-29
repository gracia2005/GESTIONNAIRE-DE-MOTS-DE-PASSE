"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditController_js_1 = require("../controllers/auditController.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.requireAuth);
router.get('/logs', auditController_js_1.getAuditLogs);
exports.default = router;
