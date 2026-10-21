"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import AvatarPicker from "@/components/onboarding/AvatarPicker";
import BlockedGuide from "@/components/onboarding/BlockedGuide";
import CalibrationOverlay from "@/components/onboarding/CalibrationOverlay";
import FaceGuide from "@/components/onboarding/FaceGuide";
import WelcomeGuide from "@/components/onboarding/WelcomeGuide";
import MessageToast from "@/components/session/MessageToast";
import ReadyPanel from "@/components/session/ReadyPanel";
import SessionHud from "@/components/session/SessionHud";
import StateBanner from "@/components/session/StateBanner";
import HistorySheet from "@/components/session/HistorySheet";
import SessionReport from "@/components/session/SessionReport";
import { loadSessions, saveSession } from "@/lib/history/db";
import { evaluateSession, pickGreeting, streakDays, toRecord, dayKey } from "@/lib/history/stats";
import type { SessionEvaluation, SessionRecord } from "@/lib/history/types";
import { fillTemplate } from "@/lib/message/messages";
import { useFaceTracking } from "@/hooks/useFaceTracking";
import { DEFAULT_PRESET, getPresetById } from "@/lib/avatar/presets";
import { Calibrator, applyBaseline } from "@/lib/detection/calibration";
import { DetectionEngine } from "@/lib/detection/detectionEngine";
import type { FocusState } from "@/lib/detection/types";
import { MessageEngine } from "@/lib/message/messageEngine";
import { createSpeaker, type Speaker } from "@/lib/message/speech";
import { DEFAULT_PERSONA, getPersonaById } from "@/lib/message/personas";
import { emoteForMessage, type Emote } from "@/lib/avatar/emote";
import type { MessageTone, SupervisorMessage } from "@/lib/message/types";
import { OnboardingMachine } from "@/lib/onboarding/onboardingMachine";
import { INITIAL_ONBOARDING_STATE } from "@/lib/onboarding/types";
import type { SavedSetup } from "@/lib/onboarding/types";
import { SessionEngine } from "@/lib/session/sessionEngine";
import type { SessionSnapshot } from "@/lib/session/types";
import {
  loadAvatarId,
  loadCalibration,
  loadGoalMinutes,
  loadPersonaId,
  savePersonaId,
  loadVoiceEnabled,
  saveAvatarId,
  saveCalibration,
  saveGoalMinutes,
  saveVoiceEnabled,
} from "@/lib/storage";
import type { HeadPose } from "@/lib/vision/types";

/** 이보다 짧은 세션은 히스토리에 남기지 않는다 (연속 출석 부풀리기 방지) */
const MIN_SAVED_MS = 60_000;
/** 엔진 갱신 주기 — 추론은 10Hz이므로 그 절반이면 충분하다 */
const TICK_MS = 200;
/** 캘리브레이션 샘플 수: 5Hz × 3초 */
const CALIBRATION_SAMPLES = 15;
/** 토스트 표시 시간 — 경고는 조금 더 오래 둔다 */
const TOAST_MS: Record<MessageTone, number> = {
  warn: 6000,
  encourage: 4000,
  info: 3500,
};

/**
 * 온보딩 + 혼자 집중 세션 (UC-1 → UC-2).
 *
 * 온보딩과 세션이 한 페이지에 있는 이유: 라우팅으로 화면을 갈아타면 카메라
 * 스트림과 얼굴 인식 모델이 재초기화되어 권한을 다시 묻게 된다.
 *
 * 역할 분담 — 판단은 전부 순수 엔진이 하고, 이 컴포넌트는 부수효과만 맡는다.
 * - OnboardingMachine: 지금 어떤 화면인지 (UC-1)
 * - DetectionEngine: 부재/고개숙임 판정 (D-1, D-2, D-4)
 * - SessionEngine: 시간 집계 (C-1, C-2, C-4)
 * - MessageEngine: 감독관 메시지 (D-5)
 */
export default function SessionPage() {
  const { videoRef, signalRef, status, failure, start, stop } = useFaceTracking();

  const machineRef = useRef(new OnboardingMachine());
  const [onboarding, setOnboarding] = useState(INITIAL_ONBOARDING_STATE);
  const syncMachine = useCallback(() => {
    setOnboarding(machineRef.current.getState());
  }, []);

  const detectionRef = useRef(new DetectionEngine());
  const messageRef = useRef(new MessageEngine());
  const sessionRef = useRef<SessionEngine | null>(null);
  const calibratorRef = useRef<Calibrator | null>(null);
  const savedSetupRef = useRef<SavedSetup>({ hasAvatar: false, hasCalibration: false });

  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [baseline, setBaseline] = useState<HeadPose | null>(null);
  const [goalMinutes, setGoalMinutes] = useState<number | null>(25);
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceOnRef = useRef(false); // 5Hz 루프가 리렌더 없이 읽는 값
  const speakerRef = useRef<Speaker | null>(null);
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA.id);
  const personaRef = useRef(DEFAULT_PERSONA); // 5Hz 루프·음성이 리렌더 없이 읽는 값
  /** 감독관 메시지에 맞춘 아바타 표정 반응 */
  const emoteRef = useRef<Emote | null>(null);

  const [focusState, setFocusState] = useState<FocusState>("initializing");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  /** 세션 히스토리 (G-2) — null이면 아직 불러오는 중 */
  const [records, setRecords] = useState<SessionRecord[] | null>(null);
  const [report, setReport] = useState<{
    record: SessionRecord;
    evaluation: SessionEvaluation;
    saved: boolean;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** 날짜 계산용 벽시계 — 렌더 중 Date.now()를 부르지 않도록 이벤트에서 갱신 */
  const [wallNow, setWallNow] = useState(0);
  const greetedRef = useRef(false);
  const [toast, setToast] = useState<SupervisorMessage | null>(null);
  const [calProgress, setCalProgress] = useState<number | null>(null);

  const nowTs = () => signalRef.current?.timestamp ?? performance.now();

  /** 메시지 엔진 출력 → 토스트 + 음성 */
  const deliver = useCallback((messages: SupervisorMessage[]) => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    setToast(last);
    if (voiceOnRef.current) speakerRef.current?.speak(last.text, personaRef.current.voice);
    // 표정은 반응이 있는 메시지 중 마지막 것
    const now = performance.now();
    for (let i = messages.length - 1; i >= 0; i--) {
      const emote = emoteForMessage(messages[i].kind, now);
      if (emote) {
        emoteRef.current = emote;
        break;
      }
    }
  }, []);

  // ── 온보딩 시작: 저장된 설정을 복원하고 카메라를 요청한다 ──
  // 반드시 사용자 제스처 안에서 호출할 것 (iOS 카메라·음성 정책)
  const handleStart = () => {
    const savedAvatar = loadAvatarId();
    const savedCalibration = loadCalibration();
    const savedGoal = loadGoalMinutes();
    applyPersona(getPersonaById(loadPersonaId()).id);
    if (savedAvatar) setPresetId(getPresetById(savedAvatar).id);
    if (savedCalibration) setBaseline(savedCalibration);
    if (savedGoal !== null) setGoalMinutes(savedGoal);
    savedSetupRef.current = {
      hasAvatar: savedAvatar !== null,
      hasCalibration: savedCalibration !== null,
    };

    // 음성은 제스처 안에서 잠금을 풀어야 이후 발화가 허용된다
    if (loadVoiceEnabled()) {
      speakerRef.current ??= createSpeaker();
      speakerRef.current.unlock();
      voiceOnRef.current = true;
      setVoiceOn(true);
    }

    machineRef.current.begin();
    syncMachine();
    void start();
    if (records === null) {
      void loadSessions().then((loaded) => {
        setRecords(loaded);
        setWallNow(Date.now());
      });
    }
  };

  // 카메라 준비 결과를 온보딩 단계에 반영
  useEffect(() => {
    const machine = machineRef.current;
    if (status === "running") {
      if (machine.currentStep === "requesting") {
        machine.cameraReady(savedSetupRef.current);
        syncMachine();
      }
      return;
    }
    if (status === "error") {
      // 세션 중 끊김이면 진행 중 세션을 일시정지해 두고 복구를 안내한다 (UC-2 예외)
      const session = sessionRef.current;
      if (session?.currentPhase === "running") session.pause(performance.now());
      machine.cameraFailed(failure ?? "unknown");
      syncMachine();
    }
  }, [status, failure, syncMachine]);

  // ── 5Hz 루프: 신호 → 엔진들 → UI ──
  useEffect(() => {
    if (status !== "running") return;
    const detection = detectionRef.current;
    const messages = messageRef.current;
    const machine = machineRef.current;

    const timer = setInterval(() => {
      const signal = signalRef.current;
      if (!signal) return;

      // 캘리브레이션 중에는 샘플링만 하고 감지/세션은 멈춘다
      const calibrator = calibratorRef.current;
      if (calibrator) {
        if (signal.present) {
          setCalProgress(calibrator.addSample(signal.pose));
          if (calibrator.isComplete) {
            const result = calibrator.getBaseline();
            calibratorRef.current = null;
            setCalProgress(null);
            if (result) {
              setBaseline(result);
              saveCalibration(result);
            }
            machine.finishCalibration();
            syncMachine();
          }
        }
        return;
      }

      const corrected = applyBaseline(signal.pose, baseline);
      const { state, events } = detection.update({
        present: signal.present,
        pitch: corrected.pitch,
        yaw: corrected.yaw,
        hand: signal.hand,
        timestamp: signal.timestamp,
      });
      setFocusState(state);

      const session = sessionRef.current;
      let snap: SessionSnapshot | null = null;
      if (session) {
        session.update(signal.timestamp, state);
        snap = session.getSnapshot();
        setSnapshot(snap);
      }

      deliver(messages.update({ timestamp: signal.timestamp, events, session: snap }));

      if (machine.observe(signal.timestamp, signal.present)) syncMachine();
    }, TICK_MS);

    return () => {
      clearInterval(timer);
      detection.reset();
      messages.reset();
      setFocusState("initializing");
    };
  }, [status, signalRef, baseline, deliver, syncMachine]);

  // 토스트 자동 숨김
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS[toast.tone]);
    return () => clearTimeout(t);
  }, [toast]);

  // ── 사용자 조작 ──
  const selectPreset = (id: string) => {
    setPresetId(id);
    saveAvatarId(id);
  };

  const confirmAvatar = () => {
    saveAvatarId(presetId);
    machineRef.current.chooseAvatar();
    syncMachine();
  };

  const beginCalibration = () => {
    calibratorRef.current = new Calibrator(CALIBRATION_SAMPLES);
    setCalProgress(0);
  };

  const skipCalibration = () => {
    calibratorRef.current = null;
    setCalProgress(null);
    machineRef.current.finishCalibration();
    syncMachine();
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    speakerRef.current ??= createSpeaker();
    if (next) speakerRef.current.unlock();
    else speakerRef.current.cancel();
    voiceOnRef.current = next;
    setVoiceOn(next);
    saveVoiceEnabled(next);
  };

  function applyPersona(id: string) {
    const persona = getPersonaById(id);
    personaRef.current = persona;
    setPersonaId(persona.id);
    messageRef.current.setTemplates(persona.templates);
  }

  const changePersona = (id: string) => {
    applyPersona(id);
    savePersonaId(id);
    // 고른 감독관의 목소리로 한마디 — 선택 피드백 겸 음성 톤 미리 듣기
    const persona = personaRef.current;
    // 세션 시작 인사(첫 문구)와 겹치지 않게 마지막 문구로 미리 듣기
    const starts = persona.templates.session_start;
    const line = starts[starts.length - 1];
    if (voiceOnRef.current) speakerRef.current?.speak(line, persona.voice);
    setToast({ kind: "session_start", tone: "info", text: line, at: performance.now() });
  };

  const changeGoal = (minutes: number | null) => {
    setGoalMinutes(minutes);
    saveGoalMinutes(minutes);
  };

  const startSession = () => {
    setReport(null);
    const session = new SessionEngine({
      goalDurationMs: goalMinutes === null ? null : goalMinutes * 60_000,
    });
    session.start(nowTs());
    sessionRef.current = session;
    setSnapshot(session.getSnapshot());
    machineRef.current.startSession();
    syncMachine();
  };

  const togglePause = () => {
    const session = sessionRef.current;
    if (!session) return;
    const ts = nowTs();
    if (session.currentPhase === "running") session.pause(ts);
    else if (session.currentPhase === "paused") session.resume(ts);
    setSnapshot(session.getSnapshot());
  };

  const endSession = () => {
    const session = sessionRef.current;
    if (!session) return;
    const summary = session.end(nowTs());
    const endedWall = Date.now();
    setWallNow(endedWall);
    const record = toRecord(summary, endedWall, {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      personaId,
      avatarId: presetId,
    });
    const previous = records ?? [];
    const evaluation = evaluateSession(record, previous);
    // 실수로 켰다 끈 세션이 연속 출석을 만들면 안 된다
    const saved = record.elapsedMs >= MIN_SAVED_MS;
    if (saved) {
      void saveSession(record);
      setRecords([...previous, record]);
    }
    setReport({ record, evaluation, saved });
    // 최고 기록·좋은 등급이면 아바타도 같이 기뻐한다
    if (evaluation.newBests.length > 0 || evaluation.grade === "S" || evaluation.grade === "A") {
      emoteRef.current = { name: "happy", startedAt: performance.now(), durationMs: 3500, strength: 1 };
    }
    sessionRef.current = null;
    setSnapshot(null);
    setToast(null);
    speakerRef.current?.cancel();
    machineRef.current.endSession();
    syncMachine();
  };

  const leave = () => {
    stop();
  };

  const { step, showFaceGuide } = onboarding;

  // 기억하는 감독관 — 준비 화면에 처음 들어올 때 지난 기록을 꺼내 인사한다
  useEffect(() => {
    if (step !== "ready" || records === null || greetedRef.current) return;
    greetedRef.current = true;
    const persona = personaRef.current;
    const greeting = pickGreeting(records, Date.now());
    const text = fillTemplate(persona.greetings[greeting.kind], greeting.vars);
    setToast({ kind: "session_start", tone: "info", text, at: performance.now() });
    if (voiceOnRef.current) speakerRef.current?.speak(text, persona.voice);
    emoteRef.current = { name: "happy", startedAt: performance.now(), durationMs: 1800, strength: 0.6 };
  }, [step, records]);

  const todayFocusMs = (records ?? [])
    .filter((r) => dayKey(r.endedAtWall) === dayKey(wallNow))
    .reduce((s, r) => s + r.focusedMs, 0);
  const cameraLive = step === "avatar" || step === "calibration" || step === "ready" || step === "session";
  const paused = snapshot?.phase === "paused";

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background">
      {/* 카메라 원본은 화면에 절대 보이지 않는다 (마스킹 원칙).
          display:none은 일부 브라우저에서 프레임 공급이 끊기므로 투명 처리한다. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-0 w-16 opacity-0"
      />

      {(step === "welcome" || step === "requesting") && (
        <WelcomeGuide loading={step === "requesting"} onStart={handleStart} />
      )}

      {step === "blocked" && onboarding.failure && (
        <BlockedGuide
          failure={onboarding.failure}
          duringSession={onboarding.blockedFrom === "session"}
          onRetry={handleStart}
        />
      )}

      {cameraLive && (
        <>
          <Avatar
            signalRef={signalRef}
            preset={getPresetById(presetId)}
            focusState={focusState}
            emoteRef={emoteRef}
            anchor={step === "session" ? "center" : "upper"}
            className="min-h-0 w-full flex-1"
          />
          <StateBanner focusState={focusState} paused={Boolean(paused)} />
          {showFaceGuide && <FaceGuide />}
          {toast && <MessageToast message={toast} />}
          {snapshot && <SessionHud snapshot={snapshot} />}

          {step === "avatar" && (
            <AvatarPicker
              selectedId={presetId}
              onSelect={selectPreset}
              onConfirm={confirmAvatar}
            />
          )}

          {step === "calibration" && (
            <CalibrationOverlay
              progress={calProgress}
              onStart={beginCalibration}
              onSkip={skipCalibration}
            />
          )}

          {step === "ready" && (
            <>
              <Link
                href="/"
                onClick={leave}
                className="absolute right-3 top-14 z-20 rounded-full border border-gray-700 bg-black/60 px-3.5 py-2 text-sm"
              >
                나가기
              </Link>
              <ReadyPanel
                goalMinutes={goalMinutes}
                onGoalChange={changeGoal}
                personaId={personaId}
                onPersonaChange={changePersona}
                streakDays={streakDays(records ?? [], wallNow)}
                todayFocusMs={todayFocusMs}
                onOpenHistory={() => {
                  setWallNow(Date.now());
                  setHistoryOpen(true);
                }}
                voiceOn={voiceOn}
                onToggleVoice={toggleVoice}
                calibrated={baseline !== null}
                onChangeAvatar={() => {
                  machineRef.current.editAvatar();
                  syncMachine();
                }}
                onRecalibrate={() => {
                  machineRef.current.startCalibration();
                  syncMachine();
                }}
                onStart={startSession}
              />
            </>
          )}

          {step === "session" && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex gap-2 bg-gradient-to-t from-black/85 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                onClick={toggleVoice}
                aria-label="음성 안내"
                aria-pressed={voiceOn}
                className={`rounded-2xl px-4 py-4 text-lg transition-colors ${
                  voiceOn ? "bg-emerald-700" : "bg-gray-700"
                }`}
              >
                {voiceOn ? "🔊" : "🔇"}
              </button>
              <button
                onClick={togglePause}
                className="flex-1 rounded-2xl bg-sky-700 py-4 font-bold"
              >
                {paused ? "재개" : "휴식"}
              </button>
              <button
                onClick={endSession}
                className="flex-1 rounded-2xl bg-red-700 py-4 font-bold"
              >
                세션 종료
              </button>
            </div>
          )}
        </>
      )}

      {report && (
        <SessionReport
          record={report.record}
          evaluation={report.evaluation}
          saved={report.saved}
          onClose={() => setReport(null)}
        />
      )}
      {historyOpen && <HistorySheet records={records ?? []} now={wallNow} onClose={() => setHistoryOpen(false)} />}
    </main>
  );
}
