'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Typography,
  Stack,
  Paper,
  Alert,
} from '@mui/material';

export interface CommonPattern {
  pattern: string;
  desc: string;
}

export interface RegexTestResult {
  valid: boolean;
  matched: boolean;
  matchedText?: string;
  error?: string;
}

export interface RegexTesterDialogProps {
  open: boolean;
  onClose: () => void;
  onAddPattern: (pattern: string) => void;
  title?: string;
  description?: string;
  initialPattern?: string;
  defaultTestText?: string;
  commonPatterns: CommonPattern[];
  testTextLabel?: string;
  testTextRows?: number;
  addButtonLabel?: string;
}

export function RegexTesterDialog({
  open,
  onClose,
  onAddPattern,
  title = 'Test Regex Pattern',
  description = 'Test your regex pattern against sample text before adding it.',
  initialPattern = '',
  defaultTestText = '',
  commonPatterns,
  testTextLabel = 'Test Text',
  testTextRows = 8,
  addButtonLabel = 'Add Pattern',
}: RegexTesterDialogProps) {
  const [pattern, setPattern] = useState(initialPattern);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<RegexTestResult | null>(null);

  useEffect(() => {
    if (open) {
      setPattern(initialPattern);
      setTestText(defaultTestText);
      setTestResult(null);
    }
  }, [open, initialPattern, defaultTestText]);

  const handleTest = () => {
    if (!pattern.trim()) {
      setTestResult({ valid: false, matched: false, error: 'Please enter a regex pattern' });
      return;
    }

    try {
      const regex = new RegExp(pattern, 'i');
      const match = testText.match(regex);

      if (match) {
        setTestResult({
          valid: true,
          matched: true,
          matchedText: match[0],
        });
      } else {
        setTestResult({
          valid: true,
          matched: false,
        });
      }
    } catch (err) {
      setTestResult({
        valid: false,
        matched: false,
        error: err instanceof Error ? err.message : 'Invalid regex pattern',
      });
    }
  };

  const handleAddPattern = () => {
    if (!pattern.trim()) return;

    try {
      new RegExp(pattern);
      onAddPattern(pattern.trim());
      onClose();
    } catch {
      setTestResult({
        valid: false,
        matched: false,
        error: 'Cannot add invalid regex pattern',
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              Regex Pattern
            </Typography>
            <TextField
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g., ^noreply@.*\.example\.com$"
              fullWidth
              size="small"
              slotProps={{
                input: { style: { fontFamily: 'monospace', fontSize: '0.875rem' } },
              }}
            />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              {testTextLabel}
            </Typography>
            <TextField
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              multiline
              rows={testTextRows}
              fullWidth
              size="small"
              slotProps={{
                input: { style: { fontFamily: 'monospace', fontSize: '0.875rem' } },
              }}
            />
          </Box>
          <Button variant="outlined" onClick={handleTest} fullWidth>
            Test Pattern
          </Button>
          {testResult && (
            <Alert
              severity={testResult.error ? 'error' : testResult.matched ? 'success' : 'warning'}
            >
              {testResult.error ? (
                testResult.error
              ) : testResult.matched ? (
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Pattern matched!
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      mt: 1,
                      p: 1,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto',
                    }}
                  >
                    {testResult.matchedText}
                  </Box>
                </Box>
              ) : (
                'No match found in test text'
              )}
            </Alert>
          )}
          {commonPatterns.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Common Patterns:
              </Typography>
              <Stack spacing={0.5}>
                {commonPatterns.map((cp, idx) => (
                  <Typography key={idx} variant="caption" color="text.secondary">
                    <Box
                      component="code"
                      sx={{ bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5, cursor: 'pointer' }}
                      onClick={() => setPattern(cp.pattern)}
                    >
                      {cp.pattern}
                    </Box>{' '}
                    - {cp.desc}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAddPattern} disabled={!pattern.trim()}>
          {addButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
