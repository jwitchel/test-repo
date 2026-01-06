'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Container,
  TextField,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/lib/auth-context';
import { useMuiToast } from '@/hooks/use-mui-toast';
import { MuiPublicLayout, AuthCardHeader, StyledLink } from '@/components/mui';
import { usePageTitle } from '@/hooks/use-page-title';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignInFormData = z.infer<typeof signInSchema>;

export default function MuiSignInPage() {
  usePageTitle('Sign In');
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user, signIn } = useAuth();
  const { success, error: showError } = useMuiToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const onSubmit = async (data: SignInFormData) => {
    setIsSubmitting(true);
    try {
      await signIn(data.email, data.password);
      success('Welcome back!');
      router.refresh();
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MuiPublicLayout>
      <Box
        sx={{
          py: 8,
          minHeight: 'calc(100vh - 200px)',
          display: 'flex',
          alignItems: 'center',
          backgroundImage: 'url(/images/auth-bg.jpg)',
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
        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" justifyContent="center">
            <Card sx={{ width: '100%', maxWidth: 400, backdropFilter: 'blur(8px)' }}>
            <CardContent sx={{ p: 4 }}>
              <AuthCardHeader
                title="Sign In"
                description="Enter your email and password to access your account"
              />

              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={3}>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Email"
                        type="email"
                        placeholder="name@example.com"
                        fullWidth
                        disabled={isSubmitting}
                        error={!!errors.email}
                        helperText={errors.email?.message}
                      />
                    )}
                  />
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Password"
                        type="password"
                        fullWidth
                        disabled={isSubmitting}
                        error={!!errors.password}
                        helperText={errors.password?.message}
                      />
                    )}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="body2" sx={{ mt: 3 }}>
                Don&apos;t have an account?{' '}
                <StyledLink href="/signup">
                  Sign up
                </StyledLink>
              </Typography>
            </CardContent>
          </Card>
          </Box>
        </Container>
      </Box>
    </MuiPublicLayout>
  );
}
