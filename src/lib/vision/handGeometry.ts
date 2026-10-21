import type { HandSignal } from "./types";

/** 정규화 이미지 좌표의 점 (MediaPipe NormalizedLandmark 호환) */
export interface Point {
  x: number;
  y: number;
}

/** MediaPipe Face Mesh 인덱스 */
const NOSE_TIP = 1;
const CHEEK_RIGHT = 234;
const CHEEK_LEFT = 454;
/**
 * MediaPipe Hand 인덱스: 손가락 끝 5개 + 끝 관절(DIP) 5개.
 * 코를 팔 때 손가락 끝은 콧구멍에 가려져 좌표가 튀므로, 바로 아래 관절도 같이 본다.
 */
const FINGER_POINTS = [4, 8, 12, 16, 20, 3, 7, 11, 15, 19];

/**
 * 얼굴·손 랜드마크 → HandSignal (순수 함수).
 * 모든 거리를 얼굴 폭(양쪽 볼 사이)으로 나눠, 카메라가 가깝든 멀든 같은 임계값을 쓴다.
 * 손이 여러 개면 코에 가장 가까운 손을 고른다 — 코 파기·폰 들기 모두 그 손이 관심 대상이다.
 */
export function handGeometry(face: readonly Point[], hands: readonly (readonly Point[])[]): HandSignal | null {
  if (face.length <= CHEEK_LEFT) return null;
  const nose = face[NOSE_TIP];
  const faceWidth = dist(face[CHEEK_RIGHT], face[CHEEK_LEFT]);
  if (faceWidth <= 0) return null;
  const faceCenter = mid(face[CHEEK_RIGHT], face[CHEEK_LEFT]);

  let best: HandSignal | null = null;
  for (const hand of hands) {
    if (hand.length < 21) continue;
    const fingerToNose = Math.min(...FINGER_POINTS.map((i) => dist(hand[i], nose))) / faceWidth;
    const box = bounds(hand);
    const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    const signal: HandSignal = {
      present: true,
      fingerToNose,
      offsetX: (center.x - faceCenter.x) / faceWidth,
      offsetY: (center.y - faceCenter.y) / faceWidth,
      size: Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / faceWidth,
    };
    if (!best || signal.fingerToNose < best.fingerToNose) best = signal;
  }
  return best ?? { present: false, fingerToNose: Infinity, offsetX: 0, offsetY: 0, size: 0 };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function bounds(pts: readonly Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
