import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import {
  uploadSingleFile,
  uploadMultipleFiles,
  validateFileUpload,
  cleanupUploadedFiles
} from '../middleware/fileUpload.js';
import FileProcessingService, { ProcessingOptions } from '../services/FileProcessingService.js';
import { DatabaseService } from '../services/DatabaseService.js';

const router = Router();
const authMiddleware = new AuthMiddleware();
const fileProcessingService = new FileProcessingService();
const databaseService = DatabaseService.getInstance();

// Rate limiting for file uploads
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 upload requests per windowMs
  message: {
    success: false,
    error: 'Too many upload requests, please try again later.'
  }
});

// Rate limiting for file processing - currently unused but ready for future processing endpoints
// const processingRateLimit = rateLimit({
//   windowMs: 5 * 60 * 1000, // 5 minutes
//   max: 5, // Limit each IP to 5 processing requests per windowMs
//   message: {
//     success: false,
//     error: 'Too many processing requests, please try again later.'
//   }
// });

/**
 * POST /api/file-upload/single
 * Upload a single file for processing
 */
router.post('/single',
  authMiddleware.authenticate,
  uploadRateLimit,
  uploadSingleFile,
  validateFileUpload,
  cleanupUploadedFiles,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded.'
        });
        return;
      }

      const userId = (req as any).user.id;
      
      // Process the file
      const processingOptions: ProcessingOptions = {
        chunkSize: 1000,
        chunkOverlap: 200,
        preserveFormatting: true,
        extractMetadata: true
      };

      const processedFile = await fileProcessingService.processFile(
        file.path,
        file.originalname,
        processingOptions
      );

      // Validate content
      const validation = fileProcessingService.validateContent(processedFile.content);
      if (!validation.isValid) {
        fileProcessingService.cleanupFile(file.path);
        res.status(400).json({
          success: false,
          error: 'File content validation failed.',
          details: validation.errors
        });
        return;
      }

      // Store file information in database (removed ChromaDB integration)
      const documentId = `${processedFile.id}_${Date.now()}`;

      // Store file metadata in database
      const fileRecord = await databaseService.query(`
        INSERT INTO uploaded_files (
          file_id, user_id, original_name, file_type, file_size, 
          metadata, chroma_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        processedFile.id,
        userId,
        processedFile.originalName,
        processedFile.fileType,
        processedFile.fileSize,
        JSON.stringify(processedFile.metadata),
        documentId,
        new Date()
      ]);

      // Clean up uploaded file
      fileProcessingService.cleanupFile(file.path);

      res.status(201).json({
        success: true,
        data: {
          fileId: processedFile.id,
          originalName: processedFile.originalName,
          fileType: processedFile.fileType,
          fileSize: processedFile.fileSize,
          metadata: processedFile.metadata,
          chromaDocumentId: documentId,
          chunks: processedFile.chunks.length,
          wordCount: processedFile.metadata.wordCount
        }
      });

    } catch (error) {
      console.error('File upload error:', error);
      
      // Clean up file on error
      if (req.file) {
        fileProcessingService.cleanupFile(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process uploaded file.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/file-upload/batch
 * Upload multiple files for processing
 */
router.post('/batch',
  authMiddleware.authenticate,
  uploadRateLimit,
  uploadMultipleFiles,
  validateFileUpload,
  cleanupUploadedFiles,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files uploaded.'
        });
        return;
      }

      const userId = (req as any).user.id;
      const results: any[] = [];
      const errors: any[] = [];

      // Process each file
      for (const file of files) {
        try {
          const processingOptions: ProcessingOptions = {
            chunkSize: 1000,
            chunkOverlap: 200,
            preserveFormatting: true,
            extractMetadata: true
          };

          const processedFile = await fileProcessingService.processFile(
            file.path,
            file.originalname,
            processingOptions
          );

          // Validate content
          const validation = fileProcessingService.validateContent(processedFile.content);
          if (!validation.isValid) {
            errors.push({
              originalName: file.originalname,
              error: 'File content validation failed.',
              details: validation.errors
            });
            fileProcessingService.cleanupFile(file.path);
            continue;
          }

          // Store file information in database (removed ChromaDB integration)
          const documentId = `${processedFile.id}_${Date.now()}`;

          // Store file metadata in database
          await databaseService.query(`
            INSERT INTO uploaded_files (
              file_id, user_id, original_name, file_type, file_size, 
              metadata, document_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            processedFile.id,
            userId,
            processedFile.originalName,
            processedFile.fileType,
            processedFile.fileSize,
            JSON.stringify(processedFile.metadata),
            documentId,
            new Date()
          ]);

          results.push({
            fileId: processedFile.id,
            originalName: processedFile.originalName,
            fileType: processedFile.fileType,
            fileSize: processedFile.fileSize,
            metadata: processedFile.metadata,
            chromaDocumentId: documentId,
            chunks: processedFile.chunks.length,
            wordCount: processedFile.metadata.wordCount
          });

          // Clean up uploaded file
          fileProcessingService.cleanupFile(file.path);

        } catch (error) {
          errors.push({
            originalName: file.originalname,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          fileProcessingService.cleanupFile(file.path);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          processed: results.length,
          failed: errors.length,
          results,
          errors
        }
      });

    } catch (error) {
      console.error('Batch file upload error:', error);
      
      // Clean up files on error
      if (req.files) {
        (req.files as Express.Multer.File[]).forEach(file => {
          fileProcessingService.cleanupFile(file.path);
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process uploaded files.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/file-upload/status/:id
 * Get upload status for a specific file
 */
router.get('/status/:id',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const fileId = req.params['id'];
      const userId = (req as any).user.id;

      const result = await databaseService.query(`
        SELECT * FROM uploaded_files 
        WHERE file_id = $1 AND user_id = $2
      `, [fileId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'File not found.'
        });
        return;
      }

      const fileRecord = result.rows[0]! as any;

      res.json({
        success: true,
        data: {
          fileId: fileRecord['file_id'],
          originalName: fileRecord['original_name'],
          fileType: fileRecord['file_type'],
          fileSize: fileRecord['file_size'],
          metadata: fileRecord['metadata'],
          chromaDocumentId: fileRecord['chroma_document_id'],
          createdAt: fileRecord['created_at'],
          status: 'processed'
        }
      });

    } catch (error) {
      console.error('File status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file status.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/file-upload/:id
 * Delete an uploaded file
 */
router.delete('/:id',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const fileId = req.params['id'];
      const userId = (req as any).user.id;

      // Get file record
      const result = await databaseService.query(`
        SELECT * FROM uploaded_files 
        WHERE file_id = $1 AND user_id = $2
      `, [fileId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'File not found.'
        });
        return;
      }

      const fileRecord = result.rows[0] as any;

      // ChromaDB integration removed - no longer needed

      // Delete from database
      await databaseService.query(`
        DELETE FROM uploaded_files 
        WHERE file_id = $1 AND user_id = $2
      `, [fileId, userId]);

      res.json({
        success: true,
        message: 'File deleted successfully.'
      });

    } catch (error) {
      console.error('File deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete file.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/file-upload/files
 * List all uploaded files for the user
 */
router.get('/files',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const page = parseInt((req.query as any)['page'] as string) || 1;
      const limit = parseInt((req.query as any)['limit'] as string) || 20;
      const offset = (page - 1) * limit;

      const result = await databaseService.query(`
        SELECT * FROM uploaded_files 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      const countResult = await databaseService.query(`
        SELECT COUNT(*) as total FROM uploaded_files 
        WHERE user_id = $1
      `, [userId]);

      const total = parseInt(((countResult.rows[0] as any)!['total'] ?? '0') as string);

      res.json({
        success: true,
        data: {
          files: result.rows.map((row: any) => ({
            fileId: row['file_id'],
            originalName: row['original_name'],
            fileType: row['file_type'],
            fileSize: row['file_size'],
            metadata: row['metadata'],
            chromaDocumentId: row['chroma_document_id'],
            createdAt: row['created_at']
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('File list error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file list.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/file-upload/files/:id
 * Get details of a specific uploaded file
 */
router.get('/files/:id',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const fileId = req.params['id'];
      const userId = (req as any).user.id;

      const result = await databaseService.query(`
        SELECT * FROM uploaded_files 
        WHERE file_id = $1 AND user_id = $2
      `, [fileId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'File not found.'
        });
        return;
      }

      const fileRecord = result.rows[0]! as any;

      res.json({
        success: true,
        data: {
          fileId: fileRecord['file_id'],
          originalName: fileRecord['original_name'],
          fileType: fileRecord['file_type'],
          fileSize: fileRecord['file_size'],
          metadata: fileRecord['metadata'],
          chromaDocumentId: fileRecord['chroma_document_id'],
          createdAt: fileRecord['created_at']
        }
      });

    } catch (error) {
      console.error('File details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file details.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * PUT /api/file-upload/:id/options
 * Update processing options for a file
 */
router.put('/:id/options',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const fileId = req.params['id'];
      const userId = (req as any).user.id;
      const options = req.body;

      // Verify file ownership
      const fileResult = await databaseService.query(`
        SELECT * FROM uploaded_files 
        WHERE file_id = $1 AND user_id = $2
      `, [fileId, userId]);

      if (fileResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'File not found.'
        });
        return;
      }

      // Update processing options in database
      await databaseService.query(`
        UPDATE uploaded_files 
        SET processing_options = $1, updated_at = NOW()
        WHERE file_id = $2
      `, [JSON.stringify(options), fileId]);

      res.json({
        success: true,
        message: 'Processing options updated successfully.'
      });

    } catch (error) {
      console.error('Update options error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update processing options.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/file-upload/:id/versions
 * Get document versions for a file
 */
router.get('/:id/versions',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const fileId = req.params['id'];
      const userId = (req as any).user.id;

      // Verify file ownership
      const fileResult = await databaseService.query(`
        SELECT * FROM uploaded_files 
        WHERE file_id = $1 AND user_id = $2
      `, [fileId, userId]);

      if (fileResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'File not found.'
        });
        return;
      }

      // ChromaDB integration removed - versions no longer available
      res.json({
        success: true,
        data: []
      });

    } catch (error) {
      console.error('Get versions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get document versions.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/file-upload/:id/update-version
 * Update document version with new content
 */
router.post('/:id/update-version',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const fileId = req.params['id'];
      const userId = (req as any).user.id;
      const { content, metadata } = req.body as any;

      // Verify file ownership
      const fileResult = await databaseService.query(`
        SELECT * FROM uploaded_files 
        WHERE file_id = $1 AND user_id = $2
      `, [fileId, userId]);

      if (fileResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'File not found.'
        });
        return;
      }

      // ChromaDB integration removed - update file record only
      await databaseService.query(`
        UPDATE uploaded_files 
        SET metadata = $1, updated_at = NOW()
        WHERE file_id = $2
      `, [JSON.stringify(metadata), fileId]);

      res.json({
        success: true,
        message: 'File updated successfully.'
      });

    } catch (error) {
      console.error('Update version error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update document version.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/file-upload/stats
 * Get document processing statistics
 */
router.get('/stats',
  authMiddleware.authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.id;

      // Get user's file stats
      const userStats = await databaseService.query(`
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size,
          COUNT(DISTINCT file_type) as file_types
        FROM uploaded_files 
        WHERE user_id = $1
      `, [userId]);

      res.json({
        success: true,
        data: {
          user: {
            totalFiles: parseInt(((userStats.rows[0] as any)!['total_files'] ?? '0') as string),
            totalSize: parseInt(((userStats.rows[0] as any)!['total_size'] ?? '0') as string),
            averageSize: Math.round(parseFloat(((userStats.rows[0] as any)!['avg_size'] ?? '0') as string)),
            fileTypes: parseInt(((userStats.rows[0] as any)!['file_types'] ?? '0') as string)
          }
      }
    });

    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router; 
