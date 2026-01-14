//@ts-nocheck
import { Request, Response, NextFunction } from "express";
import { validateQueryParams, validateSeason } from "./validation";

describe("Validation Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      query: {},
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe("validateQueryParams", () => {
    it("should call next() when all query params are allowed", () => {
      mockRequest.query = { name: "test", age: "25" };
      const middleware = validateQueryParams(["name", "age"]);

      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should call next() when no query params are provided", () => {
      mockRequest.query = {};
      const middleware = validateQueryParams(["name", "age"]);

      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should return 400 when query contains invalid params", () => {
      mockRequest.query = { name: "test", invalid: "bad" };
      const middleware = validateQueryParams(["name", "age"]);

      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: "Invalid query parameters: invalid",
          allowedParams: ["name", "age"],
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 400 when multiple invalid params are present", () => {
      mockRequest.query = {
        name: "test",
        invalid1: "bad",
        invalid2: "worse",
      };
      const middleware = validateQueryParams(["name"]);

      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: "Invalid query parameters: invalid1, invalid2",
          allowedParams: ["name"],
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should handle empty allowed params list", () => {
      mockRequest.query = { anything: "value" };
      const middleware = validateQueryParams([]);

      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should be case-sensitive for param names", () => {
      mockRequest.query = { Name: "test" };
      const middleware = validateQueryParams(["name"]);

      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("validateSeason", () => {
    it("should call next() when season is not provided", () => {
      mockRequest.query = {};
      mockRequest.params = {};

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should validate and attach season number from query", () => {
      mockRequest.query = { season: "11" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as Record<string, unknown>).seasonNumber).toBe(11);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should validate and attach season number from params", () => {
      mockRequest.params = { season: "12" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as Record<string, unknown>).seasonNumber).toBe(12);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should prefer query over params if both are present", () => {
      mockRequest.query = { season: "11" };
      mockRequest.params = { season: "12" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as Record<string, unknown>).seasonNumber).toBe(11);
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should return 400 for non-numeric season", () => {
      mockRequest.query = { season: "abc" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: "Season must be a positive integer",
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 400 for season = 0", () => {
      mockRequest.query = { season: "0" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: "Season must be a positive integer",
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 400 for negative season", () => {
      mockRequest.query = { season: "-5" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 400 for decimal season", () => {
      mockRequest.query = { season: "11.5" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should accept large season numbers", () => {
      mockRequest.query = { season: "999" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as Record<string, unknown>).seasonNumber).toBe(999);
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should handle empty string season", () => {
      mockRequest.query = { season: "" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should handle whitespace season", () => {
      mockRequest.query = { season: "  " };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should handle season with leading zeros", () => {
      mockRequest.query = { season: "011" };

      validateSeason(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as Record<string, unknown>).seasonNumber).toBe(11);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
