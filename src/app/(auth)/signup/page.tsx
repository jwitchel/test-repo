'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Divider,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/lib/auth-context';
import { getAuthErrorMessage } from '@/lib/auth-client';
import { useMuiToast } from '@/hooks/use-mui-toast';
import { MuiPublicLayout, AuthCardHeader, StyledLink } from '@/components/mui';
import { usePageTitle } from '@/hooks/use-page-title';

const signUpSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function MuiSignUpPage() {
  usePageTitle('Sign Up');
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user, signUp, signInWithGoogle } = useAuth();
  const { success, error: showError } = useMuiToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Handle error query params from OAuth redirects
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      showError(getAuthErrorMessage(error));
      // Clean up the URL
      router.replace('/signup', { scroll: false });
    }
  }, [searchParams, showError, router]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    try {
      // Only pass name if it has a value
      await signUp(data.email, data.password, data.name || undefined);
      success('Account created successfully!');
      router.refresh();
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-up failed';
      showError(message);
      setIsGoogleLoading(false);
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
                title="Create Account"
                description="Enter your information to create a new account"
              />

              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={3}>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Name (optional)"
                        placeholder="John Doe"
                        fullWidth
                        disabled={isSubmitting}
                      />
                    )}
                  />
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
                  <Controller
                    name="confirmPassword"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Confirm Password"
                        type="password"
                        fullWidth
                        disabled={isSubmitting}
                        error={!!errors.confirmPassword}
                        helperText={errors.confirmPassword?.message}
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
                    {isSubmitting ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </Stack>
              </Box>

              <Divider sx={{ my: 3 }}>or</Divider>

              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleSignUp}
                disabled={isSubmitting || isGoogleLoading}
              >
                {isGoogleLoading ? 'Connecting...' : 'Sign up with Google'}
              </Button>

              <Typography variant="body2" sx={{ mt: 3 }}>
                Already have an account?{' '}
                <StyledLink href="/signin">
                  Sign in
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
