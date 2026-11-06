"use client";

import { useEffect, useState } from "react";
import type { AvatarState } from "@/lib/session-store";

// 직접 그린 2D 일러스트 선생님 얼굴. (설계 §6.1, §11 아바타 입모양 보강)
// speechSynthesis 오디오는 분석할 수 없고 onBoundary 이벤트도 신뢰할 수 없으므로,
// 'speaking' 상태 동안 컴포넌트가 스스로 110~240ms 간격으로 6가지 입모양을 순환시킨다.
// 상용 TTS(viseme 이벤트 제공)로 바꾸면 이 타이머 자리에 viseme 값을 연결하면 된다.

type Mouth = "rest" | "open" | "round" | "teeth" | "smile" | "fv";
const TALK_SHAPES: Mouth[] = ["open", "round", "teeth", "smile", "fv", "rest", "open", "teeth"];

function MouthShape({ m }: { m: Mouth }) {
  const lip = "#b9473f", inner = "#6b1f24", teeth = "#fffaf3", tongue = "#e07a6e";
  switch (m) {
    case "open": // A/E — 크게 벌림
      return (<g><ellipse cx="100" cy="146" rx="15" ry="11" fill={inner} stroke={lip} strokeWidth="3" /><rect x="89" y="136" width="22" height="5" rx="2" fill={teeth} /><ellipse cx="100" cy="152" rx="8" ry="4" fill={tongue} /></g>);
    case "round": // O/U — 오므림
      return (<g><ellipse cx="100" cy="146" rx="8" ry="9" fill={inner} stroke={lip} strokeWidth="3.5" /></g>);
    case "teeth": // I/S — 이 보임
      return (<g><rect x="85" y="140" width="30" height="11" rx="5.5" fill={inner} stroke={lip} strokeWidth="3" /><rect x="88" y="141.5" width="24" height="4.5" rx="1.5" fill={teeth} /></g>);
    case "smile": // 미소
      return (<path d="M84 142 Q100 156 116 142 Q100 150 84 142 Z" fill={inner} stroke={lip} strokeWidth="3" strokeLinejoin="round" />);
    case "fv": // F/V — 윗니가 아랫입술에
      return (<g><path d="M86 143 Q100 139 114 143 Q100 152 86 143 Z" fill={inner} stroke={lip} strokeWidth="3" /><rect x="91" y="140" width="18" height="4" rx="1.5" fill={teeth} /></g>);
    default: // B/M/P — 닫힘
      return (<path d="M86 145 Q100 150 114 145" fill="none" stroke={lip} strokeWidth="3.5" strokeLinecap="round" />);
  }
}

export default function Avatar2D({ state, zoomMouth = false, className = "" }: { state: AvatarState; zoomMouth?: boolean; className?: string }) {
  const [mouth, setMouth] = useState<Mouth>("smile");
  const [blink, setBlink] = useState(false);

  // 말하는 동안 입모양 순환 (매번 살짝 무작위 간격)
  useEffect(() => {
    if (state !== "speaking") {
      setMouth(state === "listening" ? "rest" : "smile");
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let last: Mouth = "rest";
    const tick = () => {
      if (!alive) return;
      let next = TALK_SHAPES[Math.floor(Math.random() * TALK_SHAPES.length)];
      if (next === last) next = TALK_SHAPES[(TALK_SHAPES.indexOf(next) + 1) % TALK_SHAPES.length];
      last = next;
      setMouth(next);
      timer = setTimeout(tick, 110 + Math.random() * 130);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [state]);

  // 눈 깜빡임
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 2200 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(timer);
  }, []);

  const viewBox = zoomMouth ? "62 112 76 56" : "0 0 200 200";
  const browLift = state === "listening" ? -3 : state === "thinking" ? -1.5 : 0;

  return (
    <svg viewBox={viewBox} className={`transition-all duration-300 ${className}`} role="img" aria-label={`AI teacher avatar (${state})`}>
      <defs>
        <radialGradient id="cheek" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f29c8f" stopOpacity="0.55" /><stop offset="100%" stopColor="#f29c8f" stopOpacity="0" /></radialGradient>
      </defs>
      {/* 배경 원 */}
      <circle cx="100" cy="100" r="96" fill={state === "listening" ? "#dcebe4" : "#ece6d6"} />
      {/* 뒷머리 */}
      <path d="M38 112 Q30 40 100 34 Q170 40 162 112 L164 168 Q150 178 138 166 L62 166 Q50 178 36 168 Z" fill="#2b2421" />
      {/* 목·옷 */}
      <path d="M84 160 L84 176 Q100 184 116 176 L116 160 Z" fill="#f1c7a8" />
      <path d="M44 200 Q50 172 84 170 Q100 182 116 170 Q150 172 156 200 Z" fill="#1f5a46" />
      <path d="M84 170 L100 186 L116 170" fill="none" stroke="#f7f4ec" strokeWidth="4" strokeLinejoin="round" />
      {/* 얼굴 */}
      <ellipse cx="100" cy="112" rx="50" ry="56" fill="#f6d2b5" />
      <ellipse cx="50" cy="116" rx="7" ry="10" fill="#f1c7a8" />
      <ellipse cx="150" cy="116" rx="7" ry="10" fill="#f1c7a8" />
      {/* 앞머리 */}
      <path d="M50 102 Q52 56 100 54 Q148 56 150 102 Q132 78 104 74 Q92 90 62 92 Q54 96 50 102 Z" fill="#2b2421" />
      {/* 눈썹 */}
      <g transform={`translate(0 ${browLift})`} stroke="#2b2421" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M70 96 Q79 91 88 95" />
        <path d="M112 95 Q121 91 130 96" />
      </g>
      {/* 눈 */}
      {blink ? (
        <g stroke="#2b2421" strokeWidth="3" strokeLinecap="round"><path d="M72 113 Q79 117 86 113" fill="none" /><path d="M114 113 Q121 117 128 113" fill="none" /></g>
      ) : (
        <g>
          <ellipse cx="79" cy="112" rx="6" ry="7.5" fill="#2b2421" />
          <ellipse cx="121" cy="112" rx="6" ry="7.5" fill="#2b2421" />
          <circle cx="81" cy="109" r="2" fill="#fff" />
          <circle cx="123" cy="109" r="2" fill="#fff" />
        </g>
      )}
      {/* 볼·코 */}
      <circle cx="68" cy="132" r="11" fill="url(#cheek)" />
      <circle cx="132" cy="132" r="11" fill="url(#cheek)" />
      <path d="M100 118 Q97 128 101 130" fill="none" stroke="#d9a888" strokeWidth="2.5" strokeLinecap="round" />
      {/* 입 */}
      <MouthShape m={mouth} />
      {/* 듣는 중 표시 */}
      {state === "listening" && !zoomMouth && (
        <g fill="#2a7259">
          <rect x="166" y="86" width="5" height="14" rx="2.5"><animate attributeName="height" values="6;18;6" dur="0.8s" repeatCount="indefinite" /></rect>
          <rect x="175" y="82" width="5" height="22" rx="2.5"><animate attributeName="height" values="20;8;20" dur="0.7s" repeatCount="indefinite" /></rect>
          <rect x="184" y="88" width="5" height="10" rx="2.5"><animate attributeName="height" values="8;16;8" dur="0.9s" repeatCount="indefinite" /></rect>
        </g>
      )}
      {state === "thinking" && !zoomMouth && (
        <g fill="#3a8d70">
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={160 + i * 10} cy="44" r="4"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin={`${i * 0.2}s`} repeatCount="indefinite" /></circle>
          ))}
        </g>
      )}
    </svg>
  );
}
