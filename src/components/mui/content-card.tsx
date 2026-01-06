'use client';

import { Paper, Typography } from '@mui/material';
import { useTheme, SxProps, Theme } from '@mui/material/styles';

interface ContentCardProps {
  title?: string;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export function ContentCard({ title, children, sx }: ContentCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      sx={{
        p: 4,
        bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(248, 250, 252, 0.6)',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`,
        backdropFilter: 'blur(8px)',
        ...sx as object,
      }}
    >
      {title && (
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          {title}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

export function useContentColors() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return {
    secondaryText: isDark ? '#94a3b8' : '#64748b',
    cardBg: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(248, 250, 252, 0.6)',
    cardBorder: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 0, 0, 0.08)',
  };
}
