# Requirements: Enterprise RAG Chatbot

## 1. Overview

This system allows employees to securely chat with internal PDF documents (HR policies, Technical Manuals) without data leaving the company's private cloud. It uses Retrieval-Augmented Generation (RAG) to provide accurate, cited answers.

## 2. Functional Requirements

### 2.1. Document Ingestion

- **REQ-ING-01:** The system SHALL accept PDF and Text files.
- **REQ-ING-02:** The system SHALL split text into chunks of 500-1000 tokens.
- **REQ-ING-03:** The system SHALL generate vector embeddings using OpenAI `text-embedding-3-small`.

### 2.2. Retrieval & Generation

- **REQ-RET-01:** The system SHALL retrieve the top 3 most relevant chunks for a user query.
- **REQ-GEN-01:** The system SHALL use GPT-4 to answer the query using _only_ the retrieved chunks.
- **REQ-GEN-02:** The system SHALL provide citations (Source Document + Page Number) for every claim.

### 2.3. Guardrails

- **REQ-SEC-01:** The system SHALL refuse to answer questions unrelated to the provided documents.
- **REQ-SEC-02:** The system SHALL return "I don't know" if the answer is not found in the context.

## 3. Non-Functional Requirements

- **REQ-PERF-01:** Retrieval latency SHALL be under 200ms.
- **REQ-PRIV-01:** Documents SHALL be stored in a private Vector DB (Chroma/Pinecone).
