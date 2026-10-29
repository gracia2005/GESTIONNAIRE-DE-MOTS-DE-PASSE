import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Safe logging: Never log query bodies with sensitive data
  console.error('[Error Logger]', {
    message: err.message,
    name: err.name,
    timestamp: new Date().toISOString(),
  });

  const statusCode = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    error: isDev ? err.message : 'Une erreur interne est survenue sur le serveur.',
  });
};
