/**
 * Text chunking utilities for document ingestion
 * Uses recursive character text splitter for better chunk quality
 */

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

/**
 * Split text into chunks with overlap
 * Recursive algorithm that tries separators in order
 *
 * @param text - Text to split
 * @param options - Chunking options
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  options: ChunkOptions = { chunkSize: 1000, chunkOverlap: 200 }
): string[] {
  const { chunkSize, chunkOverlap, separators = DEFAULT_SEPARATORS } = options;

  if (text.length <= chunkSize) {
    return [text];
  }

  // Try each separator in order
  for (const separator of separators) {
    if (separator === '') {
      // Character-level split (fallback)
      return splitByCharacter(text, chunkSize, chunkOverlap);
    }

    if (text.includes(separator)) {
      const splits = text.split(separator);
      return mergeSplits(splits, separator, chunkSize, chunkOverlap);
    }
  }

  // Should never reach here due to empty string separator
  return splitByCharacter(text, chunkSize, chunkOverlap);
}

/**
 * Merge splits into chunks with overlap
 */
function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const split of splits) {
    const splitLength = split.length;

    // If adding this split would exceed chunk size, finalize current chunk
    if (currentLength + splitLength + separator.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(separator));

      // Keep overlap from end of current chunk
      const overlapText = currentChunk.join(separator);
      currentChunk = [];
      currentLength = 0;

      // Add overlap
      if (chunkOverlap > 0 && overlapText.length > chunkOverlap) {
        const overlap = overlapText.slice(-chunkOverlap);
        currentChunk.push(overlap);
        currentLength = overlap.length;
      }
    }

    currentChunk.push(split);
    currentLength += splitLength + separator.length;
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(separator));
  }

  return chunks;
}

/**
 * Character-level split (fallback)
 */
function splitByCharacter(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    chunks.push(text.slice(start, end));
    start = end - chunkOverlap;
  }

  return chunks;
}

/**
 * Preprocess text before chunking
 * - Normalize whitespace
 * - Remove excessive newlines
 * - Trim
 */
export function preprocessText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .trim();
}
