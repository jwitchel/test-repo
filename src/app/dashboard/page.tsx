'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">Welcome back, {user.email}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>You&apos;re signed in as</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{user.email}</p>
              {user.name && <p className="text-sm text-muted-foreground">{user.name}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Accounts</CardTitle>
              <CardDescription>Manage your email connections</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Connect and manage your email accounts</p>
              <Button className="mt-4" size="sm" asChild>
                <a href="/settings/email-accounts">Connect Email</a>
              </Button>
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle>LLM Providers</CardTitle>
              <CardDescription>Configure AI providers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Set up OpenAI, Anthropic, or other AI providers</p>
              <Button className="mt-4" size="sm" asChild>
                <a href="/settings/llm-providers">Configure LLM</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tone Profile</CardTitle>
              <CardDescription>Your writing style analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View your analyzed writing patterns and tone</p>
              <Button className="mt-4" size="sm" asChild>
                <a href="/tone">View Tone Analysis</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interactive Demo</CardTitle>
              <CardDescription>Test email analysis pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Analyze emails and see real-time processing</p>
              <Button className="mt-4" size="sm" asChild>
                <a href="/inspector">Open Inspector</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>LLM Testing</CardTitle>
              <CardDescription>Test your AI providers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Generate text using your configured LLM providers</p>
              <Button className="mt-4" size="sm" asChild>
                <a href="/llm-demo">Test LLM</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database Browser</CardTitle>
              <CardDescription>Inspect PostgreSQL database</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Browse and query database tables using Adminer</p>
              <div className="mt-2 p-2 bg-muted rounded-md">
                <p className="text-xs font-medium">Connection Details:</p>
                <p className="text-xs text-muted-foreground">Server: postgres</p>
                <p className="text-xs text-muted-foreground">Username: aiemailuser</p>
                <p className="text-xs text-muted-foreground">Password: aiemailpass</p>
                <p className="text-xs text-muted-foreground">Database: aiemaildb</p>
              </div>
              <Button className="mt-4" size="sm" asChild>
                <a href="http://localhost:8889" target="_blank" rel="noopener noreferrer">Open Database Browser</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vector Database</CardTitle>
              <CardDescription>Browse Qdrant collections</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View and manage email vectors, embeddings, and metadata</p>
              <div className="mt-2 p-2 bg-muted rounded-md">
                <p className="text-xs font-medium">Collections:</p>
                <p className="text-xs text-muted-foreground">• emails - Stored email embeddings</p>
                <p className="text-xs text-muted-foreground">• Features: redacted names, relationships</p>
              </div>
              <Button className="mt-4" size="sm" asChild>
                <a href="http://localhost:6333/dashboard" target="_blank" rel="noopener noreferrer">Open Qdrant Dashboard</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}