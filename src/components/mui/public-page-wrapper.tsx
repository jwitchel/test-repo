'use client';

import { Box, Container } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface PublicPageWrapperProps {
  children: React.ReactNode;
  backgroundImage?: string;
}

export function PublicPageWrapper({
  children,
  backgroundImage = '/images/difference-bg.jpg'
}: PublicPageWrapperProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        py: { xs: 6, md: 10 },
        minHeight: 'calc(100vh - 200px)',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.78)',
          minHeight: 'inherit',
        },
      }}
    >
      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        {children}
      </Container>
    </Box>
  );
}
