import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter function
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.md', '.pdf', '.docx', '.html'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${fileExt} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
  }
});

// Error handling middleware
export const handleFileUploadError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  // Support both real MulterError and mocked variants in tests
  const isMulterError =
    (error as any)?.name === 'MulterError' ||
    typeof (error as any)?.code === 'string' ||
    (error as any) instanceof (multer as any).MulterError;

  if (isMulterError) {
    const code = (error as any).code as string | undefined;
    if (code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File too large. Maximum file size is 10MB.'
      });
      return;
    }
    if (code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        error: 'Too many files. Maximum 10 files per request.'
      });
      return;
    }
    if (code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        success: false,
        error: 'Unexpected file field.'
      });
      return;
    }
  }
  
  if (error.message.includes('File type')) {
    res.status(400).json({
      success: false,
      error: error.message
    });
    return;
  }
  
  next(error);
};

// Single file upload middleware
export const uploadSingle = upload.single('file');

// Multiple files upload middleware
export const uploadMultiple = upload.array('files', 10);

// Custom middleware for single file with error handling
export const uploadSingleFile = (req: Request, res: Response, next: NextFunction): void => {
  uploadSingle(req as any, res as any, (err: any) => {
    if (err) {
      handleFileUploadError(err, req, res, next);
      return;
    }
    next();
  });
};

// Custom middleware for multiple files with error handling
export const uploadMultipleFiles = (req: Request, res: Response, next: NextFunction): void => {
  uploadMultiple(req as any, res as any, (err: any) => {
    if (err) {
      handleFileUploadError(err, req, res, next);
      return;
    }
    next();
  });
};

// Validation middleware
export const validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file && !req.files) {
    res.status(400).json({
      success: false,
      error: 'No file uploaded.'
    });
    return;
  }
  
  next();
};

// Cleanup middleware to remove uploaded files on error
export const cleanupUploadedFiles = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // If response indicates error, cleanup uploaded files
    if (res.statusCode >= 400) {
      const files = req.file ? [req.file] : (req.files as Express.Multer.File[] || []);
      
      files.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error('Error cleaning up file:', error);
          }
        }
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

export default upload; 