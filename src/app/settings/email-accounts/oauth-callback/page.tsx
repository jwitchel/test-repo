'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export default function OAuthCallbackPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { success, error: showError } = useToast()

  useEffect(() => {
    async function handleOAuthCallback() {
      if (!user) {
        showError('You must be signed in to connect an email account')
        router.push('/signin')
        return
      }

      try {
        // Wait a moment for better-auth to complete the OAuth flow
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Get the current session to access OAuth tokens
        const response = await fetch('http://localhost:3002/api/auth/get-session', {
          credentials: 'include'
        })
        
        if (!response.ok) {
          throw new Error('Failed to get session')
        }

        const sessionData = await response.json()
        console.log('Session data:', sessionData)
        
        // Get accounts for the current user
        const accountsResponse = await fetch('http://localhost:3002/api/accounts', {
          credentials: 'include'
        })

        if (accountsResponse.ok) {
          const accounts = await accountsResponse.json()
          console.log('OAuth accounts:', accounts)
          const googleAccount = accounts.find((a: any) => a.providerId === 'google')
          
          if (googleAccount) {
            console.log('Google account data:', googleAccount)
            
            // Check if we have the required OAuth tokens
            if (!googleAccount.accessToken) {
              showError('Access token not found. Please try connecting again.')
              router.push('/settings/email-accounts')
              return
            }
            
            // Note: refresh token might be null on subsequent sign-ins
            if (!googleAccount.refreshToken) {
              console.warn('No refresh token received - this is normal for subsequent sign-ins')
            }
            
            // Calculate token expiry time
            const expiresIn = googleAccount.accessTokenExpiresAt 
              ? Math.floor((new Date(googleAccount.accessTokenExpiresAt).getTime() - Date.now()) / 1000)
              : 3600 // Default 1 hour
            
            // Save email account with OAuth tokens
            const saveResponse = await fetch('http://localhost:3002/api/oauth-email/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                provider: 'google',
                email: sessionData.user?.email || user.email,
                accessToken: googleAccount.accessToken,
                refreshToken: googleAccount.refreshToken || null,
                expiresIn: expiresIn > 0 ? expiresIn : 3600,
                oauthUserId: googleAccount.accountId
              })
            })

            if (saveResponse.ok) {
              success('Email account connected successfully with OAuth!')
              router.push('/settings/email-accounts')
            } else {
              const error = await saveResponse.json()
              showError(error.error || 'Failed to save OAuth credentials')
              router.push('/settings/email-accounts')
            }
          } else {
            showError('OAuth authentication failed - no Google account found')
            router.push('/settings/email-accounts')
          }
        } else {
          showError('Failed to retrieve OAuth account information')
          router.push('/settings/email-accounts')
        }
      } catch (error) {
        console.error('OAuth callback error:', error)
        showError('Failed to complete OAuth connection')
        router.push('/settings/email-accounts')
      }
    }

    handleOAuthCallback()
  }, [user, router, success, showError])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-lg">Connecting your email account...</p>
      </div>
    </div>
  )
}