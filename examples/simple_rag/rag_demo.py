import os
from typing import List
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA
from langchain.schema import Document

# Configuration
os.environ["OPENAI_API_KEY"] = "sk-..."  # User would replace this


def create_demo_docs() -> List[Document]:
    """Create some mock documents for the demo."""
    return [
        Document(
            page_content="The 'Project Phoenix' initiative aims to reduce server costs by 40% by migrating to serverless architecture.",
            metadata={"source": "strategy_memo.pdf"},
        ),
        Document(
            page_content="Employees are entitled to 20 days of PTO per year, plus 10 federal holidays.",
            metadata={"source": "employee_handbook.pdf"},
        ),
        Document(
            page_content="The Q3 revenue target is $1.5M, driven primarily by the new Enterprise tier launch.",
            metadata={"source": "q3_goals.pdf"},
        ),
    ]


def run_rag_demo():
    print("🚀 Starting RAG Demo...")

    # 1. Load & Split Docs
    docs = create_demo_docs()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    splits = text_splitter.split_documents(docs)
    print(f"✅ Loaded {len(splits)} document chunks.")

    # 2. Index (Vector Store)
    print("🧠 Indexing documents in ChromaDB...")
    embeddings = OpenAIEmbeddings()
    vectorstore = Chroma.from_documents(documents=splits, embedding=embeddings)

    # 3. Setup Retrieval Chain
    llm = ChatOpenAI(model_name="gpt-4", temperature=0)
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(),
        return_source_documents=True,
    )

    # 4. Ask Questions
    questions = [
        "What is the goal of Project Phoenix?",
        "How many PTO days do I get?",
        "What is the revenue target for Q3?",
    ]

    print("\n🤖 Q&A Session:")
    for q in questions:
        print(f"\nQ: {q}")
        result = qa_chain.invoke({"query": q})
        print(f"A: {result['result']}")
        print(f"   (Source: {result['source_documents'][0].metadata['source']})")


if __name__ == "__main__":
    # Note: This requires `pip install langchain langchain-openai chromadb`
    # run_rag_demo()
    print(
        "This is a demo script. Uncomment run_rag_demo() to execute with a valid API Key."
    )
