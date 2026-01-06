'use client';

import { Box, Typography } from '@mui/material';
import { MuiPublicLayout, PageHeader, PublicPageWrapper, ContentCard, useContentColors } from '@/components/mui';
import { usePageTitle } from '@/hooks/use-page-title';

export default function DemoPage() {
  usePageTitle('How It Works');
  const colors = useContentColors();

  return (
    <MuiPublicLayout>
      <PublicPageWrapper>
        <PageHeader title="How It Works" centered />

        <ContentCard>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              paddingTop: '56.25%', // 16:9 aspect ratio
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 0,
                    height: 0,
                    borderTop: '15px solid transparent',
                    borderBottom: '15px solid transparent',
                    borderLeft: `25px solid`,
                    borderLeftColor: colors.secondaryText,
                    ml: 1,
                  }}
                />
              </Box>
              <Typography sx={{ color: colors.secondaryText }}>
                Video coming soon
              </Typography>
            </Box>
          </Box>
        </ContentCard>
      </PublicPageWrapper>
    </MuiPublicLayout>
  );
}
