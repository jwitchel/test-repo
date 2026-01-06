'use client';

import Link from 'next/link';
import { Typography, Stack, Button } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { MuiPublicLayout, PageHeader, PublicPageWrapper, ContentCard, useContentColors } from '@/components/mui';
import { usePageTitle } from '@/hooks/use-page-title';

export default function AboutPage() {
  usePageTitle('About');
  const colors = useContentColors();

  return (
    <MuiPublicLayout>
      <PublicPageWrapper backgroundImage="/images/auth-bg.jpg">
        <PageHeader title="About" centered />

        <ContentCard>
          <Stack spacing={5}>
            <Typography sx={{ color: colors.secondaryText, fontSize: '1.1rem', lineHeight: 1.9 }}>
              Email used to feel personal. Then we got busy. Then AI showed up. And suddenly
              everyone&apos;s emails started sounding the same—polished, professional, and completely
              soulless. &ldquo;I hope this email finds you well.&rdquo; &ldquo;Per my last email.&rdquo;
              &ldquo;Please don&apos;t hesitate to reach out.&rdquo;
            </Typography>

            <Typography sx={{ color: colors.secondaryText, fontSize: '1.1rem', lineHeight: 1.9 }}>
              We built Time to Just because we wanted something different.
            </Typography>

            <div>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                The idea is simple
              </Typography>
              <Typography sx={{ color: colors.secondaryText, fontSize: '1.1rem', lineHeight: 1.9 }}>
                You already know how to write good emails. You&apos;ve been doing it for years.
                You write differently to different people—casual with your spouse, direct with your
                team, careful with clients. That&apos;s not inconsistency. That&apos;s emotional intelligence.
                So instead of teaching you how to write like an AI, we taught the AI how to write like you.
              </Typography>
            </div>

            <div>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                What we believe
              </Typography>
              <Stack spacing={2}>
                <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8 }}>
                  <strong>Email is personal.</strong> The people in your inbox have relationships with
                  you, not your AI. They deserve to hear your voice, even when you&apos;re busy.
                </Typography>
                <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8 }}>
                  <strong>Humans should stay in control.</strong> We create drafts. You send them.
                  Always. Email is too important to fully automate.
                </Typography>
                <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8 }}>
                  <strong>Transparency matters.</strong> You should know why we did what we did.
                  No black boxes. No unexplainable decisions.
                </Typography>
                <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8 }}>
                  <strong>You own your data.</strong> Your writing style is yours.
                  Your emails train your model, not ours. Want to run everything locally? You can.
                </Typography>
              </Stack>
            </div>

            <div>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                What we don&apos;t do
              </Typography>
              <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8 }}>
                We don&apos;t try to be everything. No calendar management. No meeting transcription.
                No chat interfaces. We do one thing: help you write emails that sound like you.
                That&apos;s it.
              </Typography>
            </div>

            <Stack spacing={2} alignItems="center" sx={{ pt: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Try it
              </Typography>
              <Typography sx={{ color: colors.secondaryText }}>
                Connect your email. In a few minutes, you&apos;ll see the difference.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  component={Link}
                  href="/signup"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardIcon />}
                >
                  Get Started Free
                </Button>
                <Button
                  component={Link}
                  href="/demo"
                  variant="outlined"
                  size="large"
                >
                  See How It Works
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </ContentCard>
      </PublicPageWrapper>
    </MuiPublicLayout>
  );
}
