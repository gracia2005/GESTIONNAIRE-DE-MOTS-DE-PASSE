"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const app_js_1 = __importDefault(require("./app.js"));
const database_js_1 = require("./db/database.js");
const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);
async function startServer(port = DEFAULT_PORT, host = '0.0.0.0') {
    await database_js_1.db.init();
    return new Promise((resolve, reject) => {
        const server = app_js_1.default.listen(port, host, () => {
            server.removeListener('error', reject);
            const address = server.address();
            const activePort = typeof address === 'object' && address ? address.port : port;
            console.log(`=================================================`);
            console.log(`🛡️  SecureVault API Server running on http://${host}:${activePort}`);
            console.log(`🔒 Zero-Knowledge Model: Server never stores plaintext secrets`);
            console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`=================================================`);
            resolve({ server, port: activePort });
        });
        server.once('error', reject);
    });
}
if (require.main === module) {
    startServer().catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}
