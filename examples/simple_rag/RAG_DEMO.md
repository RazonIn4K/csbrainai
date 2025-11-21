# CSBrain RAG: Intelligent Knowledge Assistant

> Securely chat with your company's documents, policies, and technical manuals without hallucinations.

---

## 1. Client / Scenario Snapshot

- **Type:** Internal Enterprise Tool
- **Industry:** Tech / Legal / HR
- **Context:**  
  Employees were wasting hours searching through Google Drive and Slack for "that one PDF about the Q3 strategy." They needed a way to just ask a question and get a verified answer.

---

## 2. Problem & Goals

**Core problem**

- **Information Silos:** Data scattered across PDFs, Notion, and Slack.
- **Hallucinations:** Generic ChatGPT makes things up when asked about internal policies.
- **Security:** Cannot paste sensitive docs into public ChatGPT.

**Goals**

- **Unified Search:** One chat interface for all docs.
- **Citations:** Every answer must link back to the source PDF/page.
- **Privacy:** Data stays within the company's private vector database.

---

## 3. Constraints & Requirements

- **Tech:** LangChain, OpenAI (via Azure/Enterprise), ChromaDB (Vector Store).
- **Accuracy:** Must say "I don't know" if the answer isn't in the docs.

---

## 4. Solution Overview

We built a **RAG (Retrieval-Augmented Generation)** pipeline.

1. **Ingest:** A script watches a folder (or Google Drive) for new files.
2. **Chunk & Embed:** Documents are split into paragraphs and converted to vector embeddings.
3. **Retrieve:** When a user asks a question, we find the top 3 most relevant paragraphs.
4. **Generate:** We send those paragraphs + the question to GPT-4 with a strict instruction: _"Answer using ONLY these facts."_

---

## 5. Architecture & Flow

**High-level flow**

1. **User:** "What is the PTO policy?"
2. **Vector DB:** Finds "Employee Handbook - Page 12".
3. **LLM:** Reads Page 12 and formulates answer.
4. **UI:** Displays answer + "Source: Employee Handbook".

**Text diagram**

```text
[Docs] → [Ingestion Script] → [Vector DB (Chroma)]
                                     ↓
[User Query] → [Retriever] → [Relevant Chunks] → [GPT-4] → [Answer + Citations]
```

---

## 6. Implementation Highlights

- **Design:**
  Used "Hybrid Search" (Keyword + Semantic) to ensure exact matches (like "Error 503") are found even if the semantic meaning is vague.

- **Guardrails:**
  System prompt includes: _"If the context does not contain the answer, reply 'I cannot find that information in the provided documents.' Do not guess."_

- **Hard Edges:**
  Handled PDF parsing edge cases (tables, headers) to ensure clean text ingestion.

---

## 7. Results & Impact

- **Efficiency:** Reduced "Where can I find...?" Slack messages by 60%.
- **Trust:** Users trust the bot because it cites its sources.
- **Speed:** Answers in <3 seconds vs 15 minutes of searching.

---

## 8. Tech Stack

- **Framework:** LangChain / LlamaIndex
- **LLM:** OpenAI GPT-4 / Azure OpenAI
- **Database:** ChromaDB / Pinecone / PGVector
- **Frontend:** Next.js / Streamlit

---

## 9. Links & Artifacts

- **Demo Script:** [rag_demo.py](./rag_demo.py)
- **Architecture Diagram:** _(See assets)_

---

## 10. Where This Pattern Re-Applies

- “Same pattern works for: **Legal Contract Review** (Chat with a lease).”
- “Works for: **Technical Support** (Chat with manuals/API docs).”
- “Works for: **Educational Tutors** (Chat with course textbooks).”

---

## 11. How I’d Run This As a Client Sprint

- **Sprint length:** 2-3 Weeks
- **What you get:**
  - Private RAG pipeline deployed on your cloud.
  - Custom ingestion for your specific data sources (Notion, Drive, etc.).
  - Evaluation report showing accuracy on test questions.
- **Next step:** Run a "Data Audit" to clean up your docs before indexing.
