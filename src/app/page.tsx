'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
import { useAuth } from '@/lib/auth-context';
import { MuiPublicLayout } from '@/components/mui';

const rotatingWords = ['Think', 'Breathe', 'Work', 'Plan', 'Run', 'Smile', 'Relax', 'Sleep', 'Move', 'Laugh', 'Build', 'Design'];
const wordColors = ['#93c5fd', '#a5b4fc', '#c4b5fd', '#f9a8d4', '#fdba74', '#fcd34d', '#86efac', '#67e8f9'];

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [wordIndex, setWordIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsVisible(true);
      }, 500);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
      <Box
        sx={{
          py: { xs: 10, md: 14 },
          backgroundImage: 'url(/images/hero-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.78)',
          },
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.25rem', md: '3.75rem' },
                fontWeight: 700,
                mb: 3,
                lineHeight: 1.2,
                letterSpacing: '-0.025em',
                background: colors.heroGradient,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Get five hours back every week.
            </Typography>
            <Typography
              sx={{
                mb: 5,
                color: colors.secondaryText,
                fontSize: { xs: '1.1rem', md: '1.25rem' },
                lineHeight: 1.8,
                maxWidth: 620,
                mx: 'auto',
              }}
            >
              Inbox handled. Voice intact. Drafts that sound like you, not like AI.
              <br />
              Noise filtered. Spam caught. Time to Just{' '}
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  minWidth: 70,
                  borderBottom: '2px solid',
                  borderColor: wordColors[wordIndex % wordColors.length],
                  pb: 0.25,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    color: wordColors[wordIndex % wordColors.length],
                    opacity: isVisible ? 1 : 0,
                    transition: 'opacity 0.4s ease-in-out',
                    fontWeight: 600,
                  }}
                >
                  {rotatingWords[wordIndex]}
                </Box>
              </Box>
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
                Try Free
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

      {/* We learn your voice */}
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
                We learn your voice.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  mb: 2,
                }}
              >
                Not just your tone. How you write to your spouse.
                How you write to your board. How you write to your team.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                }}
              >
                Each relationship, learned separately.
                So every reply sounds like you wrote it—because it learned from you.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Stack spacing={2}>
                <Paper sx={{ p: 2.5, border: `1px solid ${colors.cardBorder}` }}>
                  <Typography variant="caption" sx={{ color: colors.secondaryText, display: 'block', mb: 1 }}>
                    To your spouse
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.9rem' }}>
                    running late start without me -j
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2.5, border: `1px solid ${colors.cardBorder}` }}>
                  <Typography variant="caption" sx={{ color: colors.secondaryText, display: 'block', mb: 1 }}>
                    To your direct report
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.9rem' }}>
                    Good call on the timeline. Run with it—let me know if legal pushes back.
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2.5, border: `1px solid ${colors.cardBorder}` }}>
                  <Typography variant="caption" sx={{ color: colors.secondaryText, display: 'block', mb: 1 }}>
                    To an investor
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.9rem' }}>
                    Great speaking Thursday. I&apos;ll send the deck by EOD—happy to walk through the model next week.
                  </Typography>
                </Paper>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* We draft your replies */}
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
                We draft your replies.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  mb: 2,
                }}
              >
                When someone emails you, a draft appears in your folder.
                It sounds like you. Edit if you want. Send when ready.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                }}
              >
                We never send anything without you.
                You stay in control.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Paper
                sx={{
                  p: 3,
                  border: `1px solid ${colors.cardBorder}`,
                  bgcolor: colors.cardBg,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: isDark ? steelBlue[400] : steelBlue[600],
                    }}
                  />
                  <Typography variant="caption" sx={{ color: colors.secondaryText, fontWeight: 600 }}>
                    Draft ready
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: colors.secondaryText, mb: 1, fontSize: '0.85rem' }}>
                  <strong>To:</strong> Sarah Miller
                </Typography>
                <Typography variant="body2" sx={{ color: colors.secondaryText, mb: 2, fontSize: '0.85rem' }}>
                  <strong>Re:</strong> Thursday meeting
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.7, fontSize: '0.9rem' }}>
                  Works for me. I&apos;ll send the agenda tomorrow—let me know if there&apos;s anything you want to add.
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* We filter the noise */}
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
                We filter the noise.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  mb: 2,
                }}
              >
                Flight confirmations. Shipping updates. The seven emails
                that follow one booking.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                }}
              >
                None of them are spam. All of them are noise.
                Filed automatically—no draft, no clutter.
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
                  Auto-filed
                </Typography>
                <Stack spacing={1}>
                  {[
                    { logo: '/logos/kayak.png', text: 'Your trip to Chicago is booked' },
                    { logo: '/logos/united.png', text: 'Confirmation #UA82931' },
                    { logo: '/logos/united.png', text: 'Your e-receipt' },
                    { logo: '/logos/united.png', text: 'Pre-order your meals' },
                    { logo: '/logos/united.png', text: 'Stay connected with WiFi' },
                    { logo: '/logos/kayak.png', text: 'Need a rental car?' },
                  ].map((email, i) => (
                    <Stack
                      key={i}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{
                        py: 0.75,
                        px: 1.5,
                        bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                        borderRadius: 0.5,
                      }}
                    >
                      <Image src={email.logo} alt="" width={16} height={16} />
                      <Typography variant="body2" sx={{ color: colors.secondaryText, fontSize: '0.8rem' }}>
                        {email.text}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* We catch what spam filters miss */}
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
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                  lineHeight: 1.2,
                }}
              >
                We catch that last 10% of spam.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  mb: 2,
                }}
              >
                The &ldquo;quick question&rdquo; from someone you&apos;ve never met.
                The &ldquo;following up&rdquo; on a conversation that never happened.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                }}
              >
                If you&apos;ve never replied to them and they&apos;re selling something,
                we catch it. Your inbox stays focused on people who matter.
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
                  Caught
                </Typography>
                <Stack spacing={1}>
                  {[
                    'Quick question about your tech stack',
                    'Following up on my last email',
                    'Congrats on the funding round!',
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

      {/* We know the difference */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          backgroundImage: 'url(/images/difference-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.78)',
          },
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
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
                We know the difference.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  mb: 2,
                }}
              >
                Some emails need action. Some just need to get out of the way.
              </Typography>
              <Typography
                sx={{
                  color: colors.secondaryText,
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                }}
              >
                A signature request goes to your inbox.
                An order status update gets filed.
                You focus on what actually needs you.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Stack spacing={2}>
                <Paper
                  sx={{
                    p: 2.5,
                    border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(5, 150, 105, 0.3)'}`,
                    bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: isDark ? '#10b981' : '#059669', display: 'block', mb: 1, fontWeight: 600 }}>
                    Needs action
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Image src="/logos/docusign.png" alt="DocuSign" width={20} height={20} />
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      Complete with DocuSign: Non-Disclosure Agreement
                    </Typography>
                  </Stack>
                </Paper>
                <Paper
                  sx={{
                    p: 2.5,
                    border: `1px solid ${isDark ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.35)'}`,
                    bgcolor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.12)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: colors.amberText, display: 'block', mb: 1, fontWeight: 600 }}>
                    Auto-filed
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Image src="/logos/potterybarn.svg" alt="Pottery Barn" width={20} height={20} />
                    <Typography variant="body2" sx={{ color: isDark ? '#e2e8f0' : '#334155', fontSize: '0.9rem' }}>
                      Pottery Barn: Your order has shipped
                    </Typography>
                  </Stack>
                </Paper>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Final CTA */}
      <Box
        sx={{
          py: { xs: 10, md: 14 },
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
                mb: 2,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                lineHeight: 1.2,
              }}
            >
              Get five hours back every week.
            </Typography>
            <Typography
              sx={{
                mb: 4,
                opacity: 0.8,
                fontSize: '1rem',
                textAlign: 'center',
              }}
            >
              Connect your email. We learn your voice. Drafts appear.
            </Typography>
            <Stack spacing={2} alignItems="center">
              <Button
                component={Link}
                href="/signup"
                variant="contained"
                size="large"
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
                Try Free
              </Button>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                No credit card required
              </Typography>
            </Stack>
          </Box>
        </Container>
      </Box>
    </MuiPublicLayout>
  );
}
