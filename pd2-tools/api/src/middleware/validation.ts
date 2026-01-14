import { Request, Response, NextFunction } from "express";

export function validateQueryParams(allowedParams: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const queryKeys = Object.keys(req.query);
    const invalidParams = queryKeys.filter(
      (key) => !allowedParams.includes(key)
    );

    if (invalidParams.length > 0) {
      res.status(400).json({
        error: {
          message: `Invalid query parameters: ${invalidParams.join(", ")}`,
          allowedParams,
        },
      });
      return;
    }

    next();
  };
}

export function validateSeason(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const season =
    req.query.season !== undefined ? req.query.season : req.params.season;

  if (season !== undefined) {
    const seasonStr = (season as string).trim();

    // Reject empty strings and whitespace
    if (seasonStr === "") {
      res.status(400).json({
        error: {
          message: "Season must be a positive integer",
        },
      });
      return;
    }

    // Check if it's a valid integer (no decimals, no non-numeric characters)
    if (!/^\d+$/.test(seasonStr)) {
      res.status(400).json({
        error: {
          message: "Season must be a positive integer",
        },
      });
      return;
    }

    const seasonNum = parseInt(seasonStr, 10);
    if (isNaN(seasonNum) || seasonNum < 1) {
      res.status(400).json({
        error: {
          message: "Season must be a positive integer",
        },
      });
      return;
    }
    // Attach parsed season to request for downstream use
    (req as unknown as Record<string, unknown>).seasonNumber = seasonNum;
  }

  next();
}
