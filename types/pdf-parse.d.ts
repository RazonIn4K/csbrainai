declare module 'pdf-parse' {
  interface PDFMetadata {
    Title?: string;
    Author?: string;
    CreationDate?: string;
    ModDate?: string;
    [key: string]: unknown;
  }

  interface PDFResult {
    numpages: number;
    numrender: number;
    info: PDFMetadata;
    metadata?: PDFMetadata;
    version?: string;
    text: string;
  }

  type PDFParse = (data: Buffer | Uint8Array, options?: Record<string, unknown>) => Promise<PDFResult>;

  const pdfParse: PDFParse;
  export default pdfParse;
}
