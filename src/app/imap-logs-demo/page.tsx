"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { ImapLogViewer } from '@/components/imap-log-viewer'
import { MockImapControls } from '@/components/mock-imap-controls'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MailOpen, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface EmailAccount {
  id: string
  email: string
  provider: string
}

// Demo account ID for testing without real email accounts
const DEMO_ACCOUNT_ID = 'demo-account-001'

// Example emails for quick testing
const EXAMPLE_EMAILS = {
  professional: {
    recipient: 'sarah@company.com',
    subject: 'Q3 Financial Report Review',
    body: `Hi Sarah,

I've reviewed the Q3 financial report you sent over. The revenue growth looks solid, particularly in the enterprise segment.

A few questions:
- Can we get more granular data on the subscription renewals?
- What's driving the increase in operational costs?
- Should we schedule a meeting to discuss the Q4 projections?

Looking forward to your thoughts.

Best regards,
John`
  },
  casual: {
    recipient: 'mike@gmail.com',
    subject: 'Weekend plans',
    body: `Hey Mike!

Hope you're doing well! Are you still up for the hiking trip this weekend? The weather looks perfect and I found this amazing trail near Bear Mountain.

Let me know if Saturday works for you. We could grab breakfast at that diner we like before heading out.

Also, don't forget to bring your camera - the views are supposed to be incredible! 📸

Cheers,
John`
  },
  technical: {
    recipient: 'dev-team@company.com',
    subject: 'API Performance Issues',
    body: `Team,

We're seeing increased latency on the /api/users endpoint during peak hours. Response times are averaging 800ms when they should be under 200ms.

Initial investigation suggests:
1. Database queries aren't using proper indexes
2. No caching layer for frequently accessed data
3. Possible N+1 query problem in the user permissions check

Can we prioritize this for the next sprint? Happy to pair with someone on the optimization.

Thanks,
John`
  },
  personal: {
    recipient: 'lisa@example.com',
    subject: 'Dinner tonight?',
    body: `Hey honey,

Just wanted to check if you're free for dinner tonight? I was thinking we could try that new Italian place downtown that opened last week. I heard their carbonara is amazing!

I can make reservations for 7:30 if that works for you. Let me know! ❤️

Love you,
John`
  }
}

export default function ImapLogsDemoPage() {
  const { } = useAuth()
  const { success, error: showError } = useToast()
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>(DEMO_ACCOUNT_ID)
  const [, setIsLoading] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  // Email input state
  const [emailBody, setEmailBody] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [relationshipType, setRelationshipType] = useState('auto-detect')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Analysis results state
  interface NLPFeatures {
    sentiment: {
      primary: string;
      intensity: number;
      confidence: number;
      score: number;
      magnitude: number;
      emotions?: string[];
      emojis?: string[];
    };
    tonalQualities: {
      formality: number;
      warmth: number;
      enthusiasm: number;
      urgency: number;
      directness: number;
      politeness: number;
    };
    linguisticStyle: {
      vocabularyComplexity: string;
      sentenceStructure: string;
      conversationalMarkers?: string[];
    };
    contextType: string;
    questions?: string[];
    actionItems?: Array<{
      type: string;
      text: string;
    }>;
    relationshipHints: {
      familiarityLevel: string;
      linguisticMarkers: {
        greetingStyle: string;
        closingStyle: string;
        endearments?: string[];
        professionalPhrases?: string[];
        informalLanguage?: string[];
      };
      formalityIndicators: {
        hasTitle: boolean;
        hasLastName: boolean;
        hasCompanyReference: boolean;
        sentenceComplexity: number;
        vocabularySophistication: number;
      };
    };
    stats: {
      wordCount: number;
      sentenceCount: number;
      avgWordsPerSentence: number;
      vocabularyComplexity: number;
      formalityScore: number;
      contractionDensity: number;
    };
    phrases?: Array<{ text: string; frequency: number }>;
    contractions?: Array<{ contraction: string; expanded: string; count: number }>;
    sentenceStarters?: Array<{ text: string; count: number }>;
    closings?: Array<{ text: string; count: number }>;
  }

  interface StyleAggregation {
    greetings: Array<{ text: string; frequency: number; percentage: number }>;
    closings: Array<{ text: string; frequency: number; percentage: number }>;
    emojis: Array<{ emoji: string; frequency: number; contexts: string[] }>;
    contractions: { uses: boolean; frequency: number; examples: string[] };
    sentimentProfile: { 
      primaryTone: string; 
      averageWarmth: number; 
      averageFormality: number; 
    };
    vocabularyProfile: {
      complexityLevel: string;
      technicalTerms: string[];
      commonPhrases: Array<{ phrase: string; frequency: number }>;
    };
    structuralPatterns: {
      averageEmailLength: number;
      averageSentenceLength: number;
      paragraphingStyle: string;
    };
    emailCount: number;
    confidenceScore: number;
    lastUpdated?: string;
  }

  interface EnhancedProfile {
    typicalFormality: string;
    commonGreetings: string[];
    commonClosings: string[];
    useEmojis: boolean;
    useHumor: boolean;
    personName?: string;
    relationshipType?: string;
    aggregatedStyle?: StyleAggregation;
  }

  interface AnalysisResults {
    nlpFeatures: NLPFeatures;
    relationship: {
      type: string;
      confidence: number;
      method: string;
    };
    person: {
      name: string;
      email: string;
      emailCount: number;
    } | null;
    styleAggregation: StyleAggregation | null;
    selectedExamples: Array<{
      text: string;
      relationship: string;
      score: number;
      id: string;
    }>;
    llmPrompt: string;
    enhancedProfile: EnhancedProfile | null;
  }
  
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null)
  const [activeTab, setActiveTab] = useState('nlp')

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

  const handleLoadExample = (exampleKey: keyof typeof EXAMPLE_EMAILS) => {
    const example = EXAMPLE_EMAILS[exampleKey]
    setEmailBody(example.body)
    setRecipientEmail(example.recipient)
    success(`Loaded ${exampleKey} example`)
  }

  const handleAnalyzeEmail = async () => {
    if (!emailBody.trim()) {
      showError('Please enter an email to analyze')
      return
    }
    
    if (!recipientEmail.trim()) {
      showError('Please enter a recipient email')
      return
    }

    setIsAnalyzing(true)
    setAnalysisResults(null) // Clear previous results
    
    try {
      const response = await fetch('http://localhost:3002/api/analyze/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emailBody,
          recipientEmail,
          relationshipType
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Analysis failed')
      }

      const results = await response.json()
      console.log('Analysis results:', results)
      console.log('Selected examples:', results.selectedExamples)
      setAnalysisResults(results)
      
      // Switch to NLP tab to show results
      setActiveTab('nlp')
      
      success('Email analyzed successfully!')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to analyze email')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col overflow-hidden">
        {/* Compact Header Bar */}
        <div className="h-16 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MailOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Email AI Pipeline Demo
            </h1>
          </div>
          
          {/* Account Selection in Header */}
          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="header-account-select" className="text-sm">Account:</Label>
            <Select value={selectedAccountId} onValueChange={handleAccountChange}>
              <SelectTrigger id="header-account-select" className="w-[250px]">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEMO_ACCOUNT_ID}>
                  Demo Account
                </SelectItem>
                {emailAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.email} ({account.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content Area with Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Collapsible Sidebar */}
          <div className={cn(
            "bg-zinc-100 dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 transition-all duration-300",
            isSidebarCollapsed ? "w-12" : "w-64"
          )}>
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="w-full justify-start"
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    <span className="text-sm">Mock IMAP</span>
                  </>
                )}
              </Button>
            </div>
            {!isSidebarCollapsed && (
              <div className="p-2 overflow-y-auto">
                <MockImapControls emailAccountId={selectedAccountId} />
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Two Column Layout */}
            <div className="h-[500px] flex gap-2 p-2">
              {/* Email Input Column */}
              <div className="w-1/2 flex flex-col">
                <Card className="flex-1 flex flex-col">
                <CardHeader className="py-1 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Email Input</CardTitle>
                    <Select onValueChange={(value) => handleLoadExample(value as keyof typeof EXAMPLE_EMAILS)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Load example" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 py-1 px-4 flex flex-col gap-1 overflow-y-auto">
                  <div className="space-y-1">
                    <div>
                      <Label className="text-xs">Recipient Email</Label>
                      <Input
                        type="email"
                        placeholder="recipient@example.com"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="h-7 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Relationship Type</Label>
                      <Select value={relationshipType} onValueChange={setRelationshipType}>
                        <SelectTrigger className="h-7 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto-detect">Auto-detect</SelectItem>
                          <SelectItem value="colleague">Colleague</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="family">Family</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="spouse">Spouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Email Body</Label>
                      <span className="text-xs text-zinc-500">
                        {emailBody.split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                    <Textarea
                      placeholder="Paste or type your email here..."
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="text-sm resize-none overflow-auto"
                      rows={10}
                      style={{ maxHeight: '14rem' }}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleAnalyzeEmail}
                    disabled={isAnalyzing || !emailBody.trim() || !recipientEmail.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {isAnalyzing ? (
                      <>
                        <Send className="mr-2 h-3 w-3 animate-pulse" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-3 w-3" />
                        Analyze Email
                      </>
                    )}
                  </Button>
                </CardContent>
                </Card>
              </div>

              {/* Analysis Pipeline Column */}
              <div className="w-1/2 flex flex-col">
                <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="py-1 px-4">
                  <CardTitle className="text-base">Analysis Pipeline Results</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden px-4 py-1">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-5 h-8">
                      <TabsTrigger value="nlp" className="text-xs">NLP</TabsTrigger>
                      <TabsTrigger value="relationship" className="text-xs">Relationship</TabsTrigger>
                      <TabsTrigger value="style" className="text-xs">Style</TabsTrigger>
                      <TabsTrigger value="examples" className="text-xs">Examples</TabsTrigger>
                      <TabsTrigger value="prompt" className="text-xs">Prompt</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-auto mt-1">
                      {/* NLP Features Tab */}
                      <TabsContent value="nlp" className="h-full">
                        {analysisResults?.nlpFeatures ? (
                          <div className="space-y-4">
                            {/* Sentiment Analysis */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Sentiment Analysis</h4>
                              <div className="flex items-center gap-4">
                                <Badge variant={analysisResults.nlpFeatures.sentiment?.primary === 'positive' ? 'default' : 'secondary'}>
                                  {analysisResults.nlpFeatures.sentiment?.primary || 'neutral'}
                                </Badge>
                                <span className="text-sm text-zinc-600">
                                  Score: {analysisResults.nlpFeatures.sentiment?.score?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Tone Qualities */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Tone Qualities</h4>
                              <div className="space-y-2">
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Warmth</span>
                                    <span>{Math.round((analysisResults.nlpFeatures.tonalQualities?.warmth || 0) * 100)}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-indigo-500 transition-all duration-300"
                                      style={{ width: `${(analysisResults.nlpFeatures.tonalQualities?.warmth || 0) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Formality</span>
                                    <span>{Math.round((analysisResults.nlpFeatures.tonalQualities?.formality || 0) * 100)}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-indigo-500 transition-all duration-300"
                                      style={{ width: `${(analysisResults.nlpFeatures.tonalQualities?.formality || 0) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Enthusiasm</span>
                                    <span>{Math.round((analysisResults.nlpFeatures.tonalQualities?.enthusiasm || 0) * 100)}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-indigo-500 transition-all duration-300"
                                      style={{ width: `${(analysisResults.nlpFeatures.tonalQualities?.enthusiasm || 0) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Emotions */}
                            {analysisResults.nlpFeatures.sentiment?.emotions && analysisResults.nlpFeatures.sentiment.emotions.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Detected Emotions</h4>
                                <div className="flex flex-wrap gap-2">
                                  {analysisResults.nlpFeatures.sentiment.emotions.map((emotion, i) => (
                                    <Badge key={i} variant="outline">
                                      {emotion}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Statistics */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Writing Statistics</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>Words: {analysisResults.nlpFeatures.stats?.wordCount || 0}</div>
                                <div>Sentences: {analysisResults.nlpFeatures.stats?.sentenceCount || 0}</div>
                                <div>Avg sentence length: {analysisResults.nlpFeatures.stats?.avgWordsPerSentence?.toFixed(1) || '0'}</div>
                                <div>Questions: {analysisResults.nlpFeatures.questions?.length || 0}</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500">
                            <p>Analyze an email to see NLP features</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      {/* Relationship Analysis Tab */}
                      <TabsContent value="relationship" className="h-full">
                        {analysisResults?.relationship ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Detected Relationship</h4>
                              <div className="flex items-center gap-4">
                                <Badge variant="outline" className="text-base">
                                  {analysisResults.relationship.type}
                                </Badge>
                                <span className="text-sm text-zinc-600">
                                  Confidence: {Math.round((analysisResults.relationship.confidence || 0) * 100)}%
                                </span>
                              </div>
                            </div>
                            
                            {analysisResults.person && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Person Information</h4>
                                <div className="text-sm space-y-1">
                                  <p>Name: {analysisResults.person.name}</p>
                                  <p>Email: {analysisResults.person.email}</p>
                                  <p>Previous interactions: {analysisResults.person.emailCount || 0}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500">
                            <p>Analyze an email to see relationship detection</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      {/* Style Learning Tab */}
                      <TabsContent value="style" className="h-full">
                        {analysisResults?.styleAggregation ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Learned Style Patterns</h4>
                              <p className="text-sm text-zinc-600 mb-2">
                                Based on {analysisResults.styleAggregation.emailCount} emails
                              </p>
                              
                              {analysisResults.styleAggregation.greetings?.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium">Common Greetings:</p>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {analysisResults.styleAggregation.greetings.slice(0, 3).map((g, i) => (
                                      <Badge key={i} variant="secondary">
                                        {g.text} ({g.percentage}%)
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {analysisResults.styleAggregation.emojis?.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-medium">Common Emojis:</p>
                                  <div className="flex gap-2 mt-1">
                                    {analysisResults.styleAggregation.emojis.slice(0, 5).map((e, i) => (
                                      <span key={i} className="text-xl">{e.emoji}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500">
                            <p>Analyze an email to see style patterns</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      {/* Example Selection Tab */}
                      <TabsContent value="examples" className="h-full">
                        {analysisResults?.selectedExamples ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold">Selected Examples ({analysisResults.selectedExamples.length})</h4>
                            {analysisResults.selectedExamples.slice(0, 3).map((ex, i) => (
                              <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                                <div className="flex justify-between items-start mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {ex.relationship}
                                  </Badge>
                                  <span className="text-xs text-zinc-500">
                                    Score: {ex.score?.toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-sm mt-2 line-clamp-3">{ex.text}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500">
                            <p>Analyze an email to see example selection</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      {/* LLM Prompt Tab */}
                      <TabsContent value="prompt" className="h-full">
                        {analysisResults?.llmPrompt ? (
                          <div className="h-full">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold">Generated Prompt</h4>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(analysisResults.llmPrompt)
                                  success('Prompt copied to clipboard')
                                }}
                              >
                                Copy
                              </Button>
                            </div>
                            <div className="h-[calc(100%-40px)] overflow-auto">
                              <pre className="text-xs bg-zinc-50 dark:bg-zinc-800 p-3 rounded-md whitespace-pre-wrap">
                                {analysisResults.llmPrompt}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500">
                            <p>Analyze an email to see the LLM prompt</p>
                          </div>
                        )}
                      </TabsContent>
                    </div>
                  </Tabs>
                </CardContent>
                </Card>
              </div>
            </div>

            {/* IMAP Logs Panel - Full Width */}
            <div className="flex-1 px-2 pb-2 min-h-0">
              <ImapLogViewer 
                emailAccountId={selectedAccountId} 
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}