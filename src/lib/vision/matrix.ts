import type { HeadPose } from "./types";

const RAD_TO_DEG = 180 / Math.PI;

/**
 * MediaPipe facialTransformationMatrix(column-major 4x4)에서
 * 머리 자세 오일러 각(도)을 추출한다. 스파이크에서 iPhone 실기로 검증된 방식.
 */
export function matrixToEuler(m: ArrayLike<number>): HeadPose {
  // column-major: R[row][col] = m[col * 4 + row]
  const r = (row: number, col: number) => m[col * 4 + row];
  return {
    pitch: Math.atan2(r(2, 1), r(2, 2)) * RAD_TO_DEG,
    yaw: Math.atan2(-r(2, 0), Math.hypot(r(2, 1), r(2, 2))) * RAD_TO_DEG,
    roll: Math.atan2(r(1, 0), r(0, 0)) * RAD_TO_DEG,
  };
}
