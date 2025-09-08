// Auth configuration
export const authConfig = {
  // Set this to false to use real Supabase auth, true for mock auth
  useMockAuth: import.meta.env.VITE_MOCK_AUTH === 'true',
  
  // Supabase configuration
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || 'https://vqufkqgrxrjmjrgpcscv.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdWZrcWdyeHJqbWpyZ3Bjc2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2ODA5ODEsImV4cCI6MjA3MDI1Njk4MX0.lb_jeVSkIYPmMpBOofEwjni8OpHazEhTNZzBOx0wwAI',
  },
  
  // Mock user data for development
  mockUser: {
    id: 'mock-user-123',
    email: 'demo@example.com',
    name: 'Demo User',
    role: 'admin' as const,
    team_id: 'mock-team-456',
  }
};
