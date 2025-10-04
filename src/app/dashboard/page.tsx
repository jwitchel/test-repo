'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back, {user.email}</p>
        </div>

        <div className="max-w-md">
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
        </div>
      </div>
    </div>
  )
}