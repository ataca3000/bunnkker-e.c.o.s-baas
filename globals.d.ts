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
}

interface Navigator {
  readonly serial: SerialLike;
}
