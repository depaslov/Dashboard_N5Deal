'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface RAGResponse {
  answer: string
  creditsUsed: number
  tokensUsed: number
}

export default function RAGPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.includes('text') && !file.name.endsWith('.docx')) {
      toast.error('Please upload a TXT or DOCX file')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload file')
      }

      setUploadedFile(file)
      toast.success('Document uploaded successfully')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setIsLoading(true)
    try {
      const body: Record<string, string> = { question }
      if (uploadedFile) {
        body.fileName = uploadedFile.name
      }

      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error('Failed to get RAG response')
      }

      const data: RAGResponse = await response.json()
      setAnswer(data.answer)
      toast.success(`Query completed - ${data.creditsUsed} credits used`)
    } catch (error) {
      console.error('RAG query error:', error)
      toast.error('Failed to process RAG query')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">RAG System</h1>
        <p className="text-muted-foreground">
          Ask questions against your project knowledge or uploaded documents. If a document is uploaded, it will be used first.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Document Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="file-upload" className="block text-sm font-medium mb-2">
                  Upload Document (TXT, DOCX)
                </label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".txt,.docx"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </div>
              {uploadedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{uploadedFile.name}</span>
                </div>
              )}
              {isUploading && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ask a Question</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about the uploaded document..."
                  rows={4}
                />
              </div>
              <Button type="submit" disabled={isLoading || !question.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Ask Question
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {answer && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap">{answer}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}