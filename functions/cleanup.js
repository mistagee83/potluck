// Daily clean-up (Hub security audit 2026-11-22, K-7; owner's decision): a project with student data
// (running or assessing) that nobody has touched for IDLE_CLOSE_DAYS is closed automatically. Closing gives
// the student data its deleteAt (90 days, Firestore TTL), so data in a forgotten project does not stay forever.
// The teacher keeps the project plan, as after a normal closing. No e-mail is sent: Potluck sends none.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { fs, now, REGION } from './common.js';
import { closeProject } from './teacher.js';
import { STATUS, idleTooLong } from './engines/project.js';

/** Closes the idle projects. Returns the ids closed. */
export async function closeIdleProjects(at = now()) {
  const open = await fs().collection('plProjects').where('status', 'in', [STATUS.running, STATUS.assessing]).get();
  const closed = [];
  for (const d of open.docs) {
    if (!idleTooLong(d.data(), at)) continue;
    await closeProject(d.ref, d.data(), d.id, { closedBy: 'idle' });
    closed.push(d.id);
  }
  return closed;
}

export const plCleanup = onSchedule({ schedule: 'every day 03:40', timeZone: 'Europe/Budapest', region: REGION, timeoutSeconds: 540 }, async () => {
  const closed = await closeIdleProjects();
  console.log('plCleanup', JSON.stringify({ closed }));
});
