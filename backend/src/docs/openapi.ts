/**
 * Hand-written OpenAPI 3.0 document. Kept in code so it is versioned with the routes
 * and does not require a build-time scan.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'AcaSchedule API',
    version: '0.1.0',
    description:
      'REST API cho nền tảng quản trị học tập AcaSchedule: GPA/CPA, lịch học, tài liệu và AI Advisor.',
  },
  servers: [{ url: '/', description: 'Current host' }],
  tags: [
    { name: 'Health', description: 'Liveness & readiness probes' },
    { name: 'Auth', description: 'Đăng ký, đăng nhập, refresh token' },
    { name: 'GPA', description: 'Tính GPA/CPA (đang triển khai)' },
    { name: 'AI', description: 'AI Advisor & RAG (proxy tới AI service)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'email', 'fullName', 'role'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          role: { type: 'string', enum: ['student', 'admin'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResult: {
        type: 'object',
        required: ['user', 'accessToken', 'refreshToken'],
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: { type: 'string', example: 'BadRequest' },
          message: { type: 'string' },
          details: { nullable: true },
          requestId: { type: 'string' },
        },
      },
      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          service: { type: 'string' },
          version: { type: 'string' },
          uptime: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
          checks: {
            type: 'object',
            additionalProperties: { type: 'string', enum: ['up', 'down'] },
          },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe (PostgreSQL, Redis, MinIO)',
        responses: {
          200: {
            description: 'All dependencies are up',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } },
          },
          503: { description: 'At least one dependency is down' },
        },
      },
    },
    '/api/health/live': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: { 200: { description: 'Process is alive' } },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng ký tài khoản sinh viên',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 72 },
                  fullName: { type: 'string', minLength: 2, maxLength: 120 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } },
            },
          },
          409: { description: 'Email already registered' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } },
            },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Đổi refresh token lấy cặp token mới (rotation)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } },
            },
          },
          401: { description: 'Refresh token revoked or expired' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Thu hồi refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: { 204: { description: 'Revoked' } },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Thông tin người dùng hiện tại',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { user: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/gpa/calculate': {
      post: {
        tags: ['GPA'],
        summary: 'Tính GPA/CPA (Sprint 1)',
        security: [{ bearerAuth: [] }],
        responses: { 501: { description: 'Not implemented yet' } },
      },
    },
    '/api/ai/advice': {
      post: {
        tags: ['AI'],
        summary: 'Tư vấn học tập từ AI service',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Advice generated (Gemini or local fallback)' },
          502: { description: 'AI service unavailable' },
        },
      },
    },
  },
} as const;
