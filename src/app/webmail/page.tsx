'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, Mail } from 'lucide-react'

export default function WebmailPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Webmail Client</CardTitle>
            <CardDescription>Access the Roundcube webmail interface</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <Mail className="h-16 w-16 text-indigo-600 dark:text-indigo-400" />
            </div>
            
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Test Account Credentials:</p>
              <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <p>Username: user1</p>
                <p>Password: testpass123</p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Click below to open the Roundcube webmail client:
              </p>
              <Button asChild size="lg">
                <a href="http://localhost:8888" target="_blank" rel="noopener noreferrer">
                  Open Webmail
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}