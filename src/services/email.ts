/**
 * Transactional email behind a provider-agnostic interface (build.md T-105,
 * PRD §11). The domain never depends on a concrete provider: swapping in
 * Resend/Postmark later is a single adapter, not a code change across the app.
 *
 * Until a provider is wired, the default adapter logs the message (matching the
 * "no email adapter" posture of Epic 0). Callers always pass an already
 * recipient-localized subject/body (PRD §6) — this layer only transports.
 */
import type { Payload } from "payload";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always provided. */
  text: string;
  /** Optional HTML body. */
  html?: string;
}

export interface EmailAdapter {
  /** Stable name for logging/diagnostics. */
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development/test adapter: records nothing externally, just logs. Returns the
 * messages it "sent" via a buffer so tests can assert delivery without a real
 * provider.
 */
export class LoggingEmailAdapter implements EmailAdapter {
  readonly name = "logging";
  readonly sent: EmailMessage[] = [];

  constructor(private readonly logger?: Payload["logger"]) {}

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    // Log the full body too: with no real provider wired, this is how a
    // developer retrieves a magic link / invite URL during manual testing
    // (the raw token is never recoverable from the DB — only its hash is stored).
    this.logger?.info(
      `[email:${this.name}] → ${message.to}: ${message.subject}\n${message.text}`,
    );
  }
}

let adapter: EmailAdapter | undefined;

/** Override the process-wide email adapter (used by tests and provider wiring). */
export function setEmailAdapter(next: EmailAdapter): void {
  adapter = next;
}

/** The active email adapter (defaults to a logging adapter). */
export function getEmailAdapter(payload?: Payload): EmailAdapter {
  return (adapter ??= new LoggingEmailAdapter(payload?.logger));
}

/** Send one transactional email through the active adapter. */
export async function sendEmail(payload: Payload, message: EmailMessage): Promise<void> {
  await getEmailAdapter(payload).send(message);
}
