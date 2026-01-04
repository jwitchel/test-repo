'use client';

import { useState, MouseEvent, useMemo } from 'react';
import {
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { EmailActionType, EMAIL_ACTION_LABELS } from '../../../../../server/src/types/email-action-tracking';
import {
  ActionRuleConditionType,
  USER_ACTION_VALUES,
  UserActionType,
} from '../../../../../server/src/types/action-rules';
import { RelationshipType } from '../../../../../server/src/lib/relationships/types';
import { useMuiToast } from '@/hooks/use-mui-toast';
import { useActionColors } from '@/hooks/use-action-colors';
import { relationshipColors } from '@/lib/theme';

interface ActionSelectorProps {
  emailAddress: string;
  currentAction: EmailActionType;
  relationshipType?: string;
  trackingId?: string;
  onActionRuleCreated?: () => void;
  onActionChanged?: () => void;
}

// Selection type: 'this-email' for single reclassification, 'sender' or 'relationship' for rules
type SelectionType = 'this-email' | ActionRuleConditionType;

export function ActionSelector({
  emailAddress,
  currentAction,
  relationshipType,
  trackingId,
  onActionRuleCreated,
  onActionChanged,
}: ActionSelectorProps) {
  const theme = useTheme();
  const actionColorsMap = useActionColors();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const relColors = relationshipColors[mode];

  const { success, error } = useMuiToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<UserActionType | null>(null);
  const [selectionType, setSelectionType] = useState<SelectionType>(
    trackingId ? 'this-email' : (relationshipType ? ActionRuleConditionType.RELATIONSHIP : ActionRuleConditionType.SENDER)
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  // Build action options with theme-aware colors
  const actionOptions = useMemo(
    () =>
      USER_ACTION_VALUES.map((value) => ({
        value,
        label: EMAIL_ACTION_LABELS[value],
        color: actionColorsMap[value],
      })),
    [actionColorsMap]
  );

  const handleChipClick = (event: MouseEvent<HTMLElement>) => {
    if (!isLoading) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleActionSelect = (newValue: string) => {
    handleMenuClose();
    if (newValue === currentAction) return;
    setSelectedAction(newValue as UserActionType);
    // Default to 'this-email' if trackingId is available, otherwise use rule-based approach
    setSelectionType(trackingId ? 'this-email' : (relationshipType ? ActionRuleConditionType.RELATIONSHIP : ActionRuleConditionType.SENDER));
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedAction) return;

    setIsLoading(true);
    try {
      // Handle "this email only" - reclassify without creating a rule
      if (selectionType === 'this-email') {
        // trackingId is guaranteed when 'this-email' option is available
        const response = await fetch(`/api/inbox/reclassify/${trackingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            newAction: selectedAction,
            previousAction: currentAction,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error);
        }

        success(`Email reclassified to ${EMAIL_ACTION_LABELS[selectedAction]}`);
        onActionChanged?.();
        setDialogOpen(false);
        setSelectedAction(null);
        return;
      }

      // Handle rule creation (sender or relationship)
      // conditionValue is guaranteed: sender uses emailAddress, relationship uses relationshipType
      const conditionValue = selectionType === ActionRuleConditionType.SENDER
        ? emailAddress
        : relationshipType!;

      const response = await fetch('/api/action-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conditionType: selectionType,
          conditionValue,
          targetAction: selectedAction,
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        error(data.error);
        setDialogOpen(false);
        setSelectedAction(null);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const ruleTypeLabel = selectionType === ActionRuleConditionType.SENDER
        ? emailAddress
        : RelationshipType.LABELS[conditionValue];

      success(`Action rule created: ${ruleTypeLabel} -> ${EMAIL_ACTION_LABELS[selectedAction]}`);
      onActionRuleCreated?.();
      setDialogOpen(false);
      setSelectedAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update action';
      error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const actionColor = actionColorsMap[currentAction];
  const actionLabel = EMAIL_ACTION_LABELS[currentAction];
  const relationshipColor = relationshipType ? relColors[relationshipType as keyof typeof relColors] : undefined;
  const relationshipLabel = relationshipType ? RelationshipType.LABELS[relationshipType] : undefined;

  return (
    <>
      <Chip
        label={actionLabel}
        size="small"
        onClick={handleChipClick}
        sx={{
          backgroundColor: actionColor,
          color: 'white',
          cursor: 'pointer',
          '&:hover': { opacity: 0.9 },
        }}
      />
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {actionOptions.map((option) => (
          <MenuItem
            key={option.value}
            onClick={() => handleActionSelect(option.value)}
            selected={option.value === currentAction}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {option.value === currentAction ? (
                <CheckIcon fontSize="small" />
              ) : (
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: option.color,
                  }}
                />
              )}
            </ListItemIcon>
            {option.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>
          {selectionType === 'this-email' ? 'Reclassify Email' : 'Create Action Rule'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div" sx={{ mb: 2 }}>
            {selectionType === 'this-email' ? 'Reclassify this email as:' : 'Choose how to apply the action:'}{' '}
            {selectedAction && (
              <Chip
                label={EMAIL_ACTION_LABELS[selectedAction]}
                size="small"
                sx={{
                  ml: 1,
                  backgroundColor: actionColorsMap[selectedAction],
                  color: 'white',
                }}
              />
            )}
          </DialogContentText>

          <FormControl component="fieldset">
            <RadioGroup
              value={selectionType}
              onChange={(e) => setSelectionType(e.target.value as SelectionType)}
            >
              {trackingId && (
                <FormControlLabel
                  value="this-email"
                  control={<Radio />}
                  label="This email only (don't create a rule)"
                />
              )}
              {relationshipLabel && (
                <FormControlLabel
                  value={ActionRuleConditionType.RELATIONSHIP}
                  control={<Radio />}
                  label={
                    <>
                      Create rule for all{' '}
                      <Chip
                        label={relationshipLabel}
                        size="small"
                        sx={{
                          mx: 0.5,
                          backgroundColor: relationshipColor,
                          color: 'white',
                        }}
                      />{' '}
                      contacts
                    </>
                  }
                />
              )}
              <FormControlLabel
                value={ActionRuleConditionType.SENDER}
                control={<Radio />}
                label={
                  <>
                    Create rule for <strong>{emailAddress}</strong>
                  </>
                }
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} loading={isLoading}>
            {selectionType === 'this-email' ? 'Reclassify' : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
