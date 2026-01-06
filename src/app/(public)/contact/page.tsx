'use client';

import { Typography, Stack, Link } from '@mui/material';
import { MuiPublicLayout, PageHeader, PublicPageWrapper, ContentCard, useContentColors } from '@/components/mui';
import { usePageTitle } from '@/hooks/use-page-title';

export default function ContactPage() {
  usePageTitle('Contact');
  const colors = useContentColors();

  return (
    <MuiPublicLayout>
      <PublicPageWrapper>
        <PageHeader title="Contact" centered />

        <Stack spacing={4}>
          <ContentCard title="Email Support">
            <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8, mb: 2 }}>
              For general inquiries, technical support, or account issues.
            </Typography>
            <Link href="mailto:support@timetojust.com" underline="hover" sx={{ fontWeight: 500 }}>
              support@timetojust.com
            </Link>
          </ContentCard>

          <ContentCard title="Feedback">
            <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8, mb: 2 }}>
              Have ideas to improve Time to Just? We read every message.
            </Typography>
            <Link href="mailto:feedback@timetojust.com" underline="hover" sx={{ fontWeight: 500 }}>
              feedback@timetojust.com
            </Link>
          </ContentCard>

          <Typography sx={{ color: colors.secondaryText, textAlign: 'center' }}>
            We typically respond within 24-48 hours.{' '}
            Check our <Link href="/faq" underline="hover">FAQ</Link> for quick answers.
          </Typography>
        </Stack>
      </PublicPageWrapper>
    </MuiPublicLayout>
  );
}
