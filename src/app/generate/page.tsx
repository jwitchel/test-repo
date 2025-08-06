'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Bot, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function GeneratePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [emailContent, setEmailContent] = useState('')
  const [generatedReply, setGeneratedReply] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    // TODO: Implement actual generation logic
    setTimeout(() => {
      setGeneratedReply('This is where your AI-generated reply will appear based on your writing tone.')
      setIsGenerating(false)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Generate Reply</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            Paste an email and generate a reply in your writing style
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Original Email</CardTitle>
              <CardDescription>Paste the email you want to reply to</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email-content">Email Content</Label>
                  <Textarea
                    id="email-content"
                    placeholder="Paste the email content here..."
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="min-h-[200px] mt-2"
                  />
                </div>
                <Button 
                  onClick={handleGenerate} 
                  disabled={!emailContent.trim() || isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Bot className="mr-2 h-4 w-4 animate-pulse" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Generate Reply
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {generatedReply && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Reply</CardTitle>
                <CardDescription>Your AI-generated response</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="whitespace-pre-wrap">{generatedReply}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">
                      Copy to Clipboard
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Edit & Refine
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}