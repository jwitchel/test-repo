'use client';

import { Typography, Stack, Divider, List, ListItem, ListItemText } from '@mui/material';
import { MuiPublicLayout, PageHeader, PublicPageWrapper, ContentCard, useContentColors } from '@/components/mui';
import { usePageTitle } from '@/hooks/use-page-title';

export default function LegalPage() {
  usePageTitle('Legal');
  const colors = useContentColors();

  return (
    <MuiPublicLayout>
      <PublicPageWrapper backgroundImage="/images/legal-bg.jpg">
        <PageHeader title="Legal" centered />

        <Stack spacing={4}>
          <ContentCard title="Terms of Service">
            <Stack spacing={3}>
              <Typography sx={{ color: colors.secondaryText }}>
                By using Time to Just, you agree to these terms. Please read them carefully.
              </Typography>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  1. Service Description
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  Time to Just provides AI-powered email assistance, including draft generation, email
                  organization, and spam detection. The service requires access to your email account
                  to function.
                </Typography>
              </div>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  2. User Responsibilities
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  You are responsible for maintaining the security of your account credentials and for
                  all activities that occur under your account. You agree to use the service only for
                  lawful purposes.
                </Typography>
              </div>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  3. Service Availability
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  We strive to maintain high availability but do not guarantee uninterrupted service.
                  We may modify or discontinue features with reasonable notice.
                </Typography>
              </div>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  4. Limitation of Liability
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  Time to Just is provided &quot;as is&quot; without warranties. We are not liable for
                  any indirect, incidental, or consequential damages arising from your use of the
                  service.
                </Typography>
              </div>
            </Stack>
          </ContentCard>

          <ContentCard title="Privacy Policy">
            <Stack spacing={3}>
              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Data We Collect
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  We collect email content and metadata necessary to provide our services, including
                  sender/recipient information, subject lines, and message bodies. We also collect
                  account information you provide during registration.
                </Typography>
              </div>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  How We Use Your Data
                </Typography>
                <Typography sx={{ color: colors.secondaryText, mb: 1 }}>
                  Your email data is used exclusively to:
                </Typography>
                <List dense disablePadding sx={{ pl: 2 }}>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Analyze your writing style to generate personalized drafts"
                      primaryTypographyProps={{ sx: { color: colors.secondaryText } }}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Categorize and organize incoming emails"
                      primaryTypographyProps={{ sx: { color: colors.secondaryText } }}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Detect spam and unwanted messages"
                      primaryTypographyProps={{ sx: { color: colors.secondaryText } }}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Improve our AI models (using anonymized, aggregated data only)"
                      primaryTypographyProps={{ sx: { color: colors.secondaryText } }}
                    />
                  </ListItem>
                </List>
              </div>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Data Security
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  We implement industry-standard security measures including encryption at rest and in
                  transit, secure OAuth authentication, and regular security audits. We never store
                  your email password when using OAuth.
                </Typography>
              </div>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Data Sharing
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  We do not sell your personal data. We may share data with service providers who
                  assist in operating our service, subject to strict confidentiality agreements.
                </Typography>
              </div>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Your Rights
                </Typography>
                <Typography sx={{ color: colors.secondaryText }}>
                  You may request access to, correction of, or deletion of your personal data at any
                  time by contacting us. Upon account deletion, we will remove your data within 30
                  days.
                </Typography>
              </div>
            </Stack>
          </ContentCard>

          <ContentCard title="Cookie Policy">
            <Typography sx={{ color: colors.secondaryText }}>
              We use essential cookies to maintain your session and remember your preferences. We
              do not use tracking cookies or third-party advertising cookies.
            </Typography>
          </ContentCard>

          <Divider />
          <Typography sx={{ color: colors.secondaryText, textAlign: 'center' }}>
            Last updated: December 2024
          </Typography>
        </Stack>
      </PublicPageWrapper>
    </MuiPublicLayout>
  );
}
