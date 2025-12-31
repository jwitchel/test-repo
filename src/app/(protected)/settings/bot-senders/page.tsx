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

// Types
interface BotSender {
  id: string;
  email_address: string;
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
  email_address: string;
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
  email_address: '',
  company_name: '',
  category: 'other',
  is_confirmed: true,
};

// DataGrid column definitions
const getColumns = (
  onEdit: (sender: BotSender) => void,
  onDelete: (sender: BotSender) => void
): GridColDef<BotSender>[] => [
  {
    field: 'category',
    headerName: 'Category',
    width: 150,
    valueGetter: (value: string) => CATEGORY_LABELS[value] ?? value,
  },
  { field: 'company_name', headerName: 'Company', flex: 1, minWidth: 150 },
  { field: 'email_address', headerName: 'Email Address', flex: 1.5, minWidth: 200 },
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
  const { success, error: showError } = useMuiToast();

  const { control, handleSubmit, reset } = useForm<BotSenderFormData>({
    defaultValues: DEFAULT_FORM_DATA,
  });

  const handleDialogEnter = () => {
    if (sender) {
      reset({
        email_address: sender.email_address,
        company_name: sender.company_name,
        category: sender.category,
        is_confirmed: sender.is_confirmed,
      });
    } else {
      reset(DEFAULT_FORM_DATA);
    }
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
            : 'Add a known automated email sender. Only active entries are used for detection.'}
        </DialogContentText>
        <Stack>
          <TextFieldElement
            name="email_address"
            control={control}
            label="Email Address"
            placeholder="e.g., no-reply@example.com"
            rules={{ required: 'Email address is required' }}
          />
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
  );
}

export default function BotSendersPage() {
  usePageTitle('Bot Senders');
  const { user, signOut } = useAuth();
  const isMobile = useMediaQuery('(max-width:899px)');

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

  // Build URL with query params for server-side pagination
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', paginationModel.page.toString());
    params.set('pageSize', paginationModel.pageSize.toString());
    if (searchTerm) params.set('search', searchTerm);
    if (categoryFilter) params.set('category', categoryFilter);
    return `/api/bot-senders?${params.toString()}`;
  }, [paginationModel.page, paginationModel.pageSize, searchTerm, categoryFilter]);

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
      description: `Are you sure you want to delete ${sender.email_address}? This action cannot be undone.`,
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
            placeholder="Search by email or company..."
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              label="Category"
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPaginationModel(prev => ({ ...prev, page: 0 }));
              }}
            >
              <MenuItem value="">All Categories</MenuItem>
              {CATEGORIES.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {(searchTerm || categoryFilter) && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
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
            <AddIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography color="text.secondary" mb={2}>
              {rowCount === 0 && !searchTerm && !categoryFilter
                ? 'No bot senders configured yet'
                : 'No bot senders match your filters'}
            </Typography>
            {rowCount === 0 && !searchTerm && !categoryFilter && (
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {sender.email_address}
                        {sender.is_confirmed && (
                          <Chip label="Active" size="small" color="success" />
                        )}
                      </Box>
                    }
                    secondary={`${sender.company_name} • ${CATEGORY_LABELS[sender.category] ?? sender.category}`}
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
