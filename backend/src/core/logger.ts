/* Tiny structured-ish logger. Avoids a heavy dependency for the MVP. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

function emit(level: Level, msg: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const color = COLORS[level];
  const head = `${color}[${level.toUpperCase()}]${RESET} ${ts}`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(`${head} ${msg}`, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(`${head} ${msg}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};
