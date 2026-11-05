declare global {
  namespace Express {
    interface Request {
      /** Correlation id set by requestContext middleware. */
      id: string;
      /** Authenticated user, set by the auth middleware. */
      user?: {
        id: string;
        email: string;
        role: 'student' | 'admin';
      };
    }
  }
}

export {};
