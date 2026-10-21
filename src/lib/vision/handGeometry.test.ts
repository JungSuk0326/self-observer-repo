import { describe, expect, it } from "vitest";
import { handGeometry, type Point } from "./handGeometry";

/** 얼굴: 코끝 (0.5,0.5), 볼 (0.4,0.5)·(0.6,0.5) → 얼굴 폭 0.2 */
function face(): Point[] {
  const f: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  f[1] = { x: 0.5, y: 0.5 };
  f[234] = { x: 0.4, y: 0.5 };
  f[454] = { x: 0.6, y: 0.5 };
  return f;
}
/** 손: 21개 점을 중심 주변 반경 r의 정사각형에 놓고, 검지 끝(8)만 지정 위치 */
function hand(center: Point, r: number, indexTip?: Point): Point[] {
  const h: Point[] = Array.from({ length: 21 }, (_, i) => ({
    x: center.x + (i % 2 ? r : -r),
    y: center.y + (i % 3 ? r : -r),
  }));
  if (indexTip) h[8] = indexTip;
  return h;
}

describe("handGeometry", () => {
  it("손이 없으면 present=false", () => {
    expect(handGeometry(face(), [])).toMatchObject({ present: false });
  });

  it("코끝에 닿은 검지는 거리 0", () => {
    const g = handGeometry(face(), [hand({ x: 0.5, y: 0.7 }, 0.05, { x: 0.5, y: 0.5 })])!;
    expect(g.present).toBe(true);
    expect(g.fingerToNose).toBeCloseTo(0, 5);
  });

  it("거리·오프셋·크기는 얼굴 폭 단위다", () => {
    // 손 중심이 코 아래 0.2 = 얼굴 폭 1배, 반경 0.05 정사각형 → 대각선 0.1414 = 0.707 얼굴 폭
    const g = handGeometry(face(), [hand({ x: 0.5, y: 0.7 }, 0.05)])!;
    expect(g.offsetY).toBeCloseTo(1, 5);
    expect(g.offsetX).toBeCloseTo(0, 5);
    expect(g.size).toBeCloseTo(0.707, 2);
  });

  it("손이 둘이면 코에 가까운 손을 고른다", () => {
    const far = hand({ x: 0.9, y: 0.9 }, 0.03);
    const near = hand({ x: 0.5, y: 0.75 }, 0.03, { x: 0.52, y: 0.52 });
    const g = handGeometry(face(), [far, near])!;
    expect(g.fingerToNose).toBeLessThan(0.3);
  });

  it("얼굴 점이 부족하면 null", () => {
    expect(handGeometry([{ x: 0, y: 0 }], [hand({ x: 0.5, y: 0.5 }, 0.1)])).toBeNull();
  });
});
