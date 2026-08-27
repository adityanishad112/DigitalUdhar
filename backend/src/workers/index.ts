import cron from 'node-cron';
import { logger } from '../core/logger';
import { runCollectionsSweep } from '../modules/collections/service';

let running = false;

/** Run the reminder + promise-missed sweep once, guarding against overlap. */
export async function sweepOnce(reason: string) {
  if (running) {
    logger.warn(`Collections sweep already running — skipping (${reason})`);
    return;
  }
  running = true;
  try {
    const result = await runCollectionsSweep();
    logger.info(
      `Collections sweep (${reason}): ${result.remindersCreated} reminders, ${result.promisesMissed} promises missed`,
    );
    return result;
  } catch (err) {
    logger.error('Collections sweep failed', err);
  } finally {
    running = false;
  }
}

/**
 * Schedule the daily collections sweep (09:00 local) and run one pass shortly
 * after boot so the demo shows live reminders/overdue state immediately.
 */
export function startWorkers() {
  // Every day at 09:00 — reminders + promise-missed transitions.
  cron.schedule('0 9 * * *', () => {
    void sweepOnce('daily-0900');
  });

  // One pass at startup (slightly delayed so migrations/seed settle first).
  setTimeout(() => {
    void sweepOnce('startup');
  }, 2500);

  logger.info('Workers started (daily collections sweep @ 09:00).');
}
