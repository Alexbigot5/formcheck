import { vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/smartforms_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.HMAC_SECRET = 'test-hmac-secret-key-for-testing-only';
process.env.SECRET_VAULT_KEY = 'test-vault-secret-key-for-testing-only-32-chars';

// Mock external dependencies
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn(() => ({
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
    }))
  };
});

// Mock crypto functions for consistent testing
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn(() => Buffer.from('test-random-bytes')),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'test-hash')
    })),
    createCipheriv: vi.fn(() => ({
      update: vi.fn(() => 'encrypted'),
      final: vi.fn(() => 'final'),
      getAuthTag: vi.fn(() => Buffer.from('auth-tag'))
    })),
    createDecipheriv: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn(() => 'decrypted'),
      final: vi.fn(() => 'final')
    }))
  };
});

// Mock external API calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Global test utilities
global.mockPrisma = {
  lead: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn()
  },
  user: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  team: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  owner: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  scoringConfig: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  scoringRule: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  routingRule: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  leadDedupeKey: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn()
  },
  timelineEvent: {
    findMany: vi.fn(),
    create: vi.fn()
  },
  message: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn()
  },
  sLAClock: {
    findMany: vi.fn(),
    create: vi.fn()
  },
  integration: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn()
  },
  credential: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn()
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn()
};

// Mock Fastify app for testing
global.mockApp = {
  prisma: global.mockPrisma,
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
};

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
