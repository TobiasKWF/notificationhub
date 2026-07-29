// Fallback type shims – used when @types packages are not hoisted by npm workspaces.
// These are intentionally minimal; the real @types packages take precedence when present.
declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;
  const _default: {
    hash: typeof hash;
    compare: typeof compare;
    hashSync: typeof hashSync;
    compareSync: typeof compareSync;
    genSalt: typeof genSalt;
    genSaltSync: typeof genSaltSync;
  };
  export default _default;
}

declare module 'nodemailer' {
  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
    [key: string]: unknown;
  }
  export interface MailOptions {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    [key: string]: unknown;
  }
  export interface SentMessageInfo {
    messageId: string;
    [key: string]: unknown;
  }
  export interface Transporter {
    sendMail(mailOptions: MailOptions): Promise<SentMessageInfo>;
    verify(): Promise<boolean>;
  }
  export function createTransport(options: TransportOptions | string): Transporter;
  const _default: { createTransport: typeof createTransport };
  export default _default;
}
