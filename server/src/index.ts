import http from 'http';
import app from './app.js';
import { db } from './db/database.js';

const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);

export async function startServer(
  port: number = DEFAULT_PORT,
  host: string = '0.0.0.0'
): Promise<{ server: http.Server; port: number }> {
  await db.init();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
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
