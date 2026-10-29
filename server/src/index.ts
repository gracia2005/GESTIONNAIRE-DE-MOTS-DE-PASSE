import app from './app.js';
import { db } from './db/database.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer() {
  try {
    await db.init();

    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`🛡️  SecureVault API Server running on port ${PORT}`);
      console.log(`🔒 Zero-Knowledge Model: Server never stores plaintext secrets`);
      console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
