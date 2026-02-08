import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { QuestionService, QuestionSelectionOptions, LocalizedQuestion, QuestionSetWithStats } from '../QuestionService';
import { QuestionRepository, Question, QuestionSet, CreateQuestionData, CreateQuestionSetData } from '../../repositories/QuestionRepository';

// Mock the dependencies
jest.mock('../../repositories/QuestionRepository');

describe('QuestionService', () => {
  let questionService: QuestionService;
  let mockQuestionRepository: jest.Mocked<QuestionRepository>;

  // Test data
  const mockQuestionSet: QuestionSet = {
    id: 1,
    name: 'Test Question Set',
    description: 'A test question set',
    category: 'General Knowledge',
    difficulty: 'medium',
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  };

  const mockQuestion: Question = {
    id: 1,
    question_set_id: 1,
    question_text: 'Was ist die Hauptstadt von Frankreich?',
    answers: [
      {
        text: 'Paris',
        correct: true
      },
      {
        text: 'London',
        correct: false
      },
      {
        text: 'Berlin',
        correct: false
      },
      {
        text: 'Madrid',
        correct: false
      }
    ],
    explanation: 'Paris is the capital and largest city of France.',
    difficulty: 2,
    created_at: new Date('2024-01-01')
  };

  const mockQuestion2: Question = {
    id: 2,
    question_set_id: 1,
    question_text: 'What is 2 + 2?',
    answers: [
      {
        text: '3',
        correct: false
      },
      {
        text: '4',
        correct: true
      },
      {
        text: '5',
        correct: false
      },
      {
        text: '6',
        correct: false
      }
    ],
    difficulty: 1,
    created_at: new Date('2024-01-01')
  };

  const mockQuestionSet2: QuestionSet = {
    id: 2,
    name: 'Advanced Questions',
    description: 'Advanced level questions',
    category: 'Science',
    difficulty: 'hard',
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create a complete mock of QuestionRepository
    const repoMock: Record<string, jest.Mock> = {
      // Question Set methods
      findQuestionSetById: jest.fn(),
      findAllQuestionSets: jest.fn(),
      findQuestionSetsByCategory: jest.fn(),
      createQuestionSet: jest.fn(),
      updateQuestionSet: jest.fn(),
      deleteQuestionSet: jest.fn(),
      getQuestionSetCount: jest.fn(),

      // Question methods
      findQuestionById: jest.fn(),
      findQuestionsBySetId: jest.fn(),
      createQuestion: jest.fn(),
      updateQuestion: jest.fn(),
      deleteQuestion: jest.fn(),
      getQuestionCount: jest.fn(),
      getRandomQuestions: jest.fn(),
      getQuestionsByDifficulty: jest.fn(),
      searchQuestions: jest.fn(),
      validateQuestionStructure: jest.fn(),

      // Any other methods that might be needed
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      count: jest.fn(),
      query: jest.fn()
    };

    mockQuestionRepository = repoMock as unknown as jest.Mocked<QuestionRepository>;

    // Create QuestionService instance
    questionService = new QuestionService();
    
    // Replace the private instance with our mock
    (questionService as any).questionRepository = mockQuestionRepository;
  });

  describe('Question Set Management', () => {
    describe('getQuestionSetById', () => {
      it('should return question set by id', async () => {
        mockQuestionRepository.findQuestionSetById.mockResolvedValue(mockQuestionSet);

        const result = await questionService.getQuestionSetById(1);

        expect(mockQuestionRepository.findQuestionSetById).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockQuestionSet);
      });

      it('should return null for non-existent question set', async () => {
        mockQuestionRepository.findQuestionSetById.mockResolvedValue(null);

        const result = await questionService.getQuestionSetById(999);

        expect(mockQuestionRepository.findQuestionSetById).toHaveBeenCalledWith(999);
        expect(result).toBeNull();
      });

      it('should handle repository errors', async () => {
        const error = new Error('Database connection failed');
        mockQuestionRepository.findQuestionSetById.mockRejectedValue(error);

        await expect(questionService.getQuestionSetById(1)).rejects.toThrow('Database connection failed');
      });
    });

    describe('getAllQuestionSets', () => {
      it('should return all active question sets by default', async () => {
        const mockQuestionSets = [mockQuestionSet, mockQuestionSet2];
        mockQuestionRepository.findAllQuestionSets.mockResolvedValue(mockQuestionSets);

        const result = await questionService.getAllQuestionSets();

        expect(mockQuestionRepository.findAllQuestionSets).toHaveBeenCalledWith(true);
        expect(result).toEqual(mockQuestionSets);
      });

      it('should return all question sets when activeOnly is false', async () => {
        const mockQuestionSets = [mockQuestionSet, mockQuestionSet2];
        mockQuestionRepository.findAllQuestionSets.mockResolvedValue(mockQuestionSets);

        const result = await questionService.getAllQuestionSets(false);

        expect(mockQuestionRepository.findAllQuestionSets).toHaveBeenCalledWith(false);
        expect(result).toEqual(mockQuestionSets);
      });

      it('should return empty array when no question sets exist', async () => {
        mockQuestionRepository.findAllQuestionSets.mockResolvedValue([]);

        const result = await questionService.getAllQuestionSets();

        expect(result).toEqual([]);
      });
    });

    describe('getQuestionSetsByCategory', () => {
      it('should return question sets by category', async () => {
        const mockQuestionSets = [mockQuestionSet];
        mockQuestionRepository.findQuestionSetsByCategory.mockResolvedValue(mockQuestionSets);

        const result = await questionService.getQuestionSetsByCategory('General Knowledge');

        expect(mockQuestionRepository.findQuestionSetsByCategory).toHaveBeenCalledWith('General Knowledge');
        expect(result).toEqual(mockQuestionSets);
      });

      it('should return empty array for non-existent category', async () => {
        mockQuestionRepository.findQuestionSetsByCategory.mockResolvedValue([]);

        const result = await questionService.getQuestionSetsByCategory('NonExistent');

        expect(result).toEqual([]);
      });
    });

    describe('createQuestionSet', () => {
      it('should create a new question set', async () => {
        const createData: CreateQuestionSetData = {
          name: 'New Question Set',
          description: 'A new question set',
          category: 'History',
          difficulty: 'easy',
          is_active: true
        };

        const createdQuestionSet = { ...mockQuestionSet, ...createData, id: 3 };
        mockQuestionRepository.createQuestionSet.mockResolvedValue(createdQuestionSet);

        const result = await questionService.createQuestionSet(createData);

        expect(mockQuestionRepository.createQuestionSet).toHaveBeenCalledWith(createData);
        expect(result).toEqual(createdQuestionSet);
      });

      it('should handle creation errors', async () => {
        const createData: CreateQuestionSetData = {
          name: 'New Question Set'
        } as any;

        const error = new Error('Duplicate name');
        mockQuestionRepository.createQuestionSet.mockRejectedValue(error);

        await expect(questionService.createQuestionSet(createData)).rejects.toThrow('Duplicate name');
      });
    });

    describe('updateQuestionSet', () => {
      it('should update an existing question set', async () => {
        const updateData = { name: 'Updated Question Set' };
        const updatedQuestionSet = { ...mockQuestionSet, ...updateData };
        mockQuestionRepository.updateQuestionSet.mockResolvedValue(updatedQuestionSet);

        const result = await questionService.updateQuestionSet(1, updateData);

        expect(mockQuestionRepository.updateQuestionSet).toHaveBeenCalledWith(1, updateData);
        expect(result).toEqual(updatedQuestionSet);
      });

      it('should return null for non-existent question set', async () => {
        mockQuestionRepository.updateQuestionSet.mockResolvedValue(null);

        const result = await questionService.updateQuestionSet(999, { name: 'Updated' });

        expect(result).toBeNull();
      });
    });

    describe('deleteQuestionSet', () => {
      it('should delete an existing question set', async () => {
        mockQuestionRepository.deleteQuestionSet.mockResolvedValue(true);

        const result = await questionService.deleteQuestionSet(1);

        expect(mockQuestionRepository.deleteQuestionSet).toHaveBeenCalledWith(1);
        expect(result).toBe(true);
      });

      it('should return false for non-existent question set', async () => {
        mockQuestionRepository.deleteQuestionSet.mockResolvedValue(false);

        const result = await questionService.deleteQuestionSet(999);

        expect(result).toBe(false);
      });
    });
  });

  describe('Question Management', () => {
    describe('getQuestionById', () => {
      it('should return question by id', async () => {
        mockQuestionRepository.findQuestionById.mockResolvedValue(mockQuestion);

        const result = await questionService.getQuestionById(1);

        expect(mockQuestionRepository.findQuestionById).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockQuestion);
      });

      it('should return null for non-existent question', async () => {
        mockQuestionRepository.findQuestionById.mockResolvedValue(null);

        const result = await questionService.getQuestionById(999);

        expect(result).toBeNull();
      });
    });

    describe('getQuestionsBySetId', () => {
      it('should return questions by set id', async () => {
        const mockQuestions = [mockQuestion, mockQuestion2];
        mockQuestionRepository.findQuestionsBySetId.mockResolvedValue(mockQuestions);

        const result = await questionService.getQuestionsBySetId(1);

        expect(mockQuestionRepository.findQuestionsBySetId).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockQuestions);
      });

      it('should return empty array for non-existent set', async () => {
        mockQuestionRepository.findQuestionsBySetId.mockResolvedValue([]);

        const result = await questionService.getQuestionsBySetId(999);

        expect(result).toEqual([]);
      });
    });

    describe('createQuestion', () => {
      it('should create a new question', async () => {
        const createData: CreateQuestionData = {
          question_set_id: 1,
          question_text: 'What is the largest planet?',
          answers: [
            {
              text: 'Jupiter',
              correct: true
            },
            {
              text: 'Saturn',
              correct: false
            }
          ],
          difficulty: 3
        };

        const createdQuestion = { ...mockQuestion, ...createData, id: 3 };
        mockQuestionRepository.createQuestion.mockResolvedValue(createdQuestion);

        const result = await questionService.createQuestion(createData);

        expect(mockQuestionRepository.createQuestion).toHaveBeenCalledWith(createData);
        expect(result).toEqual(createdQuestion);
      });
    });

    describe('updateQuestion', () => {
      it('should update an existing question', async () => {
        const updateData = { difficulty: 4 };
        const updatedQuestion = { ...mockQuestion, ...updateData };
        mockQuestionRepository.updateQuestion.mockResolvedValue(updatedQuestion);

        const result = await questionService.updateQuestion(1, updateData);

        expect(mockQuestionRepository.updateQuestion).toHaveBeenCalledWith(1, updateData);
        expect(result).toEqual(updatedQuestion);
      });

      it('should return null for non-existent question', async () => {
        mockQuestionRepository.updateQuestion.mockResolvedValue(null);

        const result = await questionService.updateQuestion(999, { difficulty: 4 });

        expect(result).toBeNull();
      });
    });

    describe('deleteQuestion', () => {
      it('should delete an existing question', async () => {
        mockQuestionRepository.deleteQuestion.mockResolvedValue(true);

        const result = await questionService.deleteQuestion(1);

        expect(mockQuestionRepository.deleteQuestion).toHaveBeenCalledWith(1);
        expect(result).toBe(true);
      });

      it('should return false for non-existent question', async () => {
        mockQuestionRepository.deleteQuestion.mockResolvedValue(false);

        const result = await questionService.deleteQuestion(999);

        expect(result).toBe(false);
      });
    });
  });

  describe('Question Selection and Randomization', () => {
    describe('getRandomQuestions', () => {
      it('should return random questions from specified sets', async () => {
        const mockQuestions = [mockQuestion, mockQuestion2];
        const options: QuestionSelectionOptions = {
          questionSetIds: [1, 2],
          count: 5
        };

        mockQuestionRepository.getRandomQuestions.mockResolvedValue(mockQuestions);

        const result = await questionService.getRandomQuestions(options);

        expect(mockQuestionRepository.getRandomQuestions).toHaveBeenCalledWith([1, 2], 5);
        expect(result).toEqual(mockQuestions);
      });

      it('should handle empty result', async () => {
        const options: QuestionSelectionOptions = {
          questionSetIds: [999],
          count: 5
        };

        mockQuestionRepository.getRandomQuestions.mockResolvedValue([]);

        const result = await questionService.getRandomQuestions(options);

        expect(result).toEqual([]);
      });

      it('should handle repository errors', async () => {
        const options: QuestionSelectionOptions = {
          questionSetIds: [1],
          count: 5
        };

        const error = new Error('Database error');
        mockQuestionRepository.getRandomQuestions.mockRejectedValue(error);

        await expect(questionService.getRandomQuestions(options)).rejects.toThrow('Database error');
      });
    });

    describe('getQuestionsByDifficulty', () => {
      it('should return questions by difficulty level', async () => {
        const mockQuestions = [mockQuestion];
        mockQuestionRepository.getQuestionsByDifficulty.mockResolvedValue(mockQuestions);

        const result = await questionService.getQuestionsByDifficulty(1, 2);

        expect(mockQuestionRepository.getQuestionsByDifficulty).toHaveBeenCalledWith(1, 2);
        expect(result).toEqual(mockQuestions);
      });

      it('should return empty array for non-existent difficulty', async () => {
        mockQuestionRepository.getQuestionsByDifficulty.mockResolvedValue([]);

        const result = await questionService.getQuestionsByDifficulty(1, 10);

        expect(result).toEqual([]);
      });
    });
  });

  describe('Statistics and Counting', () => {
    describe('getQuestionCount', () => {
      it('should return total question count', async () => {
        mockQuestionRepository.getQuestionCount.mockResolvedValue(50);

        const result = await questionService.getQuestionCount();

        expect(mockQuestionRepository.getQuestionCount).toHaveBeenCalledWith(undefined);
        expect(result).toBe(50);
      });

      it('should return question count for specific set', async () => {
        mockQuestionRepository.getQuestionCount.mockResolvedValue(10);

        const result = await questionService.getQuestionCount(1);

        expect(mockQuestionRepository.getQuestionCount).toHaveBeenCalledWith(1);
        expect(result).toBe(10);
      });
    });

    describe('getQuestionSetCount', () => {
      it('should return active question set count by default', async () => {
        mockQuestionRepository.getQuestionSetCount.mockResolvedValue(5);

        const result = await questionService.getQuestionSetCount();

        expect(mockQuestionRepository.getQuestionSetCount).toHaveBeenCalledWith(true);
        expect(result).toBe(5);
      });

      it('should return all question set count when activeOnly is false', async () => {
        mockQuestionRepository.getQuestionSetCount.mockResolvedValue(8);

        const result = await questionService.getQuestionSetCount(false);

        expect(mockQuestionRepository.getQuestionSetCount).toHaveBeenCalledWith(false);
        expect(result).toBe(8);
      });
    });
  });

  describe('Search Functionality', () => {
    describe('searchQuestions', () => {
      it('should search questions by term', async () => {
        const mockQuestions = [mockQuestion];
        mockQuestionRepository.searchQuestions.mockResolvedValue(mockQuestions);

        const result = await questionService.searchQuestions('capital');

        expect(mockQuestionRepository.searchQuestions).toHaveBeenCalledWith('capital', undefined);
        expect(result).toEqual(mockQuestions);
      });

      it('should search questions by term within specific set', async () => {
        const mockQuestions = [mockQuestion];
        mockQuestionRepository.searchQuestions.mockResolvedValue(mockQuestions);

        const result = await questionService.searchQuestions('capital', 1);

        expect(mockQuestionRepository.searchQuestions).toHaveBeenCalledWith('capital', 1);
        expect(result).toEqual(mockQuestions);
      });

      it('should return empty array for no matches', async () => {
        mockQuestionRepository.searchQuestions.mockResolvedValue([]);

        const result = await questionService.searchQuestions('nonexistent');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Validation', () => {
    describe('validateQuestionStructure', () => {
      it('should validate question structure', async () => {
        mockQuestionRepository.validateQuestionStructure.mockResolvedValue(true);

        const result = await questionService.validateQuestionStructure(1);

        expect(mockQuestionRepository.validateQuestionStructure).toHaveBeenCalledWith(1);
        expect(result).toBe(true);
      });

      it('should return false for invalid structure', async () => {
        mockQuestionRepository.validateQuestionStructure.mockResolvedValue(false);

        const result = await questionService.validateQuestionStructure(1);

        expect(result).toBe(false);
      });
    });

    describe('validateQuestionData', () => {
      it('should validate valid question data', () => {
        const validData: CreateQuestionData = {
          question_set_id: 1,
          question_text: 'Was ist die Hauptstadt von Frankreich?',
          answers: [
            {
              text: 'Paris',
              correct: true
            },
            {
              text: 'London',
              correct: false
            }
          ],
          difficulty: 2
        };

        const result = questionService.validateQuestionData(validData);

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject question data without German text', () => {
        const invalidData: CreateQuestionData = {
          question_set_id: 1,
          question_text: '' as any,
          answers: [
            {
              text: 'Paris',
              correct: true
            },
            {
              text: 'London',
              correct: false
            }
          ]
        };

        const result = questionService.validateQuestionData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Question text must be provided in German');
      });

      it('should reject question data with insufficient answers', () => {
        const invalidData: CreateQuestionData = {
          question_set_id: 1,
          question_text: 'Was ist die Hauptstadt von Frankreich?',
          answers: [
            {
              text: 'Paris',
              correct: true
            }
          ]
        };

        const result = questionService.validateQuestionData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least 2 answers must be provided');
      });

      it('should reject question data without correct answer', () => {
        const invalidData: CreateQuestionData = {
          question_set_id: 1,
          question_text: 'Was ist die Hauptstadt von Frankreich?',
          answers: [
            {
              text: 'Paris',
              correct: false
            },
            {
              text: 'London',
              correct: false
            }
          ]
        };

        const result = questionService.validateQuestionData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one answer must be marked as correct');
      });

      it('should reject question data with invalid difficulty', () => {
        const invalidData: CreateQuestionData = {
          question_set_id: 1,
          question_text: 'Was ist die Hauptstadt von Frankreich?',
          answers: [
            {
              text: 'Paris',
              correct: true
            },
            {
              text: 'London',
              correct: false
            }
          ],
          difficulty: 10
        };

        const result = questionService.validateQuestionData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Difficulty must be between 1 and 5');
      });

      it('should reject question data with missing answer text', () => {
        const invalidData: CreateQuestionData = {
          question_set_id: 1,
          question_text: 'Was ist die Hauptstadt von Frankreich?',
          answers: [
            {
              text: '' as any,
              correct: true
            },
            {
              text: 'London',
              correct: false
            }
          ]
        };

        const result = questionService.validateQuestionData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Answer 1 must have text in German');
      });
    });

    describe('validateQuestionSetData', () => {
      it('should validate valid question set data', () => {
        const validData: CreateQuestionSetData = {
          name: 'Test Question Set',
          description: 'A test set',
          category: 'General',
          difficulty: 'medium',
          is_active: true
        };

        const result = questionService.validateQuestionSetData(validData);

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject question set data without name', () => {
        const invalidData: CreateQuestionSetData = {
          name: '',
          description: 'A test set',
          difficulty: 'easy'
        };

        const result = questionService.validateQuestionSetData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Question set name is required');
      });

      it('should reject question set data with name too long', () => {
        const invalidData: CreateQuestionSetData = {
          name: 'A'.repeat(101),
          description: 'A test set',
          difficulty: 'easy'
        };

        const result = questionService.validateQuestionSetData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Question set name must be 100 characters or less');
      });

      it('should reject question set data with invalid difficulty', () => {
        const invalidData: CreateQuestionSetData = {
          name: 'Test Question Set',
          difficulty: 'invalid' as any
        };

        const result = questionService.validateQuestionSetData(invalidData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Difficulty must be one of: easy, medium, hard');
      });
    });
  });

  describe('Localization', () => {
    describe('getLocalizedQuestion', () => {
      it('should localize question to English', () => {
        const result = questionService.getLocalizedQuestion(mockQuestion, 'en');

        const expected: LocalizedQuestion = {
          id: 1,
          questionText: 'Was ist die Hauptstadt von Frankreich?',
          answers: [
            { id: 'A', text: 'Paris', isCorrect: true },
            { id: 'B', text: 'London', isCorrect: false },
            { id: 'C', text: 'Berlin', isCorrect: false },
            { id: 'D', text: 'Madrid', isCorrect: false }
          ],
          explanation: 'Paris is the capital and largest city of France.',
          difficulty: 2
        };

        expect(result).toEqual(expected);
      });

      it('should localize question to German', () => {
        const result = questionService.getLocalizedQuestion(mockQuestion, 'de');

        const expected: LocalizedQuestion = {
          id: 1,
          questionText: 'Was ist die Hauptstadt von Frankreich?',
          answers: [
            { id: 'A', text: 'Paris', isCorrect: true },
            { id: 'B', text: 'London', isCorrect: false },
            { id: 'C', text: 'Berlin', isCorrect: false },
            { id: 'D', text: 'Madrid', isCorrect: false }
          ],
          explanation: 'Paris is the capital and largest city of France.',
          difficulty: 2
        };

        expect(result).toEqual(expected);
      });

             it('should fallback to English when German text is missing', () => {
         const questionWithMissingGerman: Question = {
           ...mockQuestion,
           question_text: {
             en: 'What is the capital of France?'
           } as any,
           answers: [
             {
               text: { en: 'Paris' } as any,
               correct: true
             },
             {
               text: { en: 'London' } as any,
               correct: false
             }
           ]
         };

         const result = questionService.getLocalizedQuestion(questionWithMissingGerman, 'de');

         expect(result.questionText).toBe('What is the capital of France?');
         expect(result.answers[0]?.text).toBe('Paris');
         expect(result.answers[1]?.text).toBe('London');
       });

             it('should handle question without explanation', () => {
         const questionWithoutExplanation: Question = {
           ...mockQuestion,
           explanation: undefined as any
         };

         const result = questionService.getLocalizedQuestion(questionWithoutExplanation, 'en');

         expect(result.explanation).toBeUndefined();
       });

      it('should generate correct answer IDs', () => {
        const questionWithManyAnswers: Question = {
          ...mockQuestion,
          answers: [
            { text: 'A', correct: true },
            { text: 'B', correct: false },
            { text: 'C', correct: false },
            { text: 'D', correct: false },
            { text: 'E', correct: false },
            { text: 'F', correct: false }
          ]
        };

                 const result = questionService.getLocalizedQuestion(questionWithManyAnswers, 'en');

         expect(result.answers[0]?.id).toBe('A');
         expect(result.answers[1]?.id).toBe('B');
         expect(result.answers[2]?.id).toBe('C');
         expect(result.answers[3]?.id).toBe('D');
         expect(result.answers[4]?.id).toBe('E');
         expect(result.answers[5]?.id).toBe('F');
      });
    });

    describe('getLocalizedQuestions', () => {
      it('should localize multiple questions', async () => {
        const questions = [mockQuestion, mockQuestion2];

                 const result = await questionService.getLocalizedQuestions(questions, 'en');

        expect(result).toHaveLength(2);
        expect(result[0]?.questionText).toBe('Was ist die Hauptstadt von Frankreich?');
        expect(result[1]?.questionText).toBe('What is 2 + 2?');
      });

      it('should handle empty array', async () => {
        const result = await questionService.getLocalizedQuestions([], 'en');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Question Set Statistics', () => {
    describe('getQuestionSetWithStats', () => {
      it('should return question set with statistics', async () => {
        const questions = [mockQuestion, mockQuestion2];
        mockQuestionRepository.findQuestionSetById.mockResolvedValue(mockQuestionSet);
        mockQuestionRepository.findQuestionsBySetId.mockResolvedValue(questions);

        const result = await questionService.getQuestionSetWithStats(1);

        const expected: QuestionSetWithStats = {
          ...mockQuestionSet,
          questionCount: 2,
          averageDifficulty: 1.5
        };

        expect(result).toEqual(expected);
      });

      it('should return null for non-existent question set', async () => {
        mockQuestionRepository.findQuestionSetById.mockResolvedValue(null);

        const result = await questionService.getQuestionSetWithStats(999);

        expect(result).toBeNull();
      });

      it('should handle question set with no questions', async () => {
        mockQuestionRepository.findQuestionSetById.mockResolvedValue(mockQuestionSet);
        mockQuestionRepository.findQuestionsBySetId.mockResolvedValue([]);

        const result = await questionService.getQuestionSetWithStats(1);

        const expected: QuestionSetWithStats = {
          ...mockQuestionSet,
          questionCount: 0,
          averageDifficulty: 0
        };

        expect(result).toEqual(expected);
      });
    });

    describe('getAllQuestionSetsWithStats', () => {
             it('should return all question sets with statistics', async () => {
         const questionSets = [mockQuestionSet, mockQuestionSet2];
         const questions1 = [mockQuestion, mockQuestion2];
         const questions2 = [mockQuestion];

         mockQuestionRepository.findAllQuestionSets.mockResolvedValue(questionSets);
         mockQuestionRepository.findQuestionSetById
           .mockResolvedValueOnce(mockQuestionSet)
           .mockResolvedValueOnce(mockQuestionSet2);
         mockQuestionRepository.findQuestionsBySetId
           .mockResolvedValueOnce(questions1)
           .mockResolvedValueOnce(questions2);

         const result = await questionService.getAllQuestionSetsWithStats();

         expect(result).toHaveLength(2);
         expect(result[0]?.questionCount).toBe(2);
         expect(result[0]?.averageDifficulty).toBe(1.5);
         expect(result[1]?.questionCount).toBe(1);
         expect(result[1]?.averageDifficulty).toBe(2);
       });

      it('should handle empty question sets', async () => {
        mockQuestionRepository.findAllQuestionSets.mockResolvedValue([]);

        const result = await questionService.getAllQuestionSetsWithStats();

        expect(result).toEqual([]);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getAvailableCategories', () => {
      it('should return unique categories from question sets', async () => {
        const questionSets = [
          { ...mockQuestionSet, category: 'General Knowledge' },
          { ...mockQuestionSet2, category: 'Science' },
          { ...mockQuestionSet, category: 'General Knowledge', id: 3 }
        ];

        mockQuestionRepository.findAllQuestionSets.mockResolvedValue(questionSets);

        const result = await questionService.getAvailableCategories();

        expect(result).toEqual(['General Knowledge', 'Science']);
      });

             it('should handle question sets without categories', async () => {
         const questionSets = [
           { ...mockQuestionSet, category: undefined as any },
           { ...mockQuestionSet2, category: 'Science' }
         ];

         mockQuestionRepository.findAllQuestionSets.mockResolvedValue(questionSets);

         const result = await questionService.getAvailableCategories();

         expect(result).toEqual(['Science']);
       });

      it('should return empty array when no question sets exist', async () => {
        mockQuestionRepository.findAllQuestionSets.mockResolvedValue([]);

        const result = await questionService.getAvailableCategories();

        expect(result).toEqual([]);
      });
    });

    describe('getQuestionSetStats', () => {
      it('should return comprehensive question set statistics', async () => {
        const questionSets = [mockQuestionSet, mockQuestionSet2];
        mockQuestionRepository.getQuestionSetCount
          .mockResolvedValueOnce(2) // totalSets
          .mockResolvedValueOnce(2); // activeSets
        mockQuestionRepository.getQuestionCount.mockResolvedValue(10);
        mockQuestionRepository.findAllQuestionSets.mockResolvedValue(questionSets);

        const result = await questionService.getQuestionSetStats();

        expect(result).toEqual({
          totalSets: 2,
          activeSets: 2,
          totalQuestions: 10,
          averageQuestionsPerSet: 5,
          categories: ['General Knowledge', 'Science']
        });
      });

      it('should handle zero question sets', async () => {
        mockQuestionRepository.getQuestionSetCount
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0);
        mockQuestionRepository.getQuestionCount.mockResolvedValue(0);
        mockQuestionRepository.findAllQuestionSets.mockResolvedValue([]);

        const result = await questionService.getQuestionSetStats();

        expect(result).toEqual({
          totalSets: 0,
          activeSets: 0,
          totalQuestions: 0,
          averageQuestionsPerSet: 0,
          categories: []
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockQuestionRepository.findAllQuestionSets.mockRejectedValue(error);

      await expect(questionService.getAllQuestionSets()).rejects.toThrow('Database connection failed');
    });

    it('should handle validation errors', () => {
      const invalidData: CreateQuestionData = {
        question_set_id: 1,
        question_text: {} as any,
        answers: []
      };

      const result = questionService.validateQuestionData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

         it('should handle localization errors gracefully', () => {
       const questionWithMissingText: Question = {
         ...mockQuestion,
         question_text: '' as any,
         answers: []
       };

       const result = questionService.getLocalizedQuestion(questionWithMissingText, 'en');

       expect(result.questionText).toBe('');
       expect(result.answers).toEqual([]);
     });
  });

  describe('Performance Optimization', () => {
    it('should efficiently handle large question sets', async () => {
      const largeQuestionSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockQuestion,
        id: i + 1
      }));

      mockQuestionRepository.findQuestionsBySetId.mockResolvedValue(largeQuestionSet);

      const startTime = Date.now();
      const result = await questionService.getQuestionsBySetId(1);
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently localize multiple questions', async () => {
      const questions = Array.from({ length: 100 }, (_, i) => ({
        ...mockQuestion,
        id: i + 1
      }));

      const startTime = Date.now();
      const result = await questionService.getLocalizedQuestions(questions, 'en');
      const endTime = Date.now();

      expect(result).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
}); 
