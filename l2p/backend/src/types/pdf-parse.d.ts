declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info?: {
      Title?: string;
      Author?: string;
      CreationDate?: string;
      ModDate?: string;
    };
  }

  function pdf(buffer: Buffer): Promise<PDFData>;
  export = pdf;
} 