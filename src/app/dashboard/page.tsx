'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const { success } = useToast()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [user, loading, router])

  const handleSignOut = async () => {
    await signOut()
    success('Signed out successfully')
    router.push('/signin')
  }

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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-4">
            <Button asChild variant="ghost">
              <a href="/settings">Settings</a>
            </Button>
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </div>
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
              <p className="text-sm text-muted-foreground">No tone profile created yet</p>
              <Button className="mt-4" size="sm">
                Create Profile
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
                <a href="/imap-logs-demo">Open Demo</a>
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
        </div>
      </div>
    </div>
  )
}