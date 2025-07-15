'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Email Assistant</h1>
          <div className="flex gap-4">
            <Button asChild variant="ghost">
              <Link href="/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            AI-Powered Email Reply Drafts
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Generate email responses that match your unique writing tone and style
          </p>
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Tone Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Our AI analyzes your email history to learn your unique writing style,
                ensuring replies sound authentically like you.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Generate contextually appropriate email replies in seconds,
                maintaining professionalism while saving time.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Connect your email accounts securely and manage all your
                correspondence from one unified interface.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}