'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { useForm } from 'react-hook-form';
import { TextFieldElement, SelectElement, SwitchElement } from 'react-hook-form-mui';
import {
  Box,
  Card,
  CardContent,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Skeleton,
  Alert,
  Stack,
  useMediaQuery,
  List,
  ListItem,
  ListItemText,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import { useMuiToast } from '@/hooks/use-mui-toast';
import { useConfirm } from '@/components/confirm-dialog';
import { useAuth } from '@/lib/auth-context';
import { usePageTitle } from '@/hooks/use-page-title';
import { MuiAuthenticatedLayout } from '@/components/mui';
import { RegexTesterDialog, CommonPattern } from '@/components/regex-tester-dialog';

// Types
interface BotSender {
  id: string;
  email_pattern: string;
  domain: string;
  company_name: string;
  category: string;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

interface BotSendersResponse {
  rows: BotSender[];
  total: number;
}

interface BotSenderFormData {
  email_pattern: string;
  company_name: string;
  category: string;
  is_confirmed: boolean;
}

// Constants
const CATEGORIES = [
  { id: 'airlines', label: 'Airlines' },
  { id: 'banks', label: 'Banks' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'payments', label: 'Payments' },
  { id: 'shipping_logistics', label: 'Shipping & Logistics' },
  { id: 'saas_productivity', label: 'SaaS & Productivity' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'rideshare_delivery', label: 'Rideshare & Delivery' },
  { id: 'travel_hotels', label: 'Travel & Hotels' },
  { id: 'social_media', label: 'Social Media' },
  { id: 'developer_tools', label: 'Developer Tools' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'government', label: 'Government' },
  { id: 'education', label: 'Education' },
  { id: 'other', label: 'Other' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c.label])
);

const DEFAULT_FORM_DATA: BotSenderFormData = {
  email_pattern: '',
  company_name: '',
  category: 'other',
  is_confirmed: true,
};

// Common bot email patterns for testing
const BOT_COMMON_PATTERNS: CommonPattern[] = [
  { pattern: 'noreply@.*\\.example\\.com', desc: 'Subdomain no-reply' },
  { pattern: 'notifications@.*\\.example\\.com', desc: 'Subdomain notifications' },
  { pattern: 'receipts@example\\.com', desc: 'Receipts inbox' },
  { pattern: 'support@example\\.com', desc: 'Support inbox (exact match)' },
];

// Sample emails to test patterns against
const SAMPLE_BOT_EMAILS = `noreply@email.example.com
notifications@mail.example.com
receipts@example.com
support@example.com
marketing@promo.example.com`;

// DataGrid column definitions
const getColumns = (
  onEdit: (sender: BotSender) => void,
  onDelete: (sender: BotSender) => void
): GridColDef<BotSender>[] => [
  {
    field: 'category',
    headerName: 'Category',
    width: 130,
    valueGetter: (value: string) => CATEGORY_LABELS[value] ?? value,
  },
  { field: 'company_name', headerName: 'Company', flex: 1, minWidth: 120 },
  { field: 'email_pattern', headerName: 'Pattern', flex: 1.5, minWidth: 200 },
  { field: 'domain', headerName: 'Domain', width: 150 },
  {
    field: 'is_confirmed',
    headerName: 'Active',
    width: 100,
    renderCell: (params: GridRenderCellParams<BotSender>) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {params.value ? (
          <Chip label="Active" size="small" color="success" icon={<CheckCircleIcon />} />
        ) : (
          <Chip label="Pending" size="small" variant="outlined" />
        )}
      </Box>
    ),
  },
  {
    field: 'actions',
    headerName: 'Actions',
    width: 160,
    sortable: false,
    renderCell: (params: GridRenderCellParams<BotSender>) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <ButtonGroup size="small">
          <Button onClick={() => onEdit(params.row)}>Edit</Button>
          <Button color="error" onClick={() => onDelete(params.row)}>Delete</Button>
        </ButtonGroup>
      </Box>
    ),
  },
];

// Bot Sender Dialog Component
interface BotSenderDialogProps {
  open: boolean;
  onClose: () => void;
  sender?: BotSender | null;
  onSuccess: () => void;
}

function BotSenderDialog({ open, onClose, sender, onSuccess }: BotSenderDialogProps) {
  const isEdit = Boolean(sender);
  const [isSaving, setIsSaving] = useState(false);
  const [regexTesterOpen, setRegexTesterOpen] = useState(false);
  const { success, error: showError } = useMuiToast();

  const { control, handleSubmit, reset, watch, setValue } = useForm<BotSenderFormData>({
    defaultValues: DEFAULT_FORM_DATA,
  });

  const currentPattern = watch('email_pattern');

  const handleDialogEnter = () => {
    if (sender) {
      reset({
        email_pattern: sender.email_pattern,
        company_name: sender.company_name,
        category: sender.category,
        is_confirmed: sender.is_confirmed,
      });
    } else {
      reset(DEFAULT_FORM_DATA);
    }
  };

  const handleSetPattern = (pattern: string) => {
    setValue('email_pattern', pattern);
  };

  const onSubmit = async (formData: BotSenderFormData) => {
    setIsSaving(true);
    try {
      const url = isEdit ? `/api/bot-senders/${sender!.id}` : '/api/bot-senders';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        success(`Bot sender ${isEdit ? 'updated' : 'added'} successfully`);
        onClose();
        onSuccess();
      } else {
        showError(data.error || `Failed to ${isEdit ? 'update' : 'add'} bot sender`);
      }
    } catch {
      showError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
        slotProps={{ transition: { onEnter: handleDialogEnter } }}
      >
        <DialogTitle>{isEdit ? 'Edit' : 'Add'} Bot Sender</DialogTitle>
        <DialogContent>
          <DialogContentText mb={2}>
            {isEdit
              ? 'Update bot sender configuration'
              : 'Add a known automated email sender pattern. Only active entries are used for detection.'}
          </DialogContentText>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TextFieldElement
                  name="email_pattern"
                  control={control}
                  label="Email Pattern (regex)"
                  placeholder="e.g., noreply@.*\.example\.com"
                  rules={{ required: 'Email pattern is required' }}
                  fullWidth
                  slotProps={{
                    input: { style: { fontFamily: 'monospace', fontSize: '0.875rem' } },
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => setRegexTesterOpen(true)}
                  sx={{ mt: '8px !important', minWidth: 'auto', px: 2 }}
                >
                  Test
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Pattern must include @ followed by domain (e.g., noreply@example.com or .*@mail.example.com)
              </Typography>
            </Box>
            <TextFieldElement
              name="company_name"
              control={control}
              label="Company Name"
              placeholder="e.g., American Airlines"
              rules={{ required: 'Company name is required' }}
            />
            <SelectElement
              name="category"
              control={control}
              label="Category"
              options={CATEGORIES}
            />
            <SwitchElement
              name="is_confirmed"
              control={control}
              label="Active (used for detection)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit(onSubmit)}
            loading={isSaving}
          >
            {isEdit ? 'Save Changes' : 'Add Bot Sender'}
          </Button>
        </DialogActions>
      </Dialog>

      <RegexTesterDialog
        open={regexTesterOpen}
        onClose={() => setRegexTesterOpen(false)}
        onAddPattern={handleSetPattern}
        title="Test Bot Email Pattern"
        description="Test your regex pattern against sample bot email addresses."
        initialPattern={currentPattern}
        defaultTestText={SAMPLE_BOT_EMAILS}
        commonPatterns={BOT_COMMON_PATTERNS}
        testTextLabel="Sample Emails (one per line)"
        testTextRows={6}
        addButtonLabel="Use Pattern"
      />
    </>
  );
}

export default function BotSendersPage() {
  usePageTitle('Bot Senders');
  const { user, signOut } = useAuth();
  const isMobile = useMediaQuery('(max-width:899px)', { noSsr: true });

  // Toast notifications
  const { success, error: showError } = useMuiToast();

  // Confirmation dialog
  const showConfirm = useConfirm();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSender, setSelectedSender] = useState<BotSender | null>(null);

  // Server-side pagination state
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  // Build URL with query params for server-side pagination
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', paginationModel.page.toString());
    params.set('pageSize', paginationModel.pageSize.toString());
    if (searchTerm) params.set('search', searchTerm);
    if (categoryFilter) params.set('category', categoryFilter);
    if (activeFilter) params.set('active', activeFilter);
    return `/api/bot-senders?${params.toString()}`;
  }, [paginationModel.page, paginationModel.pageSize, searchTerm, categoryFilter, activeFilter]);

  // Data fetching with server-side pagination
  const { data, error, isLoading } = useSWR<BotSendersResponse>(buildUrl());

  const rows = data?.rows ?? [];
  const rowCount = data?.total ?? 0;

  const openAddDialog = () => {
    setSelectedSender(null);
    setDialogOpen(true);
  };

  const openEditDialog = (sender: BotSender) => {
    setSelectedSender(sender);
    setDialogOpen(true);
  };

  const handleDeleteClick = (sender: BotSender) => {
    showConfirm({
      title: 'Delete Bot Sender',
      description: `Are you sure you want to delete the pattern "${sender.email_pattern}"? This action cannot be undone.`,
      confirmationText: 'Delete',
      onConfirm: async () => {
        const response = await fetch(`/api/bot-senders/${sender.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (response.ok) {
          success('Bot sender deleted successfully');
          // Revalidate all bot-senders queries
          mutate((key: string) => typeof key === 'string' && key.startsWith('/api/bot-senders'));
        } else {
          const data = await response.json();
          showError(data.error || 'Failed to delete bot sender');
        }
      },
    });
  };

  // Show nothing while loading auth
  if (!user) return null;

  if (error) {
    return <Alert severity="error">Failed to load bot senders. Please try again later.</Alert>;
  }

  return (
    <MuiAuthenticatedLayout user={user} onSignOut={signOut}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <div>
          <Typography variant="h4">Bot Senders</Typography>
        </div>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
          Add Bot Sender
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            placeholder="Search by pattern or company..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPaginationModel(prev => ({ ...prev, page: 0 }));
            }}
            size="small"
            sx={{ minWidth: 250 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPaginationModel(prev => ({ ...prev, page: 0 }));
              }}
            >
              <MenuItem value="">All</MenuItem>
              {CATEGORIES.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Active</InputLabel>
            <Select
              value={activeFilter}
              label="Active"
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPaginationModel(prev => ({ ...prev, page: 0 }));
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Pending</MenuItem>
            </Select>
          </FormControl>
          {(searchTerm || categoryFilter || activeFilter) && (
            <Button
              variant="outlined"
              size="small"
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setActiveFilter('');
                setPaginationModel(prev => ({ ...prev, page: 0 }));
              }}
            >
              Clear Filters
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Loading State */}
      {isLoading && (
        <Paper>
          <Skeleton variant="rectangular" height={52} />
          <Skeleton variant="rectangular" height={52} sx={{ mt: 0.5 }} />
          <Skeleton variant="rectangular" height={52} sx={{ mt: 0.5 }} />
        </Paper>
      )}

      {/* Empty State */}
      {!isLoading && rows.length === 0 && (
        <Card>
          <CardContent sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" mb={2}>
              {rowCount === 0 && !searchTerm && !categoryFilter && !activeFilter
                ? 'No bot senders configured yet'
                : 'No bot senders match your filters'}
            </Typography>
            {rowCount === 0 && !searchTerm && !categoryFilter && !activeFilter && (
              <Button variant="contained" onClick={openAddDialog}>
                Add Bot Sender
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Senders List */}
      {!isLoading && rows.length > 0 && (
        isMobile ? (
          <Paper>
            <List disablePadding>
              {rows.map((sender, index) => (
                <ListItem
                  key={sender.id}
                  divider={index < rows.length - 1}
                  secondaryAction={
                    <>
                      <IconButton onClick={() => openEditDialog(sender)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton edge="end" onClick={() => handleDeleteClick(sender)}>
                        <DeleteIcon color="error" />
                      </IconButton>
                    </>
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {sender.email_pattern}
                        </Typography>
                        {sender.is_confirmed && (
                          <Chip label="Active" size="small" color="success" />
                        )}
                      </Box>
                    }
                    secondary={`${sender.company_name} • ${sender.domain} • ${CATEGORY_LABELS[sender.category] ?? sender.category}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        ) : (
          <Paper>
            <DataGrid
              rows={rows}
              columns={getColumns(openEditDialog, handleDeleteClick)}
              autoHeight
              disableRowSelectionOnClick
              paginationMode="server"
              rowCount={rowCount}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[10, 25, 50]}
              sx={{ border: 0 }}
            />
          </Paper>
        )
      )}

      {/* Bot Sender Dialog */}
      <BotSenderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        sender={selectedSender}
        onSuccess={() => mutate((key: string) => typeof key === 'string' && key.startsWith('/api/bot-senders'))}
      />
    </MuiAuthenticatedLayout>
  );
}
