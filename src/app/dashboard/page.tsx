'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiGet } from '@/lib/api'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [displayName, setDisplayName] = useState<string>('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user?.id) return

      try {
        const data = await apiGet<{ preferences: { name?: string } }>('/api/settings/profile')
        if (data.preferences?.name) {
          // Extract first name from full name
          const firstName = data.preferences.name.split(' ')[0]
          setDisplayName(firstName)
        } else if (user.name) {
          const firstName = user.name.split(' ')[0]
          setDisplayName(firstName)
        } else {
          setDisplayName(user.email)
        }
      } catch {
        // Fallback to email if preferences can't be loaded
        setDisplayName(user.email)
      }
    }

    loadUserPreferences()
  }, [user])


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
          <p className="text-muted-foreground mt-2">Welcome back, {displayName || user.email}</p>
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