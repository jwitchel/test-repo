'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  CircularProgress,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAuth } from '@/lib/auth-context';
import { MuiPublicLayout } from '@/components/mui';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const steelBlue = {
    800: '#0B2648',
    700: '#1e4577',
    600: '#2d5a9a',
    500: '#3b6fb6',
    400: '#5985c1',
  };

  const colors = {
    heroGradient: isDark
      ? `linear-gradient(135deg, #f8fafc 0%, #f8fafc 60%, ${steelBlue[400]} 100%)`
      : `linear-gradient(135deg, ${steelBlue[800]} 0%, ${steelBlue[800]} 60%, ${steelBlue[500]} 100%)`,
    secondaryText: isDark ? '#94a3b8' : '#64748b',
    cardBg: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 0.8)',
    cardBorder: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.06)',
    amberBg: isDark ? 'rgba(251, 191, 36, 0.08)' : 'rgba(251, 191, 36, 0.06)',
    amberBorder: isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.25)',
    amberText: isDark ? '#fbbf24' : '#b45309',
    redBg: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
    redBorder: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
    redText: isDark ? '#fca5a5' : '#dc2626',
  };

  return (
    <MuiPublicLayout>
      {/* Hero */}
      <Box sx={{ py: { xs: 10, md: 16 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.25rem', md: '4rem' },
                fontWeight: 700,
                mb: 3,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                background: colors.heroGradient,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Inbox handled.
              <br />
              Voice intact.
            </Typography>
            <Typography
              sx={{
                mb: 5,
                color: colors.secondaryText,
                fontSize: { xs: '1.1rem', md: '1.25rem' },
                lineHeight: 1.6,
                maxWidth: 520,
                mx: 'auto',
              }}
            >
              Email that actually sounds like you.
              Not like a robot pretending to be you.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
            >
              <Button
                component={Link}
                href="/signup"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: isDark
                    ? `linear-gradient(135deg, ${steelBlue[500]} 0%, #6366f1 100%)`
                    : `linear-gradient(135deg, ${steelBlue[800]} 0%, ${steelBlue[600]} 100%)`,
                  boxShadow: isDark
                    ? '0 4px 14px rgba(89, 133, 193, 0.35)'
                    : '0 4px 14px rgba(11, 38, 72, 0.35)',
                }}
              >
                Try It Free
              </Button>
              <Button
                component={Link}
                href="/demo"
                size="large"
                sx={{
                  px: 3.5,
                  py: 1.5,
                  fontSize: '1rem',
                  color: isDark ? '#cbd5e1' : '#334155',
                  border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(71, 85, 105, 0.2)'}`,
                }}
              >
                How It Works
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* The Problem - They've tried AI */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: colors.cardBg }}>
        <Container maxWidth="sm">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 600,
                mb: 4,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                lineHeight: 1.2,
              }}
            >
              You&apos;ve tried AI email.
            </Typography>
            <Typography
              sx={{
                color: colors.secondaryText,
                fontSize: '1.1rem',
                lineHeight: 1.8,
                mb: 3,
              }}
            >
              The drafts sounded helpful at first. Then a board member
              replied with a slightly confused tone. A direct report asked
              if everything was okay. People noticed.
            </Typography>
            <Typography
              sx={{
                color: colors.secondaryText,
                fontSize: '1.1rem',
                lineHeight: 1.8,
              }}
            >
              You&apos;ve been on the other side too. You&apos;ve received emails
              that felt off—overly formal, weirdly generic—and you trusted
              that person a little less.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* The Insight - You write differently to different people */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 600,
                mb: 2,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                lineHeight: 1.2,
              }}
            >
              You don&apos;t write the same way to everyone.
            </Typography>
            <Typography
              sx={{
                color: colors.secondaryText,
                fontSize: '1.1rem',
                maxWidth: 600,
                mx: 'auto',
              }}
            >
              That&apos;s not inconsistency. That&apos;s judgment.
              Generic AI doesn&apos;t have it. We learn it.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            {/* Wife example */}
            <Paper sx={{ p: 3, border: `1px solid ${colors.cardBorder}` }}>
              <Typography variant="overline" sx={{ color: colors.secondaryText, display: 'block', mb: 2 }}>
                To your spouse
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: colors.redBg,
                  border: `1px solid ${colors.redBorder}`,
                }}
              >
                <Typography variant="caption" sx={{ color: colors.redText, display: 'block', mb: 0.5 }}>
                  Generic AI
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: colors.secondaryText, fontSize: '0.85rem' }}>
                  Dear Sarah, I wanted to inform you that I will be running late this evening. Best Wishes, John
                </Typography>
              </Paper>
              <Paper sx={{ p: 2, border: `1px solid ${colors.cardBorder}` }}>
                <Typography variant="caption" sx={{ color: colors.secondaryText, display: 'block', mb: 0.5 }}>
                  Time to Just
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
                  running late start without me -j
                </Typography>
              </Paper>
            </Paper>

            {/* Teammate example */}
            <Paper sx={{ p: 3, border: `1px solid ${colors.cardBorder}` }}>
              <Typography variant="overline" sx={{ color: colors.secondaryText, display: 'block', mb: 2 }}>
                To your direct report
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: colors.redBg,
                  border: `1px solid ${colors.redBorder}`,
                }}
              >
                <Typography variant="caption" sx={{ color: colors.redText, display: 'block', mb: 0.5 }}>
                  Generic AI
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: colors.secondaryText, fontSize: '0.85rem' }}>
                  Thank you for your update. I appreciate your diligence on this matter. Please proceed as discussed.
                </Typography>
              </Paper>
              <Paper sx={{ p: 2, border: `1px solid ${colors.cardBorder}` }}>
                <Typography variant="caption" sx={{ color: colors.secondaryText, display: 'block', mb: 0.5 }}>
                  Time to Just
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
                  Good call on the timeline. Run with it—let me know if legal pushes back.
                </Typography>
              </Paper>
            </Paper>

            {/* Investor example */}
            <Paper sx={{ p: 3, border: `1px solid ${colors.cardBorder}` }}>
              <Typography variant="overline" sx={{ color: colors.secondaryText, display: 'block', mb: 2 }}>
                To a prospective investor
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: colors.redBg,
                  border: `1px solid ${colors.redBorder}`,
                }}
              >
                <Typography variant="caption" sx={{ color: colors.redText, display: 'block', mb: 0.5 }}>
                  Generic AI
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: colors.secondaryText, fontSize: '0.85rem' }}>
                  Thank you for your interest in our company. We would be delighted to schedule a meeting at your earliest convenience.
                </Typography>
              </Paper>
              <Paper sx={{ p: 2, border: `1px solid ${colors.cardBorder}` }}>
                <Typography variant="caption" sx={{ color: colors.secondaryText, display: 'block', mb: 0.5 }}>
                  Time to Just
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
                  Great speaking Thursday. I&apos;ll send the deck by EOD—happy to walk through the model next week if useful.
                </Typography>
              </Paper>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* The Noise Problem - Legitimate but noisy */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: colors.cardBg }}>
        <Container maxWidth="md">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 4, md: 6 }}
            alignItems="center"
          >
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 600,
                  mb: 3,
                  fontSize: { xs: '1.75rem', md: '2rem' },
                  lineHeight: 1.2,
                }}
              >
                Legitimate emails that don&apos;t need replies.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  mb: 2,
                }}
              >
                You book a flight. Then comes the confirmation. The receipt.
                Pre-order meals. Pre-order WiFi. Rental car offer. Hotel suggestion.
                Seven emails from one transaction.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                }}
              >
                None of them are spam. All of them are noise.
                We detect these instantly and file them to FYI—no draft, no LLM cost, no clutter.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Paper
                sx={{
                  p: 2,
                  border: `1px solid ${colors.amberBorder}`,
                  bgcolor: colors.amberBg,
                }}
              >
                <Typography variant="caption" sx={{ color: colors.amberText, display: 'block', mb: 1.5, fontWeight: 600 }}>
                  Auto-filed to FYI
                </Typography>
                <Stack spacing={1}>
                  {[
                    'Kayak: Your trip to Chicago is booked',
                    'United: Confirmation #UA82931',
                    'United: Your e-receipt',
                    'United: Pre-order your meals',
                    'United: Stay connected with WiFi',
                    'Kayak: Need a rental car?',
                    'Kayak: Hotels near O\'Hare',
                  ].map((email, i) => (
                    <Typography
                      key={i}
                      variant="body2"
                      sx={{
                        color: colors.secondaryText,
                        fontSize: '0.8rem',
                        py: 0.75,
                        px: 1.5,
                        bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                        borderRadius: 0.5,
                      }}
                    >
                      {email}
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* The Spam Problem - Last 10% */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Stack
            direction={{ xs: 'column', md: 'row-reverse' }}
            spacing={{ xs: 4, md: 6 }}
            alignItems="center"
          >
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 600,
                  mb: 3,
                  fontSize: { xs: '1.75rem', md: '2rem' },
                  lineHeight: 1.2,
                }}
              >
                The last 10% of spam.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  mb: 2,
                }}
              >
                Your spam filter catches most of it. But every day, a few get through.
                The &ldquo;quick question&rdquo; from someone you&apos;ve never met.
                The &ldquo;following up&rdquo; on a conversation that never happened.
                The agency that &ldquo;noticed your company.&rdquo;
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                }}
              >
                If you&apos;ve never replied to them, and they&apos;re selling something,
                we catch it. Your inbox stays focused on people who actually matter.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Paper
                sx={{
                  p: 2,
                  border: `1px solid ${colors.redBorder}`,
                  bgcolor: colors.redBg,
                }}
              >
                <Typography variant="caption" sx={{ color: colors.redText, display: 'block', mb: 1.5, fontWeight: 600 }}>
                  Caught and filed
                </Typography>
                <Stack spacing={1}>
                  {[
                    'Quick question about your tech stack',
                    'Following up on my last email',
                    'Congrats on the funding round!',
                    'I noticed your company is hiring...',
                    'Would love 15 minutes of your time',
                    'Saw your LinkedIn post and thought...',
                  ].map((email, i) => (
                    <Typography
                      key={i}
                      variant="body2"
                      sx={{
                        color: colors.secondaryText,
                        fontSize: '0.8rem',
                        py: 0.75,
                        px: 1.5,
                        bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                        borderRadius: 0.5,
                        textDecoration: 'line-through',
                        opacity: 0.7,
                      }}
                    >
                      {email}
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* What We Do */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: colors.cardBg }}>
        <Container maxWidth="sm">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 600,
                mb: 4,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                lineHeight: 1.2,
              }}
            >
              We learn how you write.
              <br />
              To each and every one.
            </Typography>
            <Typography
              sx={{
                color: colors.secondaryText,
                fontSize: '1.1rem',
                lineHeight: 1.8,
                mb: 3,
              }}
            >
              Time to Just reads your sent emails and learns your voice—
              not just what you say, but how you say it, and to whom.
            </Typography>
            <Typography
              sx={{
                color: colors.secondaryText,
                fontSize: '1.1rem',
                lineHeight: 1.8,
              }}
            >
              When a real email arrives from a real person, we draft a reply
              that sounds like you wrote it. Your board member hears from you.
              Your team hears from you. Not from a bot.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* How It Works */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
              }}
            >
              Simple.
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={4}
            justifyContent="center"
          >
            {[
              { num: '1', text: 'Connect your email' },
              { num: '2', text: 'We learn your voice' },
              { num: '3', text: 'Drafts appear, ready to send' },
            ].map((step) => (
              <Box key={step.num} sx={{ textAlign: 'center', flex: 1 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    bgcolor: isDark ? steelBlue[700] : steelBlue[600],
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  {step.num}
                </Box>
                <Typography sx={{ fontWeight: 500 }}>
                  {step.text}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Box sx={{ textAlign: 'center', mt: 5 }}>
            <Typography variant="body2" sx={{ color: colors.secondaryText }}>
              Drafts go to your drafts folder. You review, edit if needed, and send.
              <br />
              We never send anything without you.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Final CTA */}
      <Box
        sx={{
          py: { xs: 12, md: 16 },
          bgcolor: isDark ? steelBlue[800] : steelBlue[700],
          color: '#fff',
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 600,
                mb: 3,
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                lineHeight: 1.2,
              }}
            >
              Email that sounds like you.
              <br />
              Because relationships depend on it.
            </Typography>
            <Typography
              sx={{
                mb: 5,
                opacity: 0.9,
                fontSize: '1.1rem',
                lineHeight: 1.6,
              }}
            >
              Free to try. No credit card required.
            </Typography>
            <Button
              component={Link}
              href="/signup"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: 5,
                py: 1.75,
                fontSize: '1.1rem',
                fontWeight: 600,
                bgcolor: '#fff',
                color: steelBlue[800],
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                },
              }}
            >
              Get Started
            </Button>
          </Box>
        </Container>
      </Box>
    </MuiPublicLayout>
  );
}
