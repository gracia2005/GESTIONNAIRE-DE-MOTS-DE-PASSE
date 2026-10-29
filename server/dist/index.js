"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = __importDefault(require("./app.js"));
const database_js_1 = require("./db/database.js");
const PORT = parseInt(process.env.PORT || '5000', 10);
async function startServer() {
    try {
        await database_js_1.db.init();
        app_js_1.default.listen(PORT, () => {
            console.log(`=================================================`);
            console.log(`🛡️  SecureVault API Server running on port ${PORT}`);
            console.log(`🔒 Zero-Knowledge Model: Server never stores plaintext secrets`);
            console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`=================================================`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
