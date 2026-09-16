/** 타이머 표시: 1시간 미만은 m:ss, 넘으면 h:mm:ss */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

/** 사람이 읽는 길이: "1시간 30분", "45분", "1분 미만" */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return "1분 미만";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 목표 시간 선택지 표시용 */
export function formatGoalMinutes(minutes: number | null): string {
  if (minutes === null) return "자유";
  return minutes % 60 === 0 ? `${minutes / 60}시간` : `${minutes}분`;
}
