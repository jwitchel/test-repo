'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useSWR from 'swr';
import ReactECharts from 'echarts-for-react';

// Raw action counts from API (all possible actions)
interface RawActionCounts {
  [key: string]: number;
}

// Aggregated action counts for display
interface ActionCounts {
  drafted: number;
  spam: number;
  moved: number;
  noAction: number;
}

interface ActionsSummaryData {
  periods: {
    last5min: RawActionCounts;
    lastHour: RawActionCounts;
    last24Hours: RawActionCounts;
    last30Days: RawActionCounts;
  };
}

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch actions summary');
  }
  return res.json();
};

// Aggregate raw actions into display categories
function aggregateActions(raw: RawActionCounts): ActionCounts {
  const result: ActionCounts = {
    drafted: 0,
    spam: 0,
    moved: 0,
    noAction: 0
  };

  Object.entries(raw).forEach(([action, count]) => {
    // Draft actions (reply, forward, etc.)
    if (action === 'reply' || action === 'reply-all' || action === 'forward' || action === 'forward-with-comment') {
      result.drafted += count;
    }
    // Spam
    else if (action === 'silent-spam') {
      result.spam += count;
    }
    // Moved (FYI, Large List, Unsubscribe)
    else if (action === 'silent-fyi-only' || action === 'silent-large-list' || action === 'silent-unsubscribe') {
      result.moved += count;
    }
    // Legacy draft_created - we can't distinguish these in aggregate, so count as drafted
    else if (action === 'draft_created') {
      result.drafted += count;
    }
    // Everything else is No Action
    else {
      result.noAction += count;
    }
  });

  return result;
}

export function ActionsSummaryChart() {
  const { data, error, isLoading } = useSWR<ActionsSummaryData>(
    `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/actions-summary`,
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">Failed to load actions summary</div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Aggregate raw actions into display categories
  const periods = ['Last 5 Min', 'Last Hour', 'Last 24 Hours', 'Last 30 Days'];
  const { last5min, lastHour, last24Hours, last30Days } = data.periods;

  // Aggregate each period's actions
  const agg5min = aggregateActions(last5min);
  const aggHour = aggregateActions(lastHour);
  const agg24h = aggregateActions(last24Hours);
  const agg30d = aggregateActions(last30Days);

  const draftedData = [agg5min.drafted, aggHour.drafted, agg24h.drafted, agg30d.drafted];
  const spamData = [agg5min.spam, aggHour.spam, agg24h.spam, agg30d.spam];
  const movedData = [agg5min.moved, aggHour.moved, agg24h.moved, agg30d.moved];
  const noActionData = [agg5min.noAction, aggHour.noAction, agg24h.noAction, agg30d.noAction];

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      data: ['Drafted', 'Spam', 'Moved', 'No Action'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: periods,
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
    },
    series: [
      {
        name: 'Drafted',
        type: 'bar',
        data: draftedData,
        itemStyle: {
          color: '#3b82f6', // blue-500
        },
      },
      {
        name: 'Spam',
        type: 'bar',
        data: spamData,
        itemStyle: {
          color: '#ef4444', // red-500
        },
      },
      {
        name: 'Moved',
        type: 'bar',
        data: movedData,
        itemStyle: {
          color: '#22c55e', // green-500
        },
      },
      {
        name: 'No Action',
        type: 'bar',
        data: noActionData,
        itemStyle: {
          color: '#6b7280', // gray-500
        },
      },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <ReactECharts option={option} style={{ height: '300px' }} />
      </CardContent>
    </Card>
  );
}
