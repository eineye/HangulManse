// 서버판과 브라우저 체험판(GitHub Pages)이 같은 컴포넌트를 쓰도록 경로를 한곳에서 만든다.
// 체험판은 정적 사이트라 동적 경로(/learn/:u/:s) 대신 쿼리 문자열을 쓴다.

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
/** 체험판의 하위 경로 (예: /HangulManse). Link/router는 자동으로 붙이지만 일반 URL에는 직접 붙여야 한다. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const learnHref = (unitId: string, situationId: string) =>
  IS_DEMO ? `/learn/?u=${encodeURIComponent(unitId)}&s=${encodeURIComponent(situationId)}` : `/learn/${unitId}/${situationId}`;

export const learnerHref = (userId: string) => (IS_DEMO ? `/admin/learner/?id=${encodeURIComponent(userId)}` : `/admin/learners/${userId}`);
