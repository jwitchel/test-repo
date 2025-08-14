'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { SignaturePatterns } from '@/components/settings/signature-patterns'
import { TypedNameSettings } from '@/components/settings/typed-name-settings'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost } from '@/lib/api'
import { Textarea } from '@/components/ui/textarea'

export default function SettingsPage() {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [name, setName] = useState('')
  const [nicknames, setNicknames] = useState('')
  const [signatureBlock, setSignatureBlock] = useState('')
  const [folderPreferences, setFolderPreferences] = useState({
    rootFolder: 'Prescreen',
    draftsFolder: 'Drafts',
    noActionFolder: 'No Action',
    spamFolder: 'Spam'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingFolders, setIsTestingFolders] = useState(false)
  const [folderTestResult, setFolderTestResult] = useState<{
    requiredFolders?: string[];
    existing?: string[];
    missing?: string[];
  } | null>(null)

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) return
      
      setIsLoading(true)
      try {
        const data = await apiGet<{ preferences: { name?: string; nicknames?: string; signatureBlock?: string; folderPreferences?: {
          rootFolder?: string;
          draftsFolder?: string;
          noActionFolder?: string;
          spamFolder?: string;
        } } }>('/api/settings/profile')
        if (data.preferences) {
          setName(data.preferences.name || user.name || '')
          setNicknames(data.preferences.nicknames || '')
          setSignatureBlock(data.preferences.signatureBlock || '')
          if (data.preferences.folderPreferences) {
            setFolderPreferences(prev => ({
              ...prev,
              ...data.preferences.folderPreferences
            }))
          }
        } else {
          setName(user.name || '')
        }
      } catch (err) {
        console.error('Failed to load preferences:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadPreferences()
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await apiPost('/api/settings/profile', {
        name,
        nicknames,
        signatureBlock,
        folderPreferences
      })
      success('Profile updated successfully')
    } catch (err) {
      error('Failed to update profile')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestFolders = async () => {
    setIsTestingFolders(true)
    setFolderTestResult(null)
    
    try {
      // Get the first email account
      const accounts = await apiGet<{ accounts: Array<{ id: string }> }>('/api/inbox/accounts')
      if (accounts.accounts.length === 0) {
        error('No email accounts configured')
        return
      }
      
      const result = await apiPost<{
        success: boolean;
        requiredFolders: string[];
        existing: string[];
        missing: string[];
      }>('/api/settings/test-folders', {
        emailAccountId: accounts.accounts[0].id
      })
      
      setFolderTestResult(result)
      
      if (result.missing?.length === 0) {
        success('All required folders exist!')
      }
    } catch (err) {
      error('Failed to test folders')
      console.error(err)
    } finally {
      setIsTestingFolders(false)
    }
  }

  const handleCreateFolders = async () => {
    setIsTestingFolders(true)
    
    try {
      // Get the first email account
      const accounts = await apiGet<{ accounts: Array<{ id: string }> }>('/api/inbox/accounts')
      if (accounts.accounts.length === 0) {
        error('No email accounts configured')
        return
      }
      
      const result = await apiPost<{
        success: boolean;
        created: string[];
        failed: Array<{ folder: string; error: string }>;
      }>('/api/settings/create-folders', {
        emailAccountId: accounts.accounts[0].id
      })
      
      if (result.created?.length > 0) {
        success(`Created ${result.created.length} folders successfully!`)
        // Re-test to update the display
        await handleTestFolders()
      }
      
      if (result.failed?.length > 0) {
        error(`Failed to create ${result.failed.length} folders`)
      }
    } catch (err) {
      error('Failed to create folders')
      console.error(err)
    } finally {
      setIsTestingFolders(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nicknames">Nicknames</Label>
                  <Input
                    id="nicknames"
                    type="text"
                    value={nicknames}
                    onChange={(e) => setNicknames(e.target.value)}
                    placeholder="e.g. Jessica, Jess, JW"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter common nicknames or variations of your name, separated by commas
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user?.email || ''}
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                
                <Separator className="my-6" />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Email Signature Detection</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure patterns to automatically detect and remove your email signature when analyzing your writing style.
                  </p>
                </div>
                
                <SignaturePatterns />
                
                <Separator className="my-6" />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Typed Name Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure how your name appears in generated email responses.
                  </p>
                </div>
                
                <TypedNameSettings />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Signature Block</CardTitle>
                <CardDescription>
                  Add a signature that will be included in your generated email replies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signatureBlock">Signature Block</Label>
                  <Textarea
                    id="signatureBlock"
                    value={signatureBlock}
                    onChange={(e) => setSignatureBlock(e.target.value)}
                    placeholder={`---\nCell: 970-759-1403\nReplied on ${new Date().toLocaleDateString()}`}
                    className="min-h-[120px] font-mono text-sm"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    This signature will be added to your email replies before the quoted original message.
                    You can use multiple lines.
                  </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                  {isSaving ? 'Saving...' : 'Save Signature'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Folder Preferences</CardTitle>
                <CardDescription>
                  Configure folders for organizing emails based on AI recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rootFolder">Root Folder</Label>
                  <Input
                    id="rootFolder"
                    value={folderPreferences.rootFolder}
                    onChange={(e) => setFolderPreferences({ ...folderPreferences, rootFolder: e.target.value })}
                    placeholder="Prescreen"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave empty to create folders at the root level
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="draftsFolder">Drafts Folder</Label>
                  <Input
                    id="draftsFolder"
                    value={folderPreferences.draftsFolder}
                    onChange={(e) => setFolderPreferences({ ...folderPreferences, draftsFolder: e.target.value })}
                    placeholder="Drafts"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    For: reply, reply-all, forward actions
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="noActionFolder">No Action Folder</Label>
                  <Input
                    id="noActionFolder"
                    value={folderPreferences.noActionFolder}
                    onChange={(e) => setFolderPreferences({ ...folderPreferences, noActionFolder: e.target.value })}
                    placeholder="No Action"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    For: FYI only, large lists, unsubscribe candidates
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="spamFolder">Spam Folder</Label>
                  <Input
                    id="spamFolder"
                    value={folderPreferences.spamFolder}
                    onChange={(e) => setFolderPreferences({ ...folderPreferences, spamFolder: e.target.value })}
                    placeholder="Spam"
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    For: emails identified as spam
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? 'Saving...' : 'Save Folder Preferences'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleTestFolders}
                    disabled={isTestingFolders || isLoading}
                  >
                    {isTestingFolders ? 'Testing...' : 'Test Folders'}
                  </Button>
                </div>
                
                {folderTestResult && (
                  <div className="mt-4 p-4 bg-muted rounded-md">
                    <h4 className="font-medium mb-2">Folder Test Results</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Required Folders:</span>
                        <ul className="list-disc list-inside mt-1">
                          {folderTestResult.requiredFolders?.map((folder: string) => (
                            <li key={folder}>{folder}</li>
                          ))}
                        </ul>
                      </div>
                      
                      {folderTestResult.missing?.length > 0 && (
                        <div>
                          <span className="font-medium text-orange-600">Missing Folders:</span>
                          <ul className="list-disc list-inside mt-1">
                            {folderTestResult.missing.map((folder: string) => (
                              <li key={folder} className="text-orange-600">{folder}</li>
                            ))}
                          </ul>
                          
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="mt-2"
                            onClick={handleCreateFolders}
                            disabled={isTestingFolders}
                          >
                            Create Missing Folders
                          </Button>
                        </div>
                      )}
                      
                      {folderTestResult.existing?.length > 0 && (
                        <div>
                          <span className="font-medium text-green-600">Existing Folders:</span>
                          <ul className="list-disc list-inside mt-1">
                            {folderTestResult.existing.map((folder: string) => (
                              <li key={folder} className="text-green-600">{folder}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Accounts</CardTitle>
                <CardDescription>Manage your connected email accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/settings/email-accounts">
                  <Button variant="outline">Manage Email Accounts</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>LLM Providers</CardTitle>
                <CardDescription>Configure AI providers for generating email replies</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/settings/llm-providers">
                  <Button variant="outline">Manage LLM Providers</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your password and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline">Change Password</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive">Delete Account</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}