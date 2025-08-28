// Example usage of the API layer
// This file demonstrates how to use the API hooks and types

import React from 'react';
import { useAuth, useHasRole } from './AuthProvider';
import { useGet, usePost, useUpload, useInvalidateQueries } from './useApi';
import { queryKeys } from './queryClient';
import { Lead, LeadFilters, CreateRequest, LoginRequest } from './types';

// Example: Login component
export function LoginExample() {
  const { login, isLoading } = useAuth();

  const handleLogin = async (credentials: LoginRequest) => {
    try {
      await login(credentials);
      // User will be redirected automatically on success
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleLogin({
        email: formData.get('email') as string,
        password: formData.get('password') as string,
      });
    }}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}

// Example: Leads list component
export function LeadsListExample() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = useHasRole('admin');
  const invalidateQueries = useInvalidateQueries();

  // Fetch leads with filters
  const filters: LeadFilters = {
    status: ['new', 'contacted'],
    priority: ['high', 'urgent'],
  };

  const {
    data: leadsResponse,
    isLoading,
    error,
    refetch
  } = useGet<Lead[]>(
    queryKeys.leadsList(filters),
    `/leads?${new URLSearchParams(filters as any).toString()}`,
    {
      enabled: isAuthenticated, // Only fetch if authenticated
      staleTime: 30000, // 30 seconds
    }
  );

  // Create new lead mutation
  const createLeadMutation = usePost<Lead, CreateRequest<Lead>>('/leads', {
    onSuccess: () => {
      // Invalidate leads queries to refetch
      invalidateQueries.invalidateLeads();
    },
    onError: (error) => {
      console.error('Failed to create lead:', error);
    },
  });

  const handleCreateLead = (leadData: CreateRequest<Lead>) => {
    createLeadMutation.mutate(leadData);
  };

  if (!isAuthenticated) {
    return <div>Please log in to view leads.</div>;
  }

  if (isLoading) {
    return <div>Loading leads...</div>;
  }

  if (error) {
    return (
      <div>
        Error loading leads: {error.message}
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  const leads = leadsResponse?.data || [];

  return (
    <div>
      <h2>Leads ({leads.length})</h2>
      
      {isAdmin && (
        <button
          onClick={() => handleCreateLead({
            email: 'test@example.com',
            name: 'Test Lead',
            source: 'website',
            team_id: user?.team_id || '',
            status: 'new',
            priority: 'medium',
            tags: [],
            custom_fields: {},
          })}
          disabled={createLeadMutation.isPending}
        >
          {createLeadMutation.isPending ? 'Creating...' : 'Create Test Lead'}
        </button>
      )}

      <div>
        {leads.map((lead) => (
          <div key={lead.id} className="border p-4 mb-2">
            <h3>{lead.name || lead.email}</h3>
            <p>Status: {lead.status}</p>
            <p>Priority: {lead.priority}</p>
            <p>Score: {lead.score || 'Not scored'}</p>
            <p>Source: {lead.source}</p>
            {lead.tags.length > 0 && (
              <p>Tags: {lead.tags.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Example: File upload component
export function FileUploadExample() {
  const uploadMutation = useUpload('/upload', {
    onSuccess: (response) => {
      console.log('File uploaded successfully:', response.data);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
    },
  });

  const handleFileUpload = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'lead-import');
    
    uploadMutation.mutate(formData);
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileUpload(file);
          }
        }}
        accept=".csv,.xlsx"
      />
      
      {uploadMutation.isPending && (
        <div>Uploading... Please wait.</div>
      )}
      
      {uploadMutation.isError && (
        <div className="error">
          Upload failed: {uploadMutation.error?.message}
        </div>
      )}
      
      {uploadMutation.isSuccess && (
        <div className="success">
          File uploaded successfully!
        </div>
      )}
    </div>
  );
}

// Example: Protected component with role-based access
export function AdminOnlyComponent() {
  const isAdmin = useHasRole('admin');
  
  if (!isAdmin) {
    return <div>Access denied. Admin role required.</div>;
  }
  
  return (
    <div>
      <h2>Admin Panel</h2>
      <p>This content is only visible to administrators.</p>
    </div>
  );
}

// Example: Real-time data with auto-refresh
export function RealTimeLeadsCount() {
  const { data, isLoading } = useGet<{ count: number }>(
    queryKeys.leadsList(),
    '/leads/count',
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      refetchIntervalInBackground: true, // Continue refreshing in background
    }
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h3>Total Leads: {data?.data?.count || 0}</h3>
      <small>Updates every 30 seconds</small>
    </div>
  );
}

// Example: Error boundary for API errors
export class ApiErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('API Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong with the API.</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
