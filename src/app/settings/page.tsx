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
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) return
      
      setIsLoading(true)
      try {
        const data = await apiGet<{ preferences: { name?: string; nicknames?: string; signatureBlock?: string } }>('/api/settings/profile')
        if (data.preferences) {
          setName(data.preferences.name || user.name || '')
          setNicknames(data.preferences.nicknames || '')
          setSignatureBlock(data.preferences.signatureBlock || '')
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
        signatureBlock
      })
      success('Profile updated successfully')
    } catch (err) {
      error('Failed to update profile')
      console.error(err)
    } finally {
      setIsSaving(false)
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