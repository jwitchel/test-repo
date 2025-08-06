'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, Edit, Check, Zap, WifiOff } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'

interface LLMProvider {
  id: string
  provider_name: string
  provider_type: 'openai' | 'anthropic' | 'google' | 'local'
  api_endpoint?: string
  model_name: string
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

interface ProviderFormData {
  provider_name: string
  provider_type: 'openai' | 'anthropic' | 'google' | 'local'
  api_key: string
  api_endpoint?: string
  model_name: string
  is_default?: boolean
}

const PROVIDER_MODELS = {
  openai: [
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  google: [
    { value: 'gemini-pro', label: 'Gemini Pro' },
    { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' },
  ],
  local: [
    { value: 'llama-2-7b', label: 'Llama 2 7B' },
    { value: 'llama-2-13b', label: 'Llama 2 13B' },
    { value: 'mixtral-8x7b', label: 'Mixtral 8x7B' },
  ],
}

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    endpointPlaceholder: 'https://api.openai.com/v1 (optional)',
  },
  anthropic: {
    name: 'Anthropic',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-...',
    endpointPlaceholder: 'https://api.anthropic.com (optional)',
  },
  google: {
    name: 'Google AI',
    keyPrefix: '',
    keyPlaceholder: 'AIza...',
    endpointPlaceholder: 'https://generativelanguage.googleapis.com (optional)',
  },
  local: {
    name: 'Local Model',
    keyPrefix: '',
    keyPlaceholder: 'Optional API key',
    endpointPlaceholder: 'http://localhost:8080 (required)',
  },
}

const fetcher = (url: string) => 
  fetch(url, { credentials: 'include' }).then(res => res.json())

export default function LLMProvidersPage() {
  const { data: providers, error, isLoading } = useSWR<LLMProvider[]>(
    'http://localhost:3002/api/llm-providers',
    fetcher
  )
  const { success, error: showError } = useToast()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [connectionTested, setConnectionTested] = useState(false)
  const [formData, setFormData] = useState<ProviderFormData>({
    provider_name: '',
    provider_type: 'openai',
    api_key: '',
    api_endpoint: '',
    model_name: 'gpt-3.5-turbo',
    is_default: false,
  })

  // Auto-detect provider type from API key
  useEffect(() => {
    if (formData.api_key) {
      if (formData.api_key.startsWith('sk-ant-')) {
        setFormData(prev => ({ ...prev, provider_type: 'anthropic', model_name: 'claude-3-sonnet-20240229' }))
      } else if (formData.api_key.startsWith('sk-')) {
        setFormData(prev => ({ ...prev, provider_type: 'openai', model_name: 'gpt-3.5-turbo' }))
      } else if (formData.api_key.startsWith('AIza')) {
        setFormData(prev => ({ ...prev, provider_type: 'google', model_name: 'gemini-pro' }))
      }
    }
  }, [formData.api_key])

  const testConnection = async () => {
    setIsTesting(true)
    try {
      const response = await fetch('http://localhost:3002/api/llm-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      
      if (response.ok) {
        success('Connection test successful!')
        setConnectionTested(true)
      } else {
        showError(data.message || 'Connection test failed')
        setConnectionTested(false)
      }
    } catch {
      showError('Network error. Please check your connection.')
      setConnectionTested(false)
    } finally {
      setIsTesting(false)
    }
  }

  const handleAdd = async () => {
    if (!connectionTested) {
      showError('Please test the connection before saving')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('http://localhost:3002/api/llm-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      
      if (response.ok) {
        success('LLM provider added successfully')
        setIsAddDialogOpen(false)
        resetForm()
        mutate('http://localhost:3002/api/llm-providers')
      } else {
        showError(data.error || 'Failed to add provider')
      }
    } catch {
      showError('Network error. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedProvider) return

    setIsSaving(true)
    try {
      const updateData: Record<string, string | boolean> = {
        provider_name: formData.provider_name,
        model_name: formData.model_name,
        is_default: formData.is_default || false,
      }

      // Only include API key if it was changed
      if (formData.api_key && formData.api_key !== '••••••••') {
        updateData.api_key = formData.api_key
      }

      if (formData.api_endpoint) {
        updateData.api_endpoint = formData.api_endpoint
      }

      const response = await fetch(`http://localhost:3002/api/llm-providers/${selectedProvider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      })

      const data = await response.json()
      
      if (response.ok) {
        success('LLM provider updated successfully')
        setIsEditDialogOpen(false)
        setSelectedProvider(null)
        resetForm()
        mutate('http://localhost:3002/api/llm-providers')
      } else {
        showError(data.error || 'Failed to update provider')
      }
    } catch {
      showError('Network error. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProvider) return

    try {
      const response = await fetch(`http://localhost:3002/api/llm-providers/${selectedProvider.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        success('LLM provider deleted successfully')
        setIsDeleteDialogOpen(false)
        setSelectedProvider(null)
        mutate('http://localhost:3002/api/llm-providers')
      } else {
        const data = await response.json()
        showError(data.error || 'Failed to delete provider')
      }
    } catch {
      showError('Network error. Please try again.')
    }
  }

  const openEditDialog = (provider: LLMProvider) => {
    setSelectedProvider(provider)
    setFormData({
      provider_name: provider.provider_name,
      provider_type: provider.provider_type,
      api_key: '••••••••', // Placeholder for existing key
      api_endpoint: provider.api_endpoint || '',
      model_name: provider.model_name,
      is_default: provider.is_default,
    })
    setConnectionTested(true) // Already tested when created
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (provider: LLMProvider) => {
    setSelectedProvider(provider)
    setIsDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      provider_name: '',
      provider_type: 'openai',
      api_key: '',
      api_endpoint: '',
      model_name: 'gpt-3.5-turbo',
      is_default: false,
    })
    setConnectionTested(false)
  }

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'openai':
        return '🤖'
      case 'anthropic':
        return '🧠'
      case 'google':
        return '✨'
      case 'local':
        return '💻'
      default:
        return '🔮'
    }
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Alert className="max-w-md mx-auto">
          <AlertDescription>
            Failed to load LLM providers. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">LLM Providers</h1>
        <p className="text-muted-foreground">
          Configure AI providers for generating email replies
        </p>
      </div>

      <div className="mb-6">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : providers && providers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <Card key={provider.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getProviderIcon(provider.provider_type)}</span>
                    <div>
                      <CardTitle className="text-lg">{provider.provider_name}</CardTitle>
                      <CardDescription>
                        {PROVIDER_INFO[provider.provider_type].name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {provider.is_default && (
                      <Badge variant="default" className="bg-indigo-600">Default</Badge>
                    )}
                    <Badge variant={provider.is_active ? "default" : "secondary"}>
                      {provider.is_active ? (
                        <><Zap className="mr-1 h-3 w-3" /> Active</>
                      ) : (
                        <><WifiOff className="mr-1 h-3 w-3" /> Inactive</>
                      )}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Model:</span>{' '}
                    <span className="font-medium">{provider.model_name}</span>
                  </div>
                  {provider.api_endpoint && (
                    <div>
                      <span className="text-muted-foreground">Endpoint:</span>{' '}
                      <span className="font-medium text-xs">{provider.api_endpoint}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Added:</span>{' '}
                    <span className="font-medium">
                      {new Date(provider.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(provider)}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(provider)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                No LLM providers configured yet.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Provider
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Provider Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add LLM Provider</DialogTitle>
            <DialogDescription>
              Configure a new AI provider for generating email replies
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider_name">Provider Name</Label>
              <Input
                id="provider_name"
                placeholder="e.g., Work OpenAI"
                value={formData.provider_name}
                onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                placeholder={PROVIDER_INFO[formData.provider_type].keyPlaceholder}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Your API key will be encrypted and stored securely
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider_type">Provider Type</Label>
              <Select
                value={formData.provider_type}
                onValueChange={(value: 'openai' | 'anthropic' | 'google' | 'local') => {
                  setFormData({ 
                    ...formData, 
                    provider_type: value,
                    model_name: PROVIDER_MODELS[value][0].value
                  })
                  setConnectionTested(false)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model_name">Model</Label>
              <Select
                value={formData.model_name}
                onValueChange={(value) => {
                  setFormData({ ...formData, model_name: value })
                  setConnectionTested(false)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS[formData.provider_type].map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_endpoint">API Endpoint (Optional)</Label>
              <Input
                id="api_endpoint"
                placeholder={PROVIDER_INFO[formData.provider_type].endpointPlaceholder}
                value={formData.api_endpoint}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_default"
                className="rounded border-gray-300"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              />
              <Label htmlFor="is_default" className="font-normal">
                Set as default provider
              </Label>
            </div>

            {connectionTested && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Connection test successful! You can now save the provider.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={!formData.provider_name || !formData.api_key || isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!connectionTested || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Provider'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit LLM Provider</DialogTitle>
            <DialogDescription>
              Update provider configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_provider_name">Provider Name</Label>
              <Input
                id="edit_provider_name"
                value={formData.provider_name}
                onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_api_key">API Key</Label>
              <Input
                id="edit_api_key"
                type="password"
                placeholder="Leave blank to keep current key"
                value={formData.api_key}
                onChange={(e) => {
                  setFormData({ ...formData, api_key: e.target.value })
                  if (e.target.value && e.target.value !== '••••••••') {
                    setConnectionTested(false)
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Provider Type</Label>
              <Input
                value={PROVIDER_INFO[formData.provider_type].name}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_model_name">Model</Label>
              <Select
                value={formData.model_name}
                onValueChange={(value) => setFormData({ ...formData, model_name: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS[formData.provider_type].map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_api_endpoint">API Endpoint</Label>
              <Input
                id="edit_api_endpoint"
                placeholder={PROVIDER_INFO[formData.provider_type].endpointPlaceholder}
                value={formData.api_endpoint}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit_is_default"
                className="rounded border-gray-300"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              />
              <Label htmlFor="edit_is_default" className="font-normal">
                Set as default provider
              </Label>
            </div>
          </div>
          <DialogFooter>
            {formData.api_key && formData.api_key !== '••••••••' && !connectionTested && (
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test New Key'
                )}
              </Button>
            )}
            <Button
              onClick={handleEdit}
              disabled={isSaving || (!!formData.api_key && formData.api_key !== '••••••••' && !connectionTested)}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete LLM Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedProvider?.provider_name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}