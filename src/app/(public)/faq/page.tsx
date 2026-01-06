'use client';

import Link from 'next/link';
import {
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { MuiPublicLayout, PageHeader, PublicPageWrapper, ContentCard, useContentColors } from '@/components/mui';
import { usePageTitle } from '@/hooks/use-page-title';

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'Will the emails actually sound like me?',
    answer: 'Yes. We read your sent emails and learn how you write—to your spouse, your boss, your friends. Each relationship gets its own style. When you email your wife, it sounds like you emailing your wife. Not like a robot pretending to be you.',
  },
  {
    question: 'Will it send emails without asking?',
    answer: 'Never. Drafts go to your Drafts folder. You review them. You send them. We believe email is too important to automate completely. The human stays in the loop.',
  },
  {
    question: 'Is my email data safe?',
    answer: 'Yes. Gmail users connect via OAuth—we never see your password. Other providers use encrypted credentials. Your data trains your model, not a shared one. And if you want maximum privacy, run the AI locally with Ollama. Your emails never leave your machine.',
  },
  {
    question: 'What email providers work?',
    answer: 'Gmail, Outlook, Yahoo, iCloud, Fastmail, ProtonMail—anything that supports IMAP. If you can access your email from a desktop client, you can use Time to Just.',
  },
  {
    question: 'How long does setup take?',
    answer: 'About five minutes. Connect your email, pick an AI provider, and wait while we read your sent messages. After that, new emails automatically get drafts.',
  },
  {
    question: "What if I don't like a draft?",
    answer: "Edit it. That's the point. Drafts are starting points, not final products. And when you edit, we learn. Future drafts get better.",
  },
  {
    question: 'What about junk email?',
    answer: 'We catch it. Flight confirmations, shipping updates, bank alerts—these get filed automatically, no draft needed. Spam from strangers gets filtered. Only real emails from real people get drafts.',
  },
  {
    question: 'Can I use multiple email accounts?',
    answer: 'Yes. Each account learns its own style. Your work emails stay professional. Your personal emails stay casual.',
  },
  {
    question: 'Which AI does it use?',
    answer: 'Your choice. OpenAI, Anthropic, Google, or Ollama for local. Switch anytime. Use your own API keys. No lock-in.',
  },
  {
    question: 'What does it cost?',
    answer: 'Time to Just is free during early access. You pay for your own AI usage—or use Ollama and pay nothing. Costs are transparent. No surprises.',
  },
];

export default function FAQPage() {
  usePageTitle('FAQ');
  const colors = useContentColors();

  return (
    <MuiPublicLayout>
      <PublicPageWrapper backgroundImage="/images/auth-bg.jpg">
        <PageHeader title="Questions" centered />

        <Stack spacing={0}>
          {faqs.map((faq, index) => (
            <Accordion
              key={index}
              disableGutters
              sx={{
                bgcolor: colors.cardBg,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${colors.cardBorder}`,
                '&:not(:last-child)': {
                  borderBottom: 0,
                },
                '&::before': {
                  display: 'none',
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Typography sx={{ fontWeight: 500 }}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 3 }}>
                <Typography sx={{ color: colors.secondaryText, lineHeight: 1.8 }}>
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>

        <ContentCard sx={{ mt: 6 }}>
          <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Still have questions?
            </Typography>
            <Typography sx={{ color: colors.secondaryText }}>
              We read every email. (And yes, we use Time to Just to reply.)
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                component={Link}
                href="/contact"
                variant="outlined"
              >
                Contact Us
              </Button>
              <Button
                component={Link}
                href="/signup"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
              >
                Get Started Free
              </Button>
            </Stack>
          </Stack>
        </ContentCard>
      </PublicPageWrapper>
    </MuiPublicLayout>
  );
}
