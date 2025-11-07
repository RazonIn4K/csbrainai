# RAG System Overview

RAG (Retrieval Augmented Generation) is an AI architecture pattern that enhances large language models by providing them with relevant context from a knowledge base before generating responses.

## How It Works

The RAG system consists of three main phases:

### 1. Ingestion Phase
During ingestion, documents are processed and stored:
- Documents are chunked into smaller, semantically meaningful pieces
- Each chunk is converted into a vector embedding using OpenAI's text-embedding-3-small model
- Embeddings are 1536-dimensional vectors that capture semantic meaning
- Chunks are stored in Supabase with pgvector extension

### 2. Retrieval Phase
When a user asks a question:
- The query is converted to a vector embedding using the same model
- Vector similarity search finds the most relevant chunks using cosine distance
- The top 5 most similar chunks are retrieved as context
- A minimum similarity threshold of 0.5 ensures quality

### 3. Generation Phase
With retrieved context:
- The context chunks are combined with the user's query
- This augmented prompt is sent to gpt-4o-mini
- The LLM generates an answer based on the provided context
- Citations are returned so users can verify the sources

## Benefits of RAG

RAG provides several advantages:
- Reduces hallucinations by grounding responses in factual data
- Allows updating knowledge without retraining the model
- Provides transparency through citations
- Scales to large knowledge bases efficiently
