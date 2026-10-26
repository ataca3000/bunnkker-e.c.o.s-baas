interface Window {
  recaptchaVerifier?: any;
}

// Web Serial API (subset usado por src/lib/thermalPrinter.ts)
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
}

interface SerialLike {
  requestPort(options?: unknown): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

interface Navigator {
  readonly serial: SerialLike;
}

declare module 'ai' {
  export const streamText: any;
  export const generateText: any;
  export const gateway: any;
  export const createDataStreamResponse: any;
  export const smoothStream: any;
  const def: any;
  export default def;
}

declare module 'flags/next' {
  export function flag<T = any>(options: any): any;
  export function evaluate(flags: any): Promise<any>;
  const def: any;
  export default def;
}

declare module '@flags-sdk/vercel' {
  export const vercelAdapter: any;
  export const vercelFlag: any;
  const def: any;
  export default def;
}

declare module '@vercel/toolbar/next' {
  export const VercelToolbar: any;
  const def: any;
  export default def;
}
