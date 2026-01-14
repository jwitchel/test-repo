'use client';

import { useRouter } from 'next/navigation';
import { Alert, Button, Stack } from '@mui/material';
import { useAlerts } from '@/lib/alert-context';
import { AlertSeverity, SourceType } from '@server/types/user-alerts';

/**
 * Persistent alert banner using MUI Alert component
 * Shows errors first, then warnings. Errors are non-dismissible.
 */
export function PersistentAlertBanner() {
  const router = useRouter();
  const { alerts, resolveAlert } = useAlerts();

  // Filter OUT onboarding alerts - they show in SetupChecklist, not here
  const errorAlerts = alerts.filter(
    (a) => a.sourceType !== SourceType.ONBOARDING
  );

  if (errorAlerts.length === 0) {
    return null;
  }

  // Sort by severity (errors first)
  const sortedAlerts = [...errorAlerts].sort((a, b) => {
    if (a.severity === AlertSeverity.ERROR && b.severity !== AlertSeverity.ERROR) return -1;
    if (a.severity !== AlertSeverity.ERROR && b.severity === AlertSeverity.ERROR) return 1;
    return 0;
  });

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {sortedAlerts.map((alert) => {
        const isError = alert.severity === AlertSeverity.ERROR;
        const severity = alert.severity as 'error' | 'warning' | 'info';

        return (
          <Alert
            key={alert.id}
            severity={severity}
            variant="filled"
            onClose={isError ? undefined : () => resolveAlert(alert.id)}
            action={
              <Button
                size="small"
                color="inherit"
                onClick={() => router.push(alert.actionUrl)}
              >
                {alert.actionLabel}
              </Button>
            }
          >
            <strong>{alert.sourceName}</strong>
            {alert.errorCount > 1 && ` (${alert.errorCount}×)`}
            {' — '}
            {alert.message}
          </Alert>
        );
      })}
    </Stack>
  );
}
