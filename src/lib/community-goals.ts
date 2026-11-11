import { query } from './db';

export const learningGoalSkillAreas = [
  'Future Skills',
  'AI Literacy',
  'Media Literacy',
  'Storytelling & Communication',
] as const;

export const learningGoalStatuses = ['Planned', 'In Progress', 'Achieved'] as const;

export type LearningGoalSkillArea = (typeof learningGoalSkillAreas)[number];
export type LearningGoalStatus = (typeof learningGoalStatuses)[number];

export type CommunityLearningGoal = {
  id: string;
  title: string;
  description: string;
  skillArea: LearningGoalSkillArea;
  targetDate: string | null;
  status: LearningGoalStatus;
  createdAt: string;
  updatedAt: string;
};

export type GoalResourceLink = {
  resourceType: 'article' | 'learning';
  resourceId: string;
};

export async function listCommunityLearningGoals(userId: string): Promise<{
  goals: CommunityLearningGoal[];
  links: Record<string, GoalResourceLink[]>;
}> {
  const [goalResult, linkResult] = await Promise.all([
    query<CommunityLearningGoal>(
      `SELECT id, title, description, skill_area AS "skillArea",
              target_date AS "targetDate", status,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM community_learning_goals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    ),
    query<GoalResourceLink & { goalId: string }>(
      `SELECT goal_id AS "goalId", resource_type AS "resourceType", resource_id AS "resourceId"
       FROM community_learning_goal_resources
       WHERE user_id = $1
       ORDER BY created_at`,
      [userId],
    ),
  ]);
  const links: Record<string, GoalResourceLink[]> = {};
  for (const link of linkResult.rows) {
    (links[link.goalId] ??= []).push({
      resourceType: link.resourceType,
      resourceId: link.resourceId,
    });
  }
  return { goals: goalResult.rows, links };
}
