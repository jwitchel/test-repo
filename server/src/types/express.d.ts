declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        role?: string | null;
      };
      session?: unknown;
      isServiceToken?: boolean;
    }
  }
}

export {};
