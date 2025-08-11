"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { ImapLogViewer } from '@/components/imap-log-viewer'
import { TrainingPanel } from '@/components/training-panel'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Send, Loader2, Zap } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { decodeHtmlEntitiesSafe } from '@/lib/html-entities'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResizableSplit } from '@/components/ui/resizable-split'


interface LLMProvider {
  id: string
  provider_name: string
  provider_type: string
  model_name: string
  is_active: boolean
  is_default: boolean
}

// Demo account ID for testing without real email accounts
const DEMO_ACCOUNT_ID = 'demo-account-001'

export default function ImapLogsDemoPage() {
  const { user } = useAuth()
  const { success, error: showError } = useToast()
  const [] = useState<string>(DEMO_ACCOUNT_ID)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  
  // LLM Provider state
  const [llmProviders, setLlmProviders] = useState<LLMProvider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [liveAiResponses, setLiveAiResponses] = useState(false)
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [generatedReply, setGeneratedReply] = useState<string>('')
  
  // Email input state
  const [emailBody, setEmailBody] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [relationshipType, setRelationshipType] = useState('auto-detect')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Relationship types state
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([])
  
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
  const [editedPrompt, setEditedPrompt] = useState<string>('')
  const [activeTab, setActiveTab] = useState('email-input')

  // Fetch LLM providers and relationship types on mount
  useEffect(() => {
    let mounted = true;
    
    const loadProviders = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/llm-providers', {
          credentials: 'include'
        })
        
        if (!mounted) return;
        
        if (response.ok) {
          const providers = await response.json()
          setLlmProviders(providers)
          
          // Select default provider or first active one
          const defaultProvider = providers.find((p: LLMProvider) => p.is_default && p.is_active)
          const firstActive = providers.find((p: LLMProvider) => p.is_active)
          if (defaultProvider) {
            setSelectedProviderId(defaultProvider.id)
          } else if (firstActive) {
            setSelectedProviderId(firstActive.id)
          }
        }
      } catch (err) {
        console.error('Error fetching LLM providers:', err)
      }
    }
    
    const loadRelationshipTypes = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/relationships/types', {
          credentials: 'include'
        })
        
        if (!mounted) return;
        
        if (response.ok) {
          const types = await response.json()
          setRelationshipTypes(types)
        }
      } catch (err) {
        console.error('Error fetching relationship types:', err)
      }
    }
    
    loadProviders()
    loadRelationshipTypes()
    
    return () => {
      mounted = false;
    }
  }, []) // Empty dependency array - only run once on mount

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
    setGeneratedReply('') // Clear previous reply
    
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
          relationshipType,
          providerId: selectedProviderId
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
      setEditedPrompt(decodeHtmlEntitiesSafe(results.llmPrompt))
      
      // Switch to prompt tab after analysis
      setActiveTab('prompt')
      
      success('Email analyzed successfully!')
      
      // If live AI responses is enabled and we have a provider, generate reply automatically
      if (liveAiResponses && selectedProviderId && results.llmPrompt) {
        await handleGenerateReply(results)
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to analyze email')
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  const handleGenerateReply = async (results?: AnalysisResults) => {
    const analysisData = results || analysisResults
    
    if (!analysisData?.llmPrompt) {
      showError('Please analyze the email first')
      return
    }
    
    if (!selectedProviderId) {
      showError('Please select an LLM provider')
      return
    }
    
    setIsGeneratingReply(true)
    setGeneratedReply('')
    
    try {
      const response = await fetch('http://localhost:3002/api/generate/email-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          llm_prompt: editedPrompt || decodeHtmlEntitiesSafe(analysisData.llmPrompt),
          nlp_features: analysisData.nlpFeatures,
          relationship: analysisData.relationship,
          enhanced_profile: analysisData.enhancedProfile,
          provider_id: selectedProviderId
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Generation failed')
      }
      
      const data = await response.json()
      setGeneratedReply(decodeHtmlEntitiesSafe(data.reply))
      
      // Switch to LLM Response tab
      setActiveTab('llm-response')
      
      success('Reply generated successfully!')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to generate reply')
    } finally {
      setIsGeneratingReply(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-900 flex flex-col overflow-hidden">
        {/* Header with LLM Selection */}
        <div className="h-16 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Inspector</h1>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="header-llm-select" className="text-sm">LLM:</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger id="header-llm-select" className="w-[200px]">
                  <SelectValue placeholder="Select LLM provider" />
                </SelectTrigger>
                <SelectContent>
                  {llmProviders.filter(p => p.is_active).length === 0 ? (
                    <div className="py-2 px-3 text-sm text-muted-foreground">
                      No active providers
                    </div>
                  ) : (
                    llmProviders.filter(p => p.is_active).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.provider_name}
                        {provider.is_default && ' (default)'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="live-ai"
                className="rounded border-gray-300"
                checked={liveAiResponses}
                onChange={(e) => setLiveAiResponses(e.target.checked)}
              />
              <Label htmlFor="live-ai" className="text-sm cursor-pointer">
                Live AI Responses
              </Label>
            </div>
          </div>
        </div>

        {/* Main Content Area with Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Collapsible Sidebar */}
          <div className={cn(
            "bg-zinc-100 dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 transition-all duration-300",
            isSidebarCollapsed ? "w-12" : "w-96"
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
                    <span className="text-sm">Training Panel</span>
                  </>
                )}
              </Button>
            </div>
            {!isSidebarCollapsed && (
              <div className="p-2 overflow-y-auto flex flex-col gap-2">
                <TrainingPanel 
                  emailAccountId={DEMO_ACCOUNT_ID}
                  userId={user?.id || ''}
                />
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ResizableSplit
              defaultTopHeight={70}
              minTopHeight={200}
              minBottomHeight={100}
              className="flex-1"
              topContent={
                /* Full width Analysis Pipeline */
                <div className="h-full p-2 overflow-hidden">
                  <Card className="h-full flex flex-col overflow-hidden">
                    <CardContent className="flex-1 overflow-hidden px-4 py-2">
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-3 h-8">
                          <TabsTrigger value="email-input" className="text-xs">Email Input</TabsTrigger>
                          <TabsTrigger value="prompt" className="text-xs">Prompt</TabsTrigger>
                          <TabsTrigger value="llm-response" className="text-xs">LLM Response</TabsTrigger>
                        </TabsList>
                    
                    <div className="flex-1 mt-1 min-h-0">
                      {/* Email Input Tab */}
                      <TabsContent value="email-input" className="h-full overflow-auto">
                        <div className="flex flex-col gap-2 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Recipient Email</Label>
                              <Input
                                type="email"
                                placeholder="recipient@example.com"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                className="h-7 text-sm mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Relationship Type</Label>
                              <Select value={relationshipType} onValueChange={setRelationshipType}>
                                <SelectTrigger className="h-7 text-sm mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto-detect">Auto-detect</SelectItem>
                                  {relationshipTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="flex-1">
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
                              className="text-sm resize-none h-[180px]"
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
                        </div>
                      </TabsContent>
                      
                      {/* LLM Prompt Tab */}
                      <TabsContent value="prompt" className="h-full flex flex-col p-3">
                        {analysisResults?.llmPrompt ? (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold">Generated Prompt</h4>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(editedPrompt)
                                    success('Prompt copied to clipboard')
                                  }}
                                >
                                  Copy
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setEditedPrompt(decodeHtmlEntitiesSafe(analysisResults.llmPrompt))
                                    success('Prompt reset to original')
                                  }}
                                  disabled={editedPrompt === decodeHtmlEntitiesSafe(analysisResults.llmPrompt)}
                                >
                                  Reset
                                </Button>
                                <Button
                                  onClick={() => handleGenerateReply()}
                                  disabled={isGeneratingReply || !selectedProviderId}
                                  variant="default"
                                  size="sm"
                                  title={!selectedProviderId ? "Select an LLM provider first" : "Generate AI reply"}
                                >
                                  {isGeneratingReply ? (
                                    <>
                                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="mr-2 h-3 w-3" />
                                      Generate Reply
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="flex-1 min-h-0">
                              <textarea
                                className="w-full h-full text-xs bg-zinc-50 dark:bg-zinc-800 p-3 rounded-md whitespace-pre-wrap font-mono resize-none border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 overflow-auto"
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                placeholder="Edit the prompt here..."
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500">
                            <p>Analyze an email to see the LLM prompt</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      {/* LLM Response Tab */}
                      <TabsContent value="llm-response" className="h-full flex flex-col p-3">
                        {generatedReply ? (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold">Generated Email Reply</h4>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedReply)
                                  success('Reply copied to clipboard!')
                                }}
                              >
                                Copy
                              </Button>
                            </div>
                            <div className="flex-1 min-h-0">
                              <textarea
                                className="w-full h-full text-sm bg-zinc-50 dark:bg-zinc-800 p-3 rounded-md whitespace-pre-wrap resize-none border-0 focus:outline-none overflow-auto"
                                value={generatedReply}
                                readOnly
                              />
                            </div>
                            
                            <div className="mt-2 space-y-2">
                              {selectedProviderId && (
                                <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded text-xs">
                                  <span className="text-zinc-600">Provider: </span>
                                  <span>{llmProviders.find(p => p.id === selectedProviderId)?.provider_name}</span>
                                  <span className="text-zinc-600"> | Model: </span>
                                  <span>{llmProviders.find(p => p.id === selectedProviderId)?.model_name}</span>
                                </div>
                              )}
                              
                              <Button
                                onClick={() => handleGenerateReply()}
                                disabled={isGeneratingReply}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                {isGeneratingReply ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Regenerating...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="mr-2 h-3 w-3" />
                                    Regenerate Reply
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                            <p className="mb-4">No reply generated yet</p>
                            {analysisResults ? (
                              <Button
                                onClick={() => handleGenerateReply()}
                                disabled={isGeneratingReply || !selectedProviderId}
                                variant="outline"
                                size="sm"
                              >
                                {!selectedProviderId ? (
                                  'Select an LLM provider first'
                                ) : isGeneratingReply ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="mr-2 h-3 w-3" />
                                    Generate Reply
                                  </>
                                )}
                              </Button>
                            ) : (
                              <p className="text-sm">Analyze an email first</p>
                            )}
                          </div>
                        )}
                      </TabsContent>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          }
          bottomContent={
            /* IMAP Logs Panel - Full Width */
            <div className="h-full p-2 overflow-hidden">
              <ImapLogViewer 
                emailAccountId={DEMO_ACCOUNT_ID} 
                className="h-full"
              />
            </div>
          }
        />
      </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}