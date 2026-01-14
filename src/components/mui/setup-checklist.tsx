'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  Checkbox,
  LinearProgress,
  IconButton,
  Stack,
  Box,
  SxProps,
  Theme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAlerts } from '@/lib/alert-context';
import { AlertType, SourceType } from '@server/types/user-alerts';

const ONBOARDING_ALERT_TYPES = [
  AlertType.SETUP_LLM_PROVIDER,
  AlertType.SETUP_EMAIL_ACCOUNT,
  AlertType.SETUP_FOLDERS,
  AlertType.SETUP_PROFILE,
  AlertType.SETUP_RELATIONSHIPS,
  AlertType.SETUP_TRAINING,
] as const;

const STEP_ORDER: Record<string, number> = {
  [AlertType.SETUP_LLM_PROVIDER]: 1,
  [AlertType.SETUP_EMAIL_ACCOUNT]: 2,
  [AlertType.SETUP_FOLDERS]: 3,
  [AlertType.SETUP_PROFILE]: 4,
  [AlertType.SETUP_RELATIONSHIPS]: 5,
  [AlertType.SETUP_TRAINING]: 6,
};

const STEP_LABELS: Record<string, string> = {
  [AlertType.SETUP_LLM_PROVIDER]: 'LLM Provider Setup',
  [AlertType.SETUP_EMAIL_ACCOUNT]: 'Email Account Setup',
  [AlertType.SETUP_FOLDERS]: 'Folder Configuration',
  [AlertType.SETUP_PROFILE]: 'Set Up Your Profile',
  [AlertType.SETUP_RELATIONSHIPS]: 'Relationships',
  [AlertType.SETUP_TRAINING]: 'Training',
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  [AlertType.SETUP_LLM_PROVIDER]: 'Add an AI provider (OpenAI, Anthropic, etc.) to enable draft generation',
  [AlertType.SETUP_EMAIL_ACCOUNT]: 'Connect your email account to start monitoring for incoming messages',
  [AlertType.SETUP_FOLDERS]: 'Configure which folders to monitor and where to save drafts',
  [AlertType.SETUP_PROFILE]: 'Add your name and signature for personalized email drafts',
  [AlertType.SETUP_RELATIONSHIPS]: 'Add family, work contacts for better context in drafts',
  [AlertType.SETUP_TRAINING]: 'Train the AI on your writing style by reviewing sent emails',
};

// These steps cannot be skipped - they are required for the system to function
const NON_SKIPPABLE_TYPES: Set<string> = new Set([
  AlertType.SETUP_LLM_PROVIDER,
  AlertType.SETUP_EMAIL_ACCOUNT,
]);

// Shared styles
const listItemSx: SxProps<Theme> = { py: 1, alignItems: 'flex-start' };
const checkboxSx: SxProps<Theme> = { p: 0, mr: 1, mt: 0.5 };
const checkedCheckboxSx: SxProps<Theme> = {
  ...checkboxSx,
  color: 'success.main',
  '&.Mui-checked.Mui-disabled': { color: 'success.main' },
};
const listItemTextSx: SxProps<Theme> = { m: 0 };

function getStepLabel(alertType: string): string {
  return STEP_LABELS[alertType]!;
}

function getStepDescription(alertType: string): string {
  return STEP_DESCRIPTIONS[alertType]!;
}

/**
 * Hook to get onboarding setup status
 */
export function useOnboardingStatus() {
  const { alerts } = useAlerts();

  const onboardingAlerts = alerts.filter(
    (a) => a.sourceType === SourceType.ONBOARDING
  );

  const totalSteps = ONBOARDING_ALERT_TYPES.length;
  const completedSteps = totalSteps - onboardingAlerts.length;

  return {
    hasOnboardingAlerts: onboardingAlerts.length > 0,
    completedSteps,
    totalSteps,
  };
}

interface SetupChecklistProps {
  open: boolean;
  onClose: () => void;
}

export function SetupChecklist({ open, onClose }: SetupChecklistProps) {
  const router = useRouter();
  const { alerts, resolveAlert } = useAlerts();

  // Filter to only onboarding alerts
  const onboardingAlerts = alerts.filter(
    (a) => a.sourceType === SourceType.ONBOARDING
  );

  // If no onboarding alerts or not open, nothing to show
  if (onboardingAlerts.length === 0 || !open) {
    return null;
  }

  // Calculate progress
  const totalSteps = ONBOARDING_ALERT_TYPES.length;
  const completedSteps = totalSteps - onboardingAlerts.length;
  const progress = (completedSteps / totalSteps) * 100;

  // Sort alerts by step order
  const sortedAlerts = [...onboardingAlerts].sort(
    (a, b) => STEP_ORDER[a.alertType] - STEP_ORDER[b.alertType]
  );

  const handleAction = (actionUrl: string) => {
    onClose();
    router.push(actionUrl);
  };

  return (
    <Dialog
      open
      maxWidth="sm"
      fullWidth
      disableRestoreFocus
      disableEscapeKeyDown
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="h4">Complete Your Setup</Typography>
            <Typography variant="body2" color="text.secondary">
              {completedSteps} of {totalSteps} steps complete
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ mt: -0.5 }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ mx: 3 }}
      />

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Complete these steps to start using your AI email assistant. Each step helps
          configure the system to generate personalized draft replies.
        </Typography>

        <List disablePadding>
          {/* Show completed steps (checked) */}
          {ONBOARDING_ALERT_TYPES.filter(
            (type) => !onboardingAlerts.find((a) => a.alertType === type)
          ).map((type) => (
            <ListItem key={type} disablePadding sx={{ ...listItemSx, opacity: 0.6 }}>
              <Checkbox checked disabled size="small" sx={checkedCheckboxSx} />
              <ListItemText
                primary={getStepLabel(type)}
                secondary={getStepDescription(type)}
                sx={listItemTextSx}
                slotProps={{ primary: { sx: { textDecoration: 'line-through' } } }}
              />
            </ListItem>
          ))}

          {/* Show pending steps */}
          {sortedAlerts.map((alert) => {
            const canSkip = !NON_SKIPPABLE_TYPES.has(alert.alertType);
            return (
              <ListItem key={alert.id} disablePadding sx={{ py: 1, display: 'flex', alignItems: 'center' }}>
                <Checkbox checked={false} disabled size="small" sx={checkboxSx} />
                <ListItemText
                  primary={alert.sourceName}
                  secondary={alert.message}
                  sx={{ ...listItemTextSx, flex: 1 }}
                />
                <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAction(alert.actionUrl)}
                  >
                    {alert.actionLabel}
                  </Button>
                  {canSkip && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Skip
                    </Button>
                  )}
                </Stack>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
