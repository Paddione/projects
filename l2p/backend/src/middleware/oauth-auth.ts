// Temporary stub - OAuth implementation in progress
import { Request, Response, NextFunction } from 'express';

export const oauthAuthenticate = (req: Request, res: Response, next: NextFunction): void => {
  res.status(501).json({ error: 'OAuth authentication not yet implemented' });
};
