'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface WritingPatterns {
  sentencePatterns: {
    avgLength: number
    range: { min: number; max: number }
    complexity: string
    distribution?: {
      short: number
      medium: number
      long: number
    }
    examples?: string[]
  }
  paragraphPatterns: Array<{
    type?: string
    structure?: string
    percentage: number
    description?: string
  }>
  openingPatterns: Array<{
    pattern?: string
    text?: string
    percentage: number  // Now normalized 0-1, displayed as %
    frequency?: number  // Legacy field for backward compatibility
  }>
  valediction: Array<{
    phrase: string
    percentage: number
  }>
  typedName: Array<{
    style?: string
    phrase?: string
    percentage: number
  }>
  negativePatterns: Array<{
    expression?: string
    description?: string
    alternatives?: string[]
    confidence?: number
    context?: string
  }>
  responsePatterns?: {
    immediate: number
    contemplative: number
    questionHandling: string
  }
  uniqueExpressions: Array<{
    phrase: string
    context: string
    frequency?: number  // Legacy field
    occurrenceRate?: number  // New field name
  }>
}

interface ToneProfile extends Partial<WritingPatterns> {
  meta?: {
    modelUsed?: string
    corpusSize?: number
    [key: string]: unknown
  }
  emails_analyzed: number
  last_updated: string
  preference_type: string
}

interface ToneData {
  profiles: Record<string, ToneProfile>
  totalEmailsAnalyzed: number
  lastUpdated: string | null
}

export default function TonePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [toneData, setToneData] = useState<ToneData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState<string>('aggregate')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchToneData()
    }
  }, [user])

  const fetchToneData = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3002/api/tone-profile', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tone profile')
      }

      const data = await response.json()
      setToneData(data)
      
      // Select aggregate by default, or first available relationship
      if (data.profiles.aggregate) {
        setSelectedRelationship('aggregate')
      } else {
        const firstKey = Object.keys(data.profiles)[0]
        if (firstKey) {
          setSelectedRelationship(firstKey)
        }
      }
    } catch (error) {
      console.error('Error fetching tone data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchToneData()
    setRefreshing(false)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!toneData || Object.keys(toneData.profiles).length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>No Tone Profile Found</CardTitle>
              <CardDescription>
                You haven&apos;t analyzed any emails yet. Go to the inspector to load and analyze your emails.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/inspector">
                <Button>Go to Inspector</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const currentProfile = toneData.profiles[selectedRelationship]
  
  // The API now returns a consistent structure with pattern fields at the root level
  const patterns: WritingPatterns | undefined = currentProfile as WritingPatterns

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Your Writing Tone Analysis
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
              Based on {toneData.totalEmailsAnalyzed} analyzed emails
            </p>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>
        {/* Relationship Tabs */}
        <Tabs value={selectedRelationship} onValueChange={setSelectedRelationship} className="space-y-6">
          <TabsList className="grid w-full grid-cols-auto gap-2" style={{ gridTemplateColumns: `repeat(${Object.keys(toneData.profiles).length}, minmax(0, 1fr))` }}>
            {Object.entries(toneData.profiles).map(([key, profile]) => (
              <TabsTrigger key={key} value={key} className="capitalize">
                {key === 'aggregate' ? 'Overall' : key}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {profile.emails_analyzed}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedRelationship} className="space-y-6">
            {/* Sentence Patterns */}
            <Card>
              <CardHeader>
                <CardTitle>Sentence Structure</CardTitle>
                <CardDescription>How you construct your sentences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Average Length</p>
                    <p className="text-2xl font-bold">{patterns?.sentencePatterns?.avgLength?.toFixed(1) || 0} words</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Range</p>
                    <p className="text-lg">
                      {patterns?.sentencePatterns?.range?.min || 0} - {patterns?.sentencePatterns?.range?.max || 0} words
                    </p>
                  </div>
                  {patterns?.sentencePatterns?.complexity && (
                    <div>
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Complexity</p>
                      <Badge variant="outline" className="mt-1">
                        {patterns.sentencePatterns.complexity}
                      </Badge>
                    </div>
                  )}
                </div>
                
                {patterns?.sentencePatterns?.distribution && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Length Distribution</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Short sentences</span>
                        <div className="flex items-center gap-2">
                          <Progress value={patterns.sentencePatterns.distribution.short * 100} className="w-24 h-2" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                            {Math.round(patterns.sentencePatterns.distribution.short * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Medium sentences</span>
                        <div className="flex items-center gap-2">
                          <Progress value={patterns.sentencePatterns.distribution.medium * 100} className="w-24 h-2" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                            {Math.round(patterns.sentencePatterns.distribution.medium * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Long sentences</span>
                        <div className="flex items-center gap-2">
                          <Progress value={patterns.sentencePatterns.distribution.long * 100} className="w-24 h-2" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                            {Math.round(patterns.sentencePatterns.distribution.long * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {patterns?.sentencePatterns?.examples && patterns.sentencePatterns.examples.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Example Sentences</p>
                    <div className="space-y-2">
                      {patterns.sentencePatterns.examples.slice(0, 3).map((example, idx) => (
                        <p key={idx} className="text-sm italic text-zinc-600 dark:text-zinc-400 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                          &quot;{example}&quot;
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Opening Patterns */}
            <Card>
              <CardHeader>
                <CardTitle>Email Openings</CardTitle>
                <CardDescription>How you start your emails</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {patterns?.openingPatterns && patterns.openingPatterns.length > 0 ? (
                    patterns.openingPatterns.map((pattern, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{pattern.text || pattern.pattern || 'Unknown'}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={(pattern.percentage || pattern.frequency || 0) * 100} className="w-24 h-2" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                            {Math.round((pattern.percentage || pattern.frequency || 0) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">No opening patterns found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Paragraph Patterns */}
            {patterns?.paragraphPatterns && patterns.paragraphPatterns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Paragraph Structure</CardTitle>
                  <CardDescription>How you organize your email content</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {patterns.paragraphPatterns.map((pattern, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="text-sm font-medium">{pattern.type || pattern.structure || 'Unknown'}</span>
                          {pattern.description && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{pattern.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={pattern.percentage > 1 ? pattern.percentage : (pattern.percentage || 0) * 100} className="w-24 h-2" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                            {pattern.percentage > 1 ? pattern.percentage : Math.round((pattern.percentage || 0) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Response Patterns */}
            {patterns?.responsePatterns && (
              <Card>
                <CardHeader>
                  <CardTitle>Response Style</CardTitle>
                  <CardDescription>How you typically respond to emails</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Immediate responses</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={(patterns.responsePatterns.immediate || 0) * 100} className="flex-1 h-2" />
                          <span className="text-sm font-medium">{Math.round((patterns.responsePatterns.immediate || 0) * 100)}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Contemplative responses</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={(patterns.responsePatterns.contemplative || 0) * 100} className="flex-1 h-2" />
                          <span className="text-sm font-medium">{Math.round((patterns.responsePatterns.contemplative || 0) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    {patterns.responsePatterns.questionHandling && (
                      <div>
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Question handling style</p>
                        <p className="text-sm mt-1">{patterns.responsePatterns.questionHandling}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Closing Patterns */}
            <div className="grid grid-cols-2 gap-6">
              {/* Valedictions */}
              <Card>
                <CardHeader>
                  <CardTitle>Valedictions</CardTitle>
                  <CardDescription>How you sign off</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {patterns?.valediction && patterns.valediction.length > 0 ? (
                      patterns.valediction.map((pattern, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{pattern.phrase}</span>
                          <div className="flex items-center gap-2">
                            <Progress value={pattern.percentage > 1 ? pattern.percentage : pattern.percentage * 100} className="w-20 h-2" />
                            <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                              {pattern.percentage > 1 ? pattern.percentage : Math.round(pattern.percentage * 100)}%
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">No valediction patterns found</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Typed Names */}
              <Card>
                <CardHeader>
                  <CardTitle>Name Signatures</CardTitle>
                  <CardDescription>How you type your name</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {patterns?.typedName && patterns.typedName.length > 0 ? (
                      patterns.typedName.map((pattern, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{pattern.style || pattern.phrase || 'Unknown'}</span>
                          <div className="flex items-center gap-2">
                            <Progress value={pattern.percentage > 1 ? pattern.percentage : pattern.percentage * 100} className="w-20 h-2" />
                            <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                              {pattern.percentage > 1 ? pattern.percentage : Math.round(pattern.percentage * 100)}%
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">No name signature patterns found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Unique Expressions */}
            <Card>
              <CardHeader>
                <CardTitle>Unique Expressions</CardTitle>
                <CardDescription>Phrases that are distinctively yours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {patterns?.uniqueExpressions && patterns.uniqueExpressions.length > 0 ? (
                    patterns.uniqueExpressions.slice(0, 10).map((expr, idx) => (
                      <div key={idx} className="border-b border-zinc-100 dark:border-zinc-800 pb-3 last:border-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{expr.phrase}</p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{expr.context}</p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {Math.round((expr.occurrenceRate || expr.frequency || 0) * 100)}%
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">No unique expressions found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Things to Avoid */}
            {patterns?.negativePatterns && patterns.negativePatterns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Expressions to Avoid</CardTitle>
                  <CardDescription>Phrases you typically don&apos;t use</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {patterns.negativePatterns.map((pattern, idx) => (
                      <div key={idx} className="border-b border-zinc-100 dark:border-zinc-800 pb-3 last:border-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                              Avoid: &quot;{pattern.expression || pattern.description || 'Unknown'}&quot;
                            </p>
                            {pattern.alternatives && pattern.alternatives.length > 0 && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                Try instead: {pattern.alternatives.join(', ')}
                              </p>
                            )}
                            {pattern.context && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                Context: {pattern.context}
                              </p>
                            )}
                          </div>
                          {pattern.confidence && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {Math.round(pattern.confidence * 100)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-600 dark:text-zinc-400">Emails Analyzed</p>
                    <p className="font-medium">{currentProfile.emails_analyzed}</p>
                  </div>
                  <div>
                    <p className="text-zinc-600 dark:text-zinc-400">Last Updated</p>
                    <p className="font-medium">
                      {new Date(currentProfile.last_updated).toLocaleDateString()}
                    </p>
                  </div>
                  {(typeof currentProfile.meta?.modelUsed === 'string') && (
                    <div>
                      <p className="text-zinc-600 dark:text-zinc-400">AI Model</p>
                      <p className="font-medium">{currentProfile.meta.modelUsed}</p>
                    </div>
                  )}
                  {(typeof currentProfile.meta?.corpusSize === 'number') && (
                    <div>
                      <p className="text-zinc-600 dark:text-zinc-400">Sample Size</p>
                      <p className="font-medium">{currentProfile.meta.corpusSize} emails</p>
                    </div>
                  )}
                  {(typeof currentProfile.meta?.confidence === 'number') && (
                    <div>
                      <p className="text-zinc-600 dark:text-zinc-400">Confidence Level</p>
                      <p className="font-medium">{Math.round(currentProfile.meta.confidence * 100)}%</p>
                    </div>
                  )}
                  {(typeof currentProfile.meta?.lastAnalyzed === 'string') && (
                    <div>
                      <p className="text-zinc-600 dark:text-zinc-400">Analysis Date</p>
                      <p className="font-medium">
                        {new Date(currentProfile.meta.lastAnalyzed).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {(typeof currentProfile.meta?.emailCount === 'number') && (
                    <div>
                      <p className="text-zinc-600 dark:text-zinc-400">Email Count (Meta)</p>
                      <p className="font-medium">{currentProfile.meta.emailCount}</p>
                    </div>
                  )}
                  {currentProfile.preference_type && (
                    <div>
                      <p className="text-zinc-600 dark:text-zinc-400">Preference Type</p>
                      <p className="font-medium capitalize">{currentProfile.preference_type}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}