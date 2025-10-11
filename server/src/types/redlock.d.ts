/**
 * Type declaration for redlock module
 * Workaround for package.json exports preventing TypeScript from finding types
 */
declare module 'redlock' {
  import { EventEmitter } from 'events';
  import type Redis from 'ioredis';

  export interface RedlockOptions {
    retryCount?: number;
    retryDelay?: number;
    retryJitter?: number;
    driftFactor?: number;
    automaticExtensionThreshold?: number;
  }

  export default class Redlock extends EventEmitter {
    constructor(clients: Redis[], options?: RedlockOptions);

    using<T>(
      resources: string[],
      duration: number,
      routine: (signal: AbortSignal) => Promise<T>
    ): Promise<T>;

    quit(): Promise<void>;
  }
}
