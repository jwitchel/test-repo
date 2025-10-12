'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import Link from 'next/link';

interface RecentAction {
  id: string;
  messageId: string;
  actionTaken: string;
  subject: string;
  destinationFolder?: string;
  updatedAt: string;
  emailAccountId: string;
  emailAccount: string;
}

interface RecentActionsData {
  actions: RecentAction[];
  total: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch recent actions');
  }
  return res.json();
};

// Action categories for display
type ActionCategory = 'Drafted' | 'Spam' | 'Moved' | 'No Action';

// Map actions to categories and labels
function getActionInfo(actionTaken: string, destinationFolder?: string): {
  category: ActionCategory;
  label: string;
  color: string;
} {
  // Draft actions (reply, reply-all, forward, forward-with-comment)
  if (actionTaken === 'reply' || actionTaken === 'reply-all') {
    return {
      category: 'Drafted',
      label: 'Drafted',
      color: 'bg-blue-500 hover:bg-blue-600'
    };
  }
  if (actionTaken === 'forward' || actionTaken === 'forward-with-comment') {
    return {
      category: 'Drafted',
      label: `Drafted (Forward)`,
      color: 'bg-blue-500 hover:bg-blue-600'
    };
  }

  // Spam
  if (actionTaken === 'silent-spam') {
    return {
      category: 'Spam',
      label: 'Moved (Spam)',
      color: 'bg-red-500 hover:bg-red-600'
    };
  }

  // Moved actions (FYI, Large List, Unsubscribe)
  if (actionTaken === 'silent-fyi-only') {
    return {
      category: 'Moved',
      label: 'Moved (FYI Only)',
      color: 'bg-green-500 hover:bg-green-600'
    };
  }
  if (actionTaken === 'silent-large-list') {
    return {
      category: 'Moved',
      label: 'Moved (Large List)',
      color: 'bg-green-500 hover:bg-green-600'
    };
  }
  if (actionTaken === 'silent-unsubscribe') {
    return {
      category: 'Moved',
      label: 'Moved (Unsubscribe)',
      color: 'bg-green-500 hover:bg-green-600'
    };
  }

  // Fallback for draft_created (legacy) - infer from destination folder if available
  if (actionTaken === 'draft_created') {
    // Infer action from destination folder for old records
    if (destinationFolder === 't2j-spam') {
      return {
        category: 'Spam',
        label: 'Moved (Spam)',
        color: 'bg-red-500 hover:bg-red-600'
      };
    }
    if (destinationFolder === 't2j-no-action') {
      return {
        category: 'Moved',
        label: 'Moved (No Action)',
        color: 'bg-green-500 hover:bg-green-600'
      };
    }
    // Otherwise it's a real draft
    return {
      category: 'Drafted',
      label: 'Drafted',
      color: 'bg-blue-500 hover:bg-blue-600'
    };
  }

  // Unknown/No Action
  return {
    category: 'No Action',
    label: actionTaken,
    color: 'bg-gray-500 hover:bg-gray-600'
  };
}

// Generate consistent color for email address
function getEmailColor(email: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-teal-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
  ];

  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export function RecentActionsTable() {
  const { data, error, isLoading } = useSWR<RecentActionsData>(
    `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/recent-actions?limit=20`,
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  // Get unique email accounts for legend (must be before conditionals)
  const uniqueEmails = useMemo(() => {
    if (!data || !data.actions) return [];
    const emails = Array.from(new Set(data.actions.map(a => a.emailAccount)));
    return emails.map(email => ({
      email,
      color: getEmailColor(email)
    }));
  }, [data]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">Failed to load recent actions</div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading recent actions...</div>
        </CardContent>
      </Card>
    );
  }

  if (data.actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-center py-8">
            No actions taken yet. Start processing emails to see activity here.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Actions</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Email Account Legend */}
        <div className="mb-4 flex flex-wrap gap-3">
          {uniqueEmails.map(({ email, color }) => (
            <div key={email} className="flex items-center gap-2 text-xs">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <span className="text-muted-foreground">{email}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium">Time</th>
                <th className="text-left py-2 px-2 font-medium">Subject</th>
                <th className="text-left py-2 px-2 font-medium">Action</th>
                <th className="text-center py-2 px-2 font-medium">Account</th>
                <th className="text-left py-2 px-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.actions.map((action) => {
                const actionInfo = getActionInfo(action.actionTaken, action.destinationFolder);
                const emailColor = getEmailColor(action.emailAccount);

                return (
                  <tr key={action.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                      {formatDistanceToNow(new Date(action.updatedAt), { addSuffix: true })}
                    </td>
                    <td className="py-2 px-2 max-w-xs truncate" title={action.subject}>
                      {action.subject}
                    </td>
                    <td className="py-2 px-2">
                      <Badge className={`${actionInfo.color} text-white text-xs`}>
                        {actionInfo.label}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center">
                        <div
                          className={`w-4 h-4 rounded-full ${emailColor}`}
                          title={action.emailAccount}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <Link
                        href={`/inbox?emailAccountId=${action.emailAccountId}&messageId=${encodeURIComponent(action.messageId)}`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.total > 20 && (
          <div className="text-xs text-muted-foreground text-center mt-4">
            Showing 20 of {data.total} total actions
          </div>
        )}
      </CardContent>
    </Card>
  );
}
