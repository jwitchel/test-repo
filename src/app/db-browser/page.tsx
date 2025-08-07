'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, Terminal, ExternalLink } from 'lucide-react'

export default function DbBrowserPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Database Browser</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            Explore and manage the PostgreSQL database
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>PostgreSQL Connection</CardTitle>
              <CardDescription>Access the database through various tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Connection Details:</p>
                <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                  <p>Host: localhost</p>
                  <p>Port: 5434</p>
                  <p>Database: aiemaildb</p>
                  <p>Username: aiemailuser</p>
                  <p>Password: aiemailpass</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="mb-4">
                  <Button asChild className="w-full" size="lg">
                    <a href="http://localhost:8889" target="_blank" rel="noopener noreferrer">
                      Open pgAdmin
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Using psql CLI:</h3>
                  <div className="bg-zinc-900 text-zinc-100 p-3 rounded-md font-mono text-xs overflow-x-auto">
                    docker exec -it test-repo-postgres-1 psql -U aiemailuser -d aiemaildb
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Main Tables:</h3>
                  <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1 ml-2">
                    <li><code className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 rounded">user</code> - User accounts</li>
                    <li><code className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 rounded">session</code> - Auth sessions</li>
                    <li><code className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 rounded">email_accounts</code> - Connected email accounts</li>
                    <li><code className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 rounded">llm_providers</code> - AI provider configurations</li>
                    <li><code className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 rounded">tone_preferences</code> - Writing style profiles</li>
                    <li><code className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 rounded">user_relationships</code> - Contact categories</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GUI Tools</CardTitle>
              <CardDescription>Recommended database management tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-zinc-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium">TablePlus</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Modern database GUI with support for PostgreSQL
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-zinc-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium">DBeaver</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Free, open-source universal database tool
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Terminal className="h-5 w-5 text-zinc-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium">pgAdmin</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Official PostgreSQL administration tool
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}