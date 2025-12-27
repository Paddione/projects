import rateLimit from 'express-rate-limit';
import { Express } from 'express';
import { logger } from '../lib/logger';

export function setupRateLimiting(app: Express) {
    // General API Rate Limit
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // max 100 requests per IP
        message: {
            error: 'Too many requests from this IP. Please try again later.',
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
            });
            res.status(429).json({
                error: 'Too many requests. Please try again later.',
            });
        },
    });

    // Stricter limit for Auth endpoints
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5, // only 5 login attempts
        skipSuccessfulRequests: true,
        message: {
            error: 'Too many login attempts. Please wait 15 minutes.',
        },
    });

    // Upload-specific limit (larger payloads)
    const uploadLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 20, // max 20 uploads per hour
        message: {
            error: 'Upload limit reached. Please wait one hour.',
        },
    });

    // Apply middleware
    app.use('/api/', apiLimiter);
    app.use('/api/auth/', authLimiter);
    app.use('/api/upload/', uploadLimiter);
    app.use('/api/thumbnails/', uploadLimiter);
}
