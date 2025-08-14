'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

export default function QdrantPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Qdrant Vector Database</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            View and manage your email embeddings in the vector database
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Qdrant Dashboard</CardTitle>
            <CardDescription>Access the Qdrant web interface to explore your vector data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Connection Details:</p>
              <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <p>URL: http://localhost:6333</p>
                <p>Collection: user-emails</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                The Qdrant dashboard provides a visual interface to:
              </p>
              <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1 ml-2">
                <li>Browse stored email embeddings</li>
                <li>Search vectors by similarity</li>
                <li>View metadata and relationships</li>
                <li>Monitor database performance</li>
              </ul>
            </div>

            <Button asChild className="w-full">
              <a href="http://localhost:6333/dashboard" target="_blank" rel="noopener noreferrer">
                Open Qdrant Dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}