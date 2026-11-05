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
    { name: 'Admin', description: 'Quản trị thang điểm, môn học và người dùng' },
    { name: 'Student', description: 'Lượt học và bảng điểm của sinh viên' },
    { name: 'GPA', description: 'Tính GPA/CPA và dự báo' },
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
        summary: 'Tính CPA, tín chỉ tích luỹ và GPA từng học kỳ',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { semester: { type: 'string', example: '2025-1' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Calculation result' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/gpa/forecast': {
      post: {
        tags: ['GPA'],
        summary: 'Điểm Hệ 4 cần đạt để chạm CPA mục tiêu',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetCpa', 'additionalCredits'],
                properties: {
                  targetCpa: { type: 'number', minimum: 0, maximum: 4, example: 3.5 },
                  additionalCredits: { type: 'integer', minimum: 1, maximum: 60, example: 30 },
                  plannedGrade4: { type: 'number', minimum: 0, maximum: 4 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Forecast result' } },
      },
    },
    '/api/gpa/scales': {
      get: {
        tags: ['GPA'],
        summary: 'Thang điểm quy đổi hiện hành',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Grade scales' } },
      },
    },
    '/api/student/enrollments': {
      get: {
        tags: ['Student'],
        summary: 'Danh sách lượt học kèm cờ CPA',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Enrollments' } },
      },
      post: {
        tags: ['Student'],
        summary: 'Thêm lượt học và quy đổi điểm',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subjectId', 'semester', 'processScore', 'finalScore'],
                properties: {
                  subjectId: { type: 'string', format: 'uuid' },
                  semester: { type: 'string', example: '2025-1' },
                  processScore: { type: 'number', minimum: 0, maximum: 10 },
                  finalScore: { type: 'number', minimum: 0, maximum: 10 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Enrollment created' },
          400: { description: 'Validation error' },
          404: { description: 'Subject not found' },
        },
      },
    },
    '/api/student/enrollments/{id}': {
      patch: {
        tags: ['Student'],
        summary: 'Cập nhật lượt học',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  semester: { type: 'string' },
                  processScore: { type: 'number', minimum: 0, maximum: 10 },
                  finalScore: { type: 'number', minimum: 0, maximum: 10 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Enrollment updated' },
          404: { description: 'Enrollment not found' },
        },
      },
      delete: {
        tags: ['Student'],
        summary: 'Xoá lượt học',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },
    '/api/student/transcript': {
      get: {
        tags: ['Student'],
        summary: 'Bảng điểm nhóm theo học kỳ',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Transcript' } },
      },
    },
    '/api/admin/grade-scales': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách thang điểm',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Grade scales' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo mốc quy đổi',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['minScore10', 'letterGrade', 'grade4', 'isPass'],
                properties: {
                  minScore10: { type: 'number', minimum: 0, maximum: 10 },
                  letterGrade: { type: 'string', example: 'B+' },
                  grade4: { type: 'number', minimum: 0, maximum: 4 },
                  isPass: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          409: { description: 'Overlapping threshold' },
        },
      },
    },
    '/api/admin/grade-scales/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Cập nhật mốc quy đổi',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xoá mốc quy đổi',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },
    '/api/admin/subjects': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách môn học',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Subjects' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo môn học',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name', 'credits'],
                properties: {
                  code: { type: 'string', example: 'INT2204' },
                  name: { type: 'string' },
                  credits: { type: 'integer', minimum: 1, maximum: 30 },
                  knowledgeBlock: { type: 'string' },
                  processWeight: { type: 'number', minimum: 0, maximum: 1, example: 0.4 },
                  finalWeight: { type: 'number', minimum: 0, maximum: 1, example: 0.6 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate code' } },
      },
    },
    '/api/admin/subjects/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Cập nhật môn học',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Vô hiệu hoá môn học',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 204: { description: 'Deactivated' } },
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
