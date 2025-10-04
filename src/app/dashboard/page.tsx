'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiGet } from '@/lib/api'
import { Mail, Brain, Eye, EyeOff, Loader2 } from 'lucide-react'
import useSWR from 'swr'

interface EmailAccount {
  id: string
  email_address: string
  monitoring_enabled: boolean
  is_active: boolean
}

interface LLMProvider {
  id: string
  provider_name: string
  provider_type: string
  is_default: boolean
  is_active: boolean
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(res => res.json())

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [displayName, setDisplayName] = useState<string>('')

  const { data: emailAccounts, isLoading: accountsLoading } = useSWR<EmailAccount[]>(
    user ? 'http://localhost:3002/api/email-accounts' : null,
    fetcher
  )

  const { data: providers, isLoading: providersLoading } = useSWR<LLMProvider[]>(
    user ? 'http://localhost:3002/api/llm-providers' : null,
    fetcher
  )

  const defaultProvider = providers?.find(p => p.is_default) || null

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

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Account Summary</CardTitle>
              <CardDescription>Your configuration at a glance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Accounts */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  Email Accounts
                </div>
                {accountsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : emailAccounts && emailAccounts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Monitoring</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.email_address}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {account.monitoring_enabled ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {account.monitoring_enabled ? 'Enabled' : 'Paused'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.is_active ? 'default' : 'secondary'}>
                              {account.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground py-4">No email accounts configured</div>
                )}
              </div>

              {/* Default LLM Provider */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  Default LLM Provider
                </div>
                {providersLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : defaultProvider ? (
                  <div className="text-sm font-medium py-2">{defaultProvider.provider_name}</div>
                ) : (
                  <div className="text-sm text-muted-foreground py-2">No default provider configured</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}