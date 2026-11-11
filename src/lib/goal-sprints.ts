import { query, withTransaction } from './db';

export type GoalSprintRegistrationStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type GoalSprint = {
  id: string;
  title: string;
  description: string;
  startsOn: string | null;
  endsOn: string | null;
  registrationStatus: GoalSprintRegistrationStatus | null;
};

export async function listOpenGoalSprints(userId: string | null): Promise<GoalSprint[]> {
  const result = await query<GoalSprint>(
    `SELECT sprint.id, sprint.title, sprint.description,
            sprint.starts_on AS "startsOn", sprint.ends_on AS "endsOn",
            enrollment.status AS "registrationStatus"
     FROM goal_sprints sprint
     LEFT JOIN community_goal_sprint_enrollments enrollment
       ON enrollment.sprint_id = sprint.id AND enrollment.user_id = $1
     WHERE sprint.status = 'open'
     ORDER BY sprint.starts_on NULLS LAST, sprint.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function requestGoalSprintEnrollment(
  sprintId: string,
  userId: string,
  motivation: string,
): Promise<'created' | 'pending' | 'approved' | 'closed' | 'missing'> {
  return withTransaction(async (client) => {
    const sprint = await client.query<{ status: string }>(
      'SELECT status FROM goal_sprints WHERE id = $1 FOR UPDATE',
      [sprintId],
    );
    if (!sprint.rowCount) return 'missing';
    if (sprint.rows[0].status !== 'open') return 'closed';

    const enrollment = await client.query<{ id: string; status: GoalSprintRegistrationStatus }>(
      `SELECT id, status FROM community_goal_sprint_enrollments
       WHERE sprint_id = $1 AND user_id = $2 FOR UPDATE`,
      [sprintId, userId],
    );
    const current = enrollment.rows[0];
    if (current?.status === 'approved') return 'approved';
    if (current?.status === 'pending') return 'pending';
    if (current) {
      await client.query(
        `UPDATE community_goal_sprint_enrollments
         SET motivation = $2, status = 'pending', requested_at = NOW(),
             reviewed_at = NULL, reviewed_by = NULL
         WHERE id = $1`,
        [current.id, motivation],
      );
      return 'created';
    }

    await client.query(
      `INSERT INTO community_goal_sprint_enrollments (sprint_id, user_id, motivation)
       VALUES ($1, $2, $3)`,
      [sprintId, userId, motivation],
    );
    return 'created';
  });
}
