'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

export default function LLMDemoPage() {
  const { error: showError } = useToast()
  const [prompt, setPrompt] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showError('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedText('')

    try {
      const response = await fetch('http://localhost:3002/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: prompt.trim(),
          temperature: 0.7,
          max_tokens: 500
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setGeneratedText(data.reply)
      } else {
        setError(data.message || 'Failed to generate text')
        if (response.status === 404) {
          setError('No LLM provider configured. Please add one in settings.')
        }
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to Dashboard
        </Link>
      </div>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">LLM Demo</h1>
        <p className="text-muted-foreground">
          Test your configured LLM providers
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate Text</CardTitle>
          <CardDescription>
            Enter a prompt and generate text using your default LLM provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Write a haiku about programming..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                {error.includes('No LLM provider') && (
                  <Link href="/settings/llm-providers" className="ml-2 underline">
                    Configure Provider
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}

          {generatedText && (
            <div className="space-y-2">
              <Label>Generated Text:</Label>
              <div className="p-4 rounded-lg bg-muted whitespace-pre-wrap">
                {generatedText}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LLM Provider Status</CardTitle>
          <CardDescription>
            Check which providers are configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              To use this demo, you need to configure at least one LLM provider.
            </p>
            <Link href="/settings/llm-providers">
              <Button variant="outline">
                Manage LLM Providers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}