"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { ImapLogViewer } from '../../../components/imap-log-viewer'
import { MockImapControls } from '../../../components/mock-imap-controls'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon, Mail, Shield, Zap } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/hooks/use-toast'

interface EmailAccount {
  id: string
  email: string
  provider: string
}

// Demo account ID for testing without real email accounts
const DEMO_ACCOUNT_ID = 'demo-account-001'

export default function ImapLogsDemoPage() {
  const { } = useAuth()
  const { } = useToast()
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>(DEMO_ACCOUNT_ID)
  const [, setIsLoading] = useState(true)

  // Fetch user's email accounts on mount
  useEffect(() => {
    let mounted = true;
    
    const loadAccounts = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/email-accounts', {
          credentials: 'include'
        })
        
        if (!mounted) return;
        
        if (response.ok) {
          const accounts = await response.json()
          setEmailAccounts(accounts)
          
          // If user has accounts, select the first one
          if (accounts.length > 0) {
            setSelectedAccountId(accounts[0].id)
          }
        } else if (response.status !== 404) {
          console.error('Failed to fetch email accounts')
        }
      } catch (err) {
        console.error('Error fetching email accounts:', err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    
    loadAccounts()
    
    return () => {
      mounted = false;
    }
  }, []) // Empty dependency array - only run once on mount


  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="container mx-auto py-8 px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              IMAP Logging System Demo
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
              Test and monitor IMAP operations with real-time logging
            </p>
          </div>

          {/* Account Selection */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Account Selection
              </CardTitle>
              <CardDescription>
                Select an email account to monitor or use the demo account for testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="account-select">Active Account</Label>
                <Select value={selectedAccountId} onValueChange={handleAccountChange}>
                  <SelectTrigger id="account-select">
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEMO_ACCOUNT_ID}>
                      Demo Account (No real email connection)
                    </SelectItem>
                    {emailAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.email} ({account.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedAccountId === DEMO_ACCOUNT_ID && (
                <Alert className="mt-4">
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription>
                    Using demo account - perfect for testing without real email connections
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span className="text-indigo-600 dark:text-indigo-400">1.</span>
                    Real-time Logging
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    The log viewer connects via WebSocket to receive IMAP operations in real-time
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span className="text-indigo-600 dark:text-indigo-400">2.</span>
                    Mock Operations
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Use the controls to simulate various IMAP commands and scenarios
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span className="text-indigo-600 dark:text-indigo-400">3.</span>
                    Debug & Monitor
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    View commands, responses, and timing data to debug email integration
                  </p>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Note:</strong> All logs are scoped to your user account. 
                  Other users cannot see your IMAP operations.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Mock Controls - Above logs */}
          <div className="mb-8">
            <MockImapControls emailAccountId={selectedAccountId} />
          </div>

          {/* Log Viewer - Full Width */}
          <div>
            <ImapLogViewer 
              emailAccountId={selectedAccountId} 
              className="h-[700px]"
            />
          </div>

          {/* Testing Tips */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Testing Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                  <span>
                    Start with <strong>&quot;Basic Connection&quot;</strong> to see a simple IMAP connect/disconnect flow
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                  <span>
                    Try <strong>&quot;Start Continuous&quot;</strong> to see ongoing IMAP operations every 2 seconds
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                  <span>
                    Use <strong>&quot;Error Scenarios&quot;</strong> to test error handling and recovery
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                  <span>
                    Enable <strong>Auto-scroll</strong> to automatically follow new log entries
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}