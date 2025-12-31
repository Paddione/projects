import '../env.js';
import cors from 'cors';


export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Dynamically get allowed origins from environment
    const currentAllowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const isPublic = process.env.CORS_ORIGIN === '*';

    console.log(`[CORS] Request from: ${origin || 'Same-Origin/Direct'}, Allowed: ${currentAllowedOrigins.length} origins, Public: ${isPublic}`);

    if (!origin) {
      callback(null, true);
      return;
    }

    if (currentAllowedOrigins.includes(origin) || isPublic) {
      callback(null, true);
    } else {
      console.warn(`[CORS] REJECTED: ${origin}`);
      console.warn(`[CORS] Expected one of: ${currentAllowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
});
