import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import {
  ValidationMiddleware,
  ValidationSchema,
  validate,
  sanitize,
  rateLimitValidation,
  validationSchemas
} from '../validation.js';
import { ValidationError } from '../errorHandler.js';

describe('ValidationMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock request
    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
      ip: '192.168.1.1'
    };

    // Create mock response with proper Jest mocks
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    // Create mock next function
    mockNext = jest.fn();
  });

  describe('ValidationMiddleware.validate', () => {
    it('should pass validation when all data is valid', () => {
      // Arrange
      const schema: ValidationSchema = {
        body: Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required()
        })
      };

      mockRequest.body = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Act
      ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw ValidationError when body validation fails', () => {
      // Arrange
      const schema: ValidationSchema = {
        body: Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required()
        })
      };

      mockRequest.body = {
        name: 'John Doe',
        email: 'invalid-email'
      };

      // Act & Assert
      expect(() => {
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ValidationError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when params validation fails', () => {
      // Arrange
      const schema: ValidationSchema = {
        params: Joi.object({
          id: Joi.number().integer().positive().required()
        })
      };

      mockRequest.params = {
        id: 'invalid-id'
      };

      // Act & Assert
      expect(() => {
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ValidationError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when query validation fails', () => {
      // Arrange
      const schema: ValidationSchema = {
        query: Joi.object({
          page: Joi.number().integer().min(1).required()
        })
      };

      mockRequest.query = {
        page: 'invalid-page'
      };

      // Act & Assert
      expect(() => {
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ValidationError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when headers validation fails', () => {
      // Arrange
      const schema: ValidationSchema = {
        headers: Joi.object({
          'content-type': Joi.string().valid('application/json').required()
        })
      };

      mockRequest.headers = {
        'content-type': 'text/plain'
      };

      // Act & Assert
      expect(() => {
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ValidationError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should collect all validation errors when multiple validations fail', () => {
      // Arrange
      const schema: ValidationSchema = {
        body: Joi.object({
          email: Joi.string().email().required()
        }),
        params: Joi.object({
          id: Joi.number().integer().positive().required()
        })
      };

      mockRequest.body = {
        email: 'invalid-email'
      };
      mockRequest.params = {
        id: 'invalid-id'
      };

      // Act & Assert
      expect(() => {
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ValidationError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass validation when optional schemas are not provided', () => {
      // Arrange
      const schema: ValidationSchema = {};

      // Act
      ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('ValidationMiddleware.sanitize', () => {
    it('should sanitize string values in request body', () => {
      // Arrange
      mockRequest.body = {
        name: '  <script>alert("xss")</script>John Doe  ',
        email: '  john@example.com  ',
        message: 'javascript:alert("xss")'
      };

      // Act
      ValidationMiddleware.sanitize(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.body).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'alert("xss")'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize nested objects in request body', () => {
      // Arrange
      mockRequest.body = {
        user: {
          name: '  <script>alert("xss")</script>John  ',
          profile: {
            bio: '  javascript:alert("xss")  '
          }
        }
      };

      // Act
      ValidationMiddleware.sanitize(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.body).toEqual({
        user: {
          name: 'John',
          profile: {
            bio: 'alert("xss")'
          }
        }
      });
    });

    it('should sanitize arrays in request body', () => {
      // Arrange
      mockRequest.body = {
        tags: [
          '  <script>alert("xss")</script>tag1  ',
          '  tag2  ',
          'javascript:alert("xss")'
        ]
      };

      // Act
      ValidationMiddleware.sanitize(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.body).toEqual({
        tags: [
          'tag1',
          'tag2',
          'alert("xss")'
        ]
      });
    });

    it('should sanitize query parameters', () => {
      // Arrange
      mockRequest.query = {
        search: '  <script>alert("xss")</script>test  ',
        filter: '  javascript:alert("xss")  '
      };

      // Act
      ValidationMiddleware.sanitize(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.query).toEqual({
        search: 'test',
        filter: 'alert("xss")'
      });
    });

    it('should handle non-string values without modification', () => {
      // Arrange
      mockRequest.body = {
        number: 123,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined
      };

      // Act
      ValidationMiddleware.sanitize(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.body).toEqual({
        number: 123,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined
      });
    });

    it('should remove event handler attributes', () => {
      // Arrange
      mockRequest.body = {
        name: 'John onclick="alert(\'xss\')" Doe',
        email: 'john@example.com onload="alert(\'xss\')"'
      };

      // Act
      ValidationMiddleware.sanitize(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.body).toEqual({
        name: 'John  Doe',
        email: 'john@example.com '
      });
    });
  });

  describe('ValidationMiddleware.rateLimitValidation', () => {
    it('should allow requests within rate limit', () => {
      // Arrange
      const rateLimit = ValidationMiddleware.rateLimitValidation(5, 60000); // 5 requests per minute

      // Act
      for (let i = 0; i < 5; i++) {
        rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', () => {
      // Arrange
      const rateLimit = ValidationMiddleware.rateLimitValidation(3, 60000); // 3 requests per minute

      // Act
      for (let i = 0; i < 3; i++) {
        rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      }
      // 4th request should be blocked
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Maximum 3 requests per 60 seconds.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: expect.any(Number)
      });
    });

    it('should reset rate limit after window expires', (done) => {
      // Arrange
      const rateLimit = ValidationMiddleware.rateLimitValidation(2, 100); // 2 requests per 100ms

      // Act
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      // 3rd request should be blocked
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);

      // Wait for window to expire
      setTimeout(() => {
        // 4th request should be allowed after window expires
        rateLimit(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(3); // 2 initial + 1 after reset
        done();
      }, 150);
    });

    it('should handle different client IPs separately', () => {
      // Arrange
      const rateLimit = ValidationMiddleware.rateLimitValidation(2, 60000);
      const mockRequest2 = { ...mockRequest, ip: '192.168.1.2' };

      // Act
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimit(mockRequest2 as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle missing IP address', () => {
      // Arrange
      const rateLimit = ValidationMiddleware.rateLimitValidation(1, 60000);
      (mockRequest as any).ip = undefined;

      // Act
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimit(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });

  describe('ValidationMiddleware.schemas', () => {
    describe('userRegistration', () => {
      it('should validate valid user registration data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.userRegistration;
        mockRequest.body = {
          username: 'john_doe',
          email: 'john@example.com',
          password: 'password123'
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid user registration data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.userRegistration;
        mockRequest.body = {
          username: 'jo', // too short
          email: 'invalid-email',
          password: '123' // too short
        };

        // Act & Assert
        expect(() => {
          ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
        }).toThrow(ValidationError);
      });
    });

    describe('userLogin', () => {
      it('should validate valid login data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.userLogin;
        mockRequest.body = {
          email: 'john@example.com',
          password: 'password123'
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid login data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.userLogin;
        mockRequest.body = {
          email: 'invalid-email',
          password: ''
        };

        // Act & Assert
        expect(() => {
          ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
        }).toThrow(ValidationError);
      });
    });

    describe('lobbyCreation', () => {
      it('should validate valid lobby creation data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.lobbyCreation;
        mockRequest.body = {
          questionCount: 10,
          questionSetIds: [1, 2, 3],
          settings: {
            timeLimit: 60,
            allowReplay: true
          }
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should use default values when not provided', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.lobbyCreation;
        mockRequest.body = {
          questionSetIds: [1]
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockRequest.body.questionCount).toBe(10);
        expect(mockRequest.body.settings.timeLimit).toBe(60);
        expect(mockRequest.body.settings.allowReplay).toBe(true);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('lobbyJoin', () => {
      it('should validate valid lobby join data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.lobbyJoin;
        mockRequest.body = {
          username: 'john_doe',
          character: 'warrior'
        };
        mockRequest.params = {
          code: 'ABC123'
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid lobby code', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.lobbyJoin;
        mockRequest.body = {
          username: 'john_doe',
          character: 'warrior'
        };
        mockRequest.params = {
          code: 'ABC12' // too short
        };

        // Act & Assert
        expect(() => {
          ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
        }).toThrow(ValidationError);
      });
    });

    describe('answerSubmission', () => {
      it('should validate valid answer submission data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.answerSubmission;
        mockRequest.body = {
          questionId: 123,
          selectedAnswer: 'A',
          timeElapsed: 30
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid time elapsed', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.answerSubmission;
        mockRequest.body = {
          questionId: 123,
          selectedAnswer: 'A',
          timeElapsed: 70 // exceeds max of 60
        };

        // Act & Assert
        expect(() => {
          ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
        }).toThrow(ValidationError);
      });
    });

    describe('hallOfFameSubmission', () => {
      it('should validate valid hall of fame submission data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.hallOfFameSubmission;
        mockRequest.body = {
          username: 'john_doe',
          character: 'warrior',
          score: 1000,
          accuracy: 85.5,
          maxMultiplier: 3,
          questionSetId: 1
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid accuracy percentage', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.hallOfFameSubmission;
        mockRequest.body = {
          username: 'john_doe',
          character: 'warrior',
          score: 1000,
          accuracy: 150, // exceeds max of 100
          maxMultiplier: 3,
          questionSetId: 1
        };

        // Act & Assert
        expect(() => {
          ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
        }).toThrow(ValidationError);
      });
    });

    describe('idParam', () => {
      it('should validate valid ID parameter', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.idParam;
        mockRequest.params = {
          id: '123'
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid ID parameter', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.idParam;
        mockRequest.params = {
          id: 'invalid'
        };

        // Act & Assert
        expect(() => {
          ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
        }).toThrow(ValidationError);
      });
    });

    describe('pagination', () => {
      it('should validate valid pagination query', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.pagination;
        mockRequest.query = {
          page: '2',
          limit: '20',
          sortBy: 'score',
          sortOrder: 'desc'
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should use default values for pagination', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.pagination;
        mockRequest.query = {};

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockRequest.query.page).toBe(1);
        expect(mockRequest.query.limit).toBe(10);
        expect(mockRequest.query.sortBy).toBe('created_at');
        expect(mockRequest.query.sortOrder).toBe('desc');
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('createQuestionSet', () => {
      it('should validate valid question set creation data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.createQuestionSet;
        mockRequest.body = {
          name: 'Math Questions',
          description: 'Basic math questions',
          category: 'Mathematics',
          difficulty: 'medium',
          is_active: true
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should use default values for question set creation', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.createQuestionSet;
        mockRequest.body = {
          name: 'Math Questions',
          description: 'Basic math questions'
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockRequest.body.difficulty).toBe('medium');
        expect(mockRequest.body.is_active).toBe(true);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('createQuestion', () => {
      it('should validate valid question creation data', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.createQuestion;
        mockRequest.body = {
          question_set_id: 1,
          question_text: {
            en: 'What is 2 + 2?',
            de: 'Was ist 2 + 2?'
          },
          answers: [
            {
              text: { en: '3', de: '3' },
              correct: false
            },
            {
              text: { en: '4', de: '4' },
              correct: true
            }
          ],
          explanation: {
            en: 'Basic addition',
            de: 'Einfache Addition'
          },
          difficulty: 1
        };

        // Act
        ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject question with insufficient answers', () => {
        // Arrange
        const schema = ValidationMiddleware.schemas.createQuestion;
        mockRequest.body = {
          question_set_id: 1,
          question_text: {
            en: 'What is 2 + 2?',
            de: 'Was ist 2 + 2?'
          },
          answers: [
            {
              text: { en: '4', de: '4' },
              correct: true
            }
          ]
        };

        // Act & Assert
        expect(() => {
          ValidationMiddleware.validate(schema)(mockRequest as Request, mockResponse as Response, mockNext);
        }).toThrow(ValidationError);
      });
    });
  });

  describe('Exported convenience functions', () => {
    it('should export validate function', () => {
      expect(typeof validate).toBe('function');
    });

    it('should export sanitize function', () => {
      expect(typeof sanitize).toBe('function');
    });

    it('should export rateLimitValidation function', () => {
      expect(typeof rateLimitValidation).toBe('function');
    });

    it('should export validationSchemas object', () => {
      expect(typeof validationSchemas).toBe('object');
      expect(validationSchemas).toHaveProperty('userRegistration');
      expect(validationSchemas).toHaveProperty('userLogin');
      expect(validationSchemas).toHaveProperty('lobbyCreation');
    });
  });
}); 
