# RAG Integration Guide

## Overview
This project now includes a Retrieval-Augmented Generation (RAG) system that uses your project data (ICPs, content, red flags, internal links) to answer questions, and also supports uploading custom documents for Q&A.

## Features
- **Project Data RAG**: Answer questions about ICPs, content, red flags, and internal links
- **Document Upload**: Upload TXT and DOCX files for custom document Q&A
- **Cost Tracking**: Estimates usage costs in USD and tokens used
- **Vector Search**: Efficient similarity search using embeddings

## Setup
1. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=your-openai-api-key-here
   ```

2. Install dependencies (already done):
   ```bash
   npm install
   ```

3. Seed the database with sample data:
   ```bash
   npx tsx scripts/seed.ts
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

### Project Data Q&A
1. Navigate to `/rag`
2. Ask questions about your project data without uploading a document
3. Examples:
   - "What are the pain points of our fintech ICP?"
   - "Show me red flags for AI content"
   - "What internal links should I use?"

### Custom Document Q&A
1. Navigate to `/rag`
2. Click "Choose File" and select a TXT or DOCX document
3. Wait for upload confirmation
4. Ask questions about the uploaded document
5. The system will analyze the document and provide answers based on its content

## Supported File Types
- **TXT**: Plain text files
- **DOCX**: Microsoft Word documents
- **PDF**: Not yet supported (coming soon)

## API Endpoints

### Query RAG
POST `/api/rag`
```json
{
  "question": "What are the main topics in this document?",
  "fileName": "my-document.docx"  // optional, for custom documents
}
```

Response:
```json
{
  "answer": "Based on the document content...",
  "creditsUsed": 0.02,
  "tokensUsed": 150
}
```

### Upload Document
POST `/api/rag/upload`
- Content-Type: multipart/form-data
- Body: FormData with 'file' field

## Cost Estimation
- Uses OpenAI's token-based pricing
- ~$0.002 per 1K tokens for GPT-3.5-turbo
- Estimates are approximate and may vary

## Technical Details
- **Embeddings**: OpenAI text-embedding-ada-002
- **LLM**: GPT-3.5-turbo
- **Vector Store**: In-memory for development (use Redis/Weaviate in production)
- **Chunking**: Simple paragraph-based splitting