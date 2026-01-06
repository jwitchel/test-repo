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
    question: 'Will it actually sound like me?',
    answer: 'Yes. We learn how you write to each person—your spouse, your team, your clients. Each relationship gets its own style. Not a robot pretending to be you. You.',
  },
  {
    question: 'Will it send emails without asking?',
    answer: 'Never. Drafts go to your Drafts folder. You review. You send. You stay in control.',
  },
  {
    question: 'Is my data safe?',
    answer: 'Yes. Gmail connects via OAuth—we never see your password. Your emails train your model, not ours. Want maximum privacy? Run the AI locally with Ollama. Your emails never leave your machine.',
  },
  {
    question: 'Which email providers work?',
    answer: 'Gmail, Outlook, Yahoo, iCloud, Fastmail, ProtonMail—anything with IMAP. If a desktop email client can access it, we can too.',
  },
  {
    question: 'How long does setup take?',
    answer: 'Five minutes. Connect your email, pick an AI provider, wait while we learn from your sent messages. After that, drafts appear automatically.',
  },
  {
    question: "What if I don't like a draft?",
    answer: "Edit it. That's the point. Drafts are starting points. And when you edit, we learn. Future drafts get better.",
  },
  {
    question: 'What about junk email?',
    answer: 'Flight confirmations, shipping updates, bank alerts—filed automatically, no draft needed. Spam from strangers caught. Only real emails from real people get drafts.',
  },
  {
    question: 'Multiple email accounts?',
    answer: 'Yes. Each account learns its own style. Work stays professional. Personal stays casual.',
  },
  {
    question: 'Which AI does it use?',
    answer: 'Your choice. OpenAI, Anthropic, Google, or Ollama for local. Switch anytime. Use your own API keys. No lock-in.',
  },
  {
    question: 'What does it cost?',
    answer: 'Free during early access. You pay for your own AI usage—or use Ollama and pay nothing. No surprises.',
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
                Try Free
              </Button>
            </Stack>
          </Stack>
        </ContentCard>
      </PublicPageWrapper>
    </MuiPublicLayout>
  );
}
