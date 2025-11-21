
import { POST } from '../app/api/answer/route';
import { NextRequest } from 'next/server';

// Mock environment variable
process.env.HASH_SALT = 'test-salt-for-testing-only-123456789';

jest.mock('../lib/openai', () => ({
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  generateAnswer: jest.fn().mockResolvedValue({ answer: 'This is a test answer.' }),
}));

jest.mock('../lib/supabase', () => ({
  searchDocuments: jest.fn().mockResolvedValue([
    { content: 'Test chunk 1', similarity: 0.9 },
    { content: 'Test chunk 2', similarity: 0.8 },
  ]),
}));

describe('/api/answer', () => {
  it('should return a valid response', async () => {
    const request = new NextRequest('http://localhost/api/answer', {
      method: 'POST',
      body: JSON.stringify({ query: 'What is RAG?' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('answer');
    expect(data).toHaveProperty('citations');
    expect(data.answer).toBe('This is a test answer.');
    expect(data.citations).toHaveLength(2);
    expect(data.citations[0].content).toBe('Test chunk 1...');
  });
});
