'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Mail, Paperclip, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PostalMime from 'postal-mime';
import { apiGet } from '@/lib/api';

interface EmailAccount {
  id: string;
  email: string;
  host: string;
}

interface EmailMessage {
  uid: number;
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  date: Date;
  flags: string[];
  size: number;
  rawMessage: string;
}

interface ParsedEmail {
  headers: Array<{ key: string; value: string }>;
  from: { name?: string; address: string };
  to: Array<{ name?: string; address: string }>;
  subject: string;
  date: Date;
  text?: string;
  html?: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    content: Uint8Array;
  }>;
}

export default function InboxPage() {
  const { error, success } = useToast();
  
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [currentMessage, setCurrentMessage] = useState<EmailMessage | null>(null);
  const [parsedMessage, setParsedMessage] = useState<ParsedEmail | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Fetch email accounts on mount
  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Fetch message when account or index changes
  useEffect(() => {
    if (selectedAccount) {
      fetchMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, currentIndex]);
  
  // Parse message when raw message changes
  useEffect(() => {
    if (currentMessage?.rawMessage) {
      parseMessage(currentMessage.rawMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMessage]);
  
  const fetchAccounts = async () => {
    try {
      const data = await apiGet<{ accounts: EmailAccount[] }>('/api/inbox/accounts');
      setAccounts(data.accounts);
      
      if (data.accounts.length > 0) {
        setSelectedAccount(data.accounts[0].id);
      }
    } catch (err) {
      error('Failed to load email accounts');
      console.error(err);
    }
  };
  
  const fetchMessage = async () => {
    if (!selectedAccount) return;
    
    setLoading(true);
    try {
      const data = await apiGet<{
        messages: EmailMessage[];
        total: number;
        offset: number;
        limit: number;
      }>(`/api/inbox/emails/${selectedAccount}?offset=${currentIndex}&limit=1`);
      
      if (data.messages.length > 0) {
        setCurrentMessage(data.messages[0]);
        setTotalMessages(data.total);
      } else {
        setCurrentMessage(null);
        setParsedMessage(null);
        setTotalMessages(0);
      }
    } catch (err) {
      error('Failed to load message');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const parseMessage = async (rawMessage: string) => {
    try {
      const parser = new PostalMime();
      const parsed = await parser.parse(rawMessage);
      
      
      // Convert headers to array format
      const headersArray: Array<{ key: string; value: string }> = [];
      
      // postal-mime returns headers as an array of {key, value} objects
      if (Array.isArray(parsed.headers)) {
        parsed.headers.forEach((header: unknown) => {
          if (header && typeof header === 'object' && 'key' in header && 'value' in header) {
            const headerValue = Array.isArray(header.value) ? header.value.join(', ') : String(header.value);
            headersArray.push({ key: String(header.key), value: headerValue });
          }
        });
      } else if (parsed.headers && typeof parsed.headers === 'object') {
        // If headers is a Map or object
        Object.entries(parsed.headers).forEach(([key, value]) => {
          const headerValue = Array.isArray(value) ? value.join(', ') : String(value);
          headersArray.push({ key, value: headerValue });
        });
      }
      
      setParsedMessage({
        headers: headersArray,
        from: parsed.from || { address: '' },
        to: parsed.to || [],
        subject: parsed.subject || '',
        date: parsed.date || new Date(),
        text: parsed.text,
        html: parsed.html,
        attachments: parsed.attachments || []
      });
    } catch (err) {
      console.error('Failed to parse message:', err);
      error('Failed to parse email message');
    }
  };
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const handleNext = () => {
    if (currentIndex < totalMessages - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const handleGenerateDraft = () => {
    // TODO: Implement draft generation
    success('Draft generation will be implemented soon');
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Inbox</h1>
        
        {/* Account selector */}
        <div className="flex items-center gap-4 mb-4">
          <Select value={selectedAccount} onValueChange={(value) => {
            setSelectedAccount(value);
            setCurrentIndex(0); // Reset to first message when switching accounts
          }}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select an email account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentIndex === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              {totalMessages > 0 ? `${currentIndex + 1} of ${totalMessages}` : '0 messages'}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex >= totalMessages - 1 || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Email display */}
      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : currentMessage && parsedMessage ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{parsedMessage.subject || '(No subject)'}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  <div>From: {parsedMessage.from.name ? `${parsedMessage.from.name} <${parsedMessage.from.address}>` : parsedMessage.from.address}</div>
                  <div>Date: {new Date(parsedMessage.date).toLocaleString()}</div>
                </div>
              </div>
              <Button onClick={handleGenerateDraft}>
                <Mail className="mr-2 h-4 w-4" />
                Generate Draft
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Headers section */}
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium mb-2">
                Email Headers ({parsedMessage.headers.length})
              </summary>
              <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
                {parsedMessage.headers.map((header, idx) => (
                  <div key={idx} className="mb-1">
                    <span className="font-semibold">{header.key}:</span> {header.value}
                  </div>
                ))}
              </div>
            </details>
            
            <Separator className="my-4" />
            
            {/* Attachments */}
            {parsedMessage.attachments.length > 0 && (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Attachments ({parsedMessage.attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {parsedMessage.attachments.map((attachment, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1">{attachment.filename}</span>
                        <span className="text-xs text-muted-foreground">
                          {attachment.mimeType} • {formatFileSize(attachment.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator className="my-4" />
              </>
            )}
            
            {/* Email body */}
            <div className="prose prose-sm max-w-none">
              {parsedMessage.html ? (
                <div 
                  className="email-content"
                  dangerouslySetInnerHTML={{ __html: parsedMessage.html }}
                />
              ) : parsedMessage.text ? (
                <pre className="whitespace-pre-wrap font-sans">{parsedMessage.text}</pre>
              ) : (
                <p className="text-muted-foreground">No content available</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {accounts.length === 0 ? (
              <p>No email accounts configured. Please add an email account first.</p>
            ) : (
              <p>Select an email account to view messages</p>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Add some basic email content styling */}
      <style jsx>{`
        .email-content img {
          max-width: 100%;
          height: auto;
        }
        .email-content a {
          color: #6366f1;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}