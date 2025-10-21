'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Mail, Brain, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import useSWR from 'swr'
import { ActionsSummaryChart } from '@/components/dashboard/actions-summary-chart'
import { RecentActionsTable } from '@/components/dashboard/recent-actions-table'
import { useToast } from '@/hooks/use-toast'

interface EmailAccount {
  id: string
  email_address: string
  monitoring_enabled: boolean
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
  const { success, error } = useToast()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!
  const [lookBackOption, setLookBackOption] = useState<string>('15min')

  const { data: emailAccounts, isLoading: accountsLoading} = useSWR<EmailAccount[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL!}/api/email-accounts` : null,
    fetcher
  )

  const { data: providers, isLoading: providersLoading } = useSWR<LLMProvider[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL!}/api/llm-providers` : null,
    fetcher
  )

  const defaultProvider = providers?.find(p => p.is_default) || null

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [user, loading, router])

  const getLookBackDate = (option: string): Date => {
    const now = new Date();

    switch (option) {
      case '15min':
        return new Date(now.getTime() - 15 * 60 * 1000);
      case '1hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '4hours':
        return new Date(now.getTime() - 4 * 60 * 60 * 1000);
      case 'today':
        // Start of today (midnight)
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return today;
      case 'yesterday':
        // Start of yesterday (midnight)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        return yesterday;
      default:
        return new Date(now.getTime() - 15 * 60 * 1000);
    }
  };

  const getLookBackLabel = (option: string): string => {
    switch (option) {
      case '15min': return '15 minutes ago';
      case '1hour': return '1 hour ago';
      case '4hours': return '4 hours ago';
      case 'today': return 'midnight today';
      case 'yesterday': return 'midnight yesterday';
      default: return '15 minutes ago';
    }
  };

  const handleLookBack = async () => {
    try {
      const sinceDate = getLookBackDate(lookBackOption);

      const response = await fetch(`${apiUrl}/api/jobs/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'process-inbox',
          data: {
            folderName: 'INBOX',
            since: sinceDate.toISOString(),
            fanOut: true
          },
          priority: 'high'
        })
      });

      if (response.ok) {
        success('Look back processing queued for all monitored accounts');
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to queue look back');
      }
    } catch (err) {
      error('Failed to queue look back processing');
      console.error('Error:', err);
    }
  };

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
        </div>

        {/* Analytics Section - 2 Column Layout */}
        <div className="mb-8 space-y-6">
          {/* Chart and Account Summary - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actions Summary Chart - 50% width */}
            <ActionsSummaryChart />

            {/* Account Summary - 50% width */}
            <Card>
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
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

                {/* Look Back Processing */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    Look Back
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={lookBackOption} onValueChange={setLookBackOption}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select time range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15min">15 Minutes</SelectItem>
                        <SelectItem value="1hour">1 Hour</SelectItem>
                        <SelectItem value="4hours">4 Hours</SelectItem>
                        <SelectItem value="today">All of Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday and Today</SelectItem>
                      </SelectContent>
                    </Select>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                          Look Back
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Process Historical Emails?</AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-2">
                              <div>
                                This will process all emails from <strong>{getLookBackLabel(lookBackOption)}</strong> to
                                present for all monitored accounts.
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Already processed emails will be skipped automatically.
                              </div>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleLookBack} className="bg-indigo-600 hover:bg-indigo-700">
                            Process Emails
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Actions Table - Full Width */}
          <RecentActionsTable />
        </div>
      </div>
    </div>
  )
}