import "server-only";
import { getCourses } from "./content";
import { listProgress, listRecordings, listUsers, toPublicUser } from "./db";
import { buildDashboard, buildLearnerDetail, buildLearnerRows } from "./admin-calc";

export type { LearnerRow } from "./admin-calc";

async function loadAll() {
  const [users, progress, recordings, courses] = await Promise.all([listUsers(), listProgress(), listRecordings(), getCourses({ includeUnpublished: true })]);
  return { users: users.map(toPublicUser), progress, recordings, courses };
}

export async function getLearnerRows() {
  const { users, progress, recordings, courses } = await loadAll();
  return { rows: buildLearnerRows(users, progress, recordings, courses), courses, recordings };
}

export async function getDashboard() {
  const { rows, courses, recordings } = await getLearnerRows();
  return buildDashboard(rows, courses, recordings);
}

export async function getLearnerDetail(userId: string) {
  const { users, progress, recordings, courses } = await loadAll();
  return buildLearnerDetail(userId, buildLearnerRows(users, progress, recordings, courses), courses, progress, recordings);
}
