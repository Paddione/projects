import fs from 'fs';
import path from 'path';
import * as mammoth from 'mammoth';

import { JSDOM } from 'jsdom';

export interface ProcessedFile {
  id: string;
  originalName: string;
  fileType: string;
  content: string;
  metadata: FileMetadata;
  chunks: string[];
  processedAt: Date;
  fileSize: number;
}

export interface FileMetadata {
  title?: string;
  author?: string;
  creationDate?: Date;
  lastModified?: Date;
  pageCount?: number;
  wordCount?: number;
  language?: string;
  source: string;
  fileExtension: string;
  mimeType?: string;
  fileSize?: number;
}

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  preserveFormatting?: boolean;
  extractMetadata?: boolean;
}

export class FileProcessingService {
  private defaultChunkSize = 1000;
  private defaultChunkOverlap = 200;

  /**
   * Process a file and extract its content with metadata
   */
  async processFile(
    filePath: string,
    originalName: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessedFile> {
    const fileStats = fs.statSync(filePath);
    const fileExtension = path.extname(originalName).toLowerCase();
    const fileType = this.getFileType(fileExtension);
    
    // Extract content based on file type
    const { content, metadata } = await this.extractContent(filePath, fileExtension, options);
    
    // Generate chunks
    const chunks = this.chunkContent(content, options);
    
    // Create processed file object
    const toNumber = (v: any): number => typeof v === 'bigint' ? Number(v) : v as number;
    const processedFile: ProcessedFile = {
      id: this.generateFileId(originalName),
      originalName,
      fileType,
      content,
      metadata: {
        ...metadata,
        source: originalName,
        fileExtension,
        fileSize: toNumber(fileStats.size)
      },
      chunks,
      processedAt: new Date(),
      fileSize: toNumber(fileStats.size)
    };

    return processedFile;
  }

  /**
   * Extract content from different file types
   */
  private async extractContent(
    filePath: string,
    fileExtension: string,
    options: ProcessingOptions
  ): Promise<{ content: string; metadata: FileMetadata }> {
    const buffer = fs.readFileSync(filePath);
    
    switch (fileExtension) {
      case '.pdf':
        return this.extractPdfContent(buffer, options);
      case '.docx':
        return this.extractDocxContent(buffer, options);
      case '.md':
        return this.extractMarkdownContent(buffer, options);
      case '.html':
        return this.extractHtmlContent(buffer, options);
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  }

  /**
   * Extract content from PDF files
   */
  private async extractPdfContent(
    buffer: Buffer,
    options: ProcessingOptions
  ): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      // Dynamically resolve pdf-parse (works with Jest mocks and ESM/CJS variants)
      let parsePdf: undefined | ((b: Buffer) => Promise<any>);
      try {
        const mod: any = await import('pdf-parse');
        parsePdf = (typeof mod === 'function' ? mod : mod?.default) as any;
      } catch {
        parsePdf = undefined;
      }
      const data = await (parsePdf ? parsePdf(buffer) : Promise.resolve(undefined));
      const safe = data ?? { text: buffer.toString('utf-8'), numpages: 1, info: {} };
      
      const metadata: FileMetadata = {
        pageCount: safe.numpages ?? 1,
        wordCount: (safe.text ?? '').split(/\s+/).filter(Boolean).length,
        language: this.detectLanguage(safe.text ?? ''),
        source: 'pdf',
        fileExtension: '.pdf',
        mimeType: 'application/pdf'
      };

      // Extract additional metadata if available
      if (safe.info) {
        if (safe.info.Title) metadata.title = safe.info.Title;
        if (safe.info.Author) metadata.author = safe.info.Author;
        if (safe.info.CreationDate) {
          const creationDate = this.parsePdfDate(safe.info.CreationDate);
          if (creationDate) metadata.creationDate = creationDate;
        }
        if (safe.info.ModDate) {
          const modDate = this.parsePdfDate(safe.info.ModDate);
          if (modDate) metadata.lastModified = modDate;
        }
      }

      return {
        content: safe.text ?? '',
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from DOCX files
   */
  private async extractDocxContent(
    buffer: Buffer,
    options: ProcessingOptions
  ): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      const extract = (mammoth as any)?.extractRawText as undefined | ((arg: any) => Promise<any>);
      const result = extract ? await extract({ buffer }) : undefined;
      const value: string = result?.value ?? buffer.toString('utf-8');
      
      const metadata: FileMetadata = {
        wordCount: value.split(/\s+/).filter(Boolean).length,
        language: this.detectLanguage(value),
        source: 'docx',
        fileExtension: '.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };

      return {
        content: value,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to extract DOCX content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from Markdown files
   */
  private extractMarkdownContent(
    buffer: Buffer,
    options: ProcessingOptions
  ): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      const content = buffer.toString('utf-8');
      
      // Parse markdown to extract frontmatter and content
      const { frontmatter, text } = this.parseMarkdownFrontmatter(content);
      
      const metadata: FileMetadata = {
        ...frontmatter,
        wordCount: text.split(/\s+/).length,
        language: this.detectLanguage(text),
        source: 'markdown',
        fileExtension: '.md',
        mimeType: 'text/markdown'
      };

      return Promise.resolve({
        content: text,
        metadata
      });
    } catch (error) {
      throw new Error(`Failed to extract Markdown content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from HTML files
   */
  private extractHtmlContent(
    buffer: Buffer,
    options: ProcessingOptions
  ): Promise<{ content: string; metadata: FileMetadata }> {
    try {
      const html = buffer.toString('utf-8');
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract text content
      const text = document.body?.textContent || '';
      
      // Extract metadata from meta tags
      const metadata: FileMetadata = {
        ...(document.title && { title: document.title }),
        wordCount: text.split(/\s+/).length,
        language: this.detectLanguage(text),
        source: 'html',
        fileExtension: '.html',
        mimeType: 'text/html'
      };

      // Extract additional metadata from meta tags
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach((meta: any) => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');
        
        if (name && content) {
          switch (name.toLowerCase()) {
            case 'author':
              metadata.author = content;
              break;
            case 'description':
              // Could be used for additional context
              break;
            case 'language':
              metadata.language = content;
              break;
          }
        }
      });

      return Promise.resolve({
        content: text,
        metadata
      });
    } catch (error) {
      throw new Error(`Failed to extract HTML content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse markdown frontmatter
   */
  private parseMarkdownFrontmatter(content: string): { frontmatter: any; text: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      const frontmatterText = match[1];
      const text = match[2];
      
      // Simple frontmatter parsing (could be enhanced with YAML parser)
      const frontmatter: any = {};
      if (frontmatterText) {
        frontmatterText.split('\n').forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            frontmatter[key] = value;
          }
        });
      }
      
      return { frontmatter, text: text || content };
    }
    
    return { frontmatter: {}, text: content };
  }

  /**
   * Chunk content into smaller pieces for processing
   */
  private chunkContent(content: string, options: ProcessingOptions): string[] {
    const chunkSize = options.chunkSize || this.defaultChunkSize;
    const chunkOverlap = options.chunkOverlap || this.defaultChunkOverlap;
    
    if (content.length <= chunkSize) {
      return [content];
    }
    
    const chunks: string[] = [];
    let start = 0;
    
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      let chunk = content.substring(start, end);
      
      // Try to break at sentence boundaries
      if (end < content.length) {
        const lastSentenceEnd = chunk.lastIndexOf('. ');
        const lastParagraphEnd = chunk.lastIndexOf('\n\n');
        const breakPoint = Math.max(lastSentenceEnd, lastParagraphEnd);
        
        if (breakPoint > start + chunkSize * 0.7) {
          chunk = content.substring(start, breakPoint + 1);
        }
      }
      
      chunks.push(chunk.trim());
      start = end - chunkOverlap;
      
      if (start >= content.length) break;
    }
    
    return chunks;
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const name = path.basename(originalName, path.extname(originalName));
    const safeName = name || 'file';
    return `${safeName}-${timestamp}-${random}`;
  }

  /**
   * Get file type from extension
   */
  private getFileType(fileNameOrExtension: string): string {
    const extension = fileNameOrExtension.startsWith('.')
      ? fileNameOrExtension.toLowerCase()
      : path.extname(fileNameOrExtension).toLowerCase();
    const typeMap: { [key: string]: string } = {
      '.pdf': 'pdf',
      '.docx': 'docx',
      '.md': 'markdown',
      '.html': 'html'
    };
    
    return typeMap[extension] || 'unknown';
  }

  /**
   * Detect language from text content
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on common words
    const germanWords = ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'sich', 'ist', 'deutscher'];
    const englishWords = ['the', 'and', 'to', 'of', 'a', 'in', 'that', 'it', 'with', 'as', 'is', 'english'];
    
    const words = text.toLowerCase().split(/\s+/);
    const germanCount = words.filter(word => germanWords.includes(word)).length;
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    
    return germanCount > englishCount ? 'de' : 'en';
  }

  /**
   * Parse PDF date string
   */
  private parsePdfDate(dateString: string): Date | undefined {
    try {
      // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm'
      const match = dateString.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        if (year && month && day && hour && minute && second) {
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          );
        }
      }
    } catch (error) {
      console.warn('Failed to parse PDF date:', dateString);
    }
    return undefined;
  }

  /**
   * Validate file content
   */
  validateContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!content || content.trim().length === 0) {
      errors.push('Content is empty');
    }
    
    if (content.length < 10) {
      errors.push('Content is too short (minimum 10 characters)');
    }
    
    if (content.length > 1000000) { // 1MB text limit
      errors.push('Content is too long (maximum 1MB)');
      return {
        isValid: false,
        errors
      };
    }
    
    // Check for null bytes and other invalid characters
    if (content.includes('\x00') || content.includes('\x01') || content.includes('\x02')) {
      errors.push('Content contains invalid characters');
    }
    
    // Check for potentially malicious content
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        errors.push('File contains potentially malicious content');
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean up temporary files
   */
  cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
  }
}

export default FileProcessingService; 
