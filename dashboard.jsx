import React, { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { Search, MapPin, Users, Clock, Info, Store, Boxes, TrendingUp } from "lucide-react";

// ---------- 시드 기반 의사난수 ----------
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOTS = ["06-09", "09-12", "12-15", "15-18", "18-21", "21-24"];
const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대+"];
const INDUSTRY = ["음식점", "카페", "소매", "서비스업", "무인매장", "기타"];
const UNMANNED_TYPES = ["무인사진관/포토부스", "무인아이스크림", "무인카페", "무인세탁", "무인편의점"];
const RADIUS_OPTIONS = [250, 500, 1000];
const ACCENTS = { A: "#111111", B: "#9CA3AF" };

function radiusFactor(radius) {
  return Math.pow(radius / 500, 2);
}

function pyeongFactor(pyeong) {
  return Math.sqrt(Math.max(pyeong, 5) / 20);
}

function buildDataset(address, radius, pyeong) {
  const seed = hashString(address || "샘플 주소");
  const rand = mulberry32(seed);
  const rf = radiusFactor(radius);

  const isCampus = /대학|캠퍼스/.test(address);
  const isStation = /역|터미널/.test(address);
  const isTourist = /길|거리|황리단|한강|해변/.test(address);

  const weekdayHourly = SLOTS.map((slot, si) => {
    let base = 40 + rand() * 30;
    if (isCampus && si >= 2 && si <= 3) base += 30;
    if (isStation && (si === 0 || si === 4)) base += 30;
    return Math.round(base * rf);
  });
  const weekendHourly = SLOTS.map((slot, si) => {
    let base = 35 + rand() * 30;
    if (isTourist && si >= 3) base += 35;
    if (isCampus) base -= 15;
    return Math.max(5, Math.round(base * rf));
  });

  let ageWeights;
  if (isCampus) ageWeights = [8, 42, 24, 12, 9, 5];
  else if (isTourist) ageWeights = [6, 28, 27, 18, 13, 8];
  else if (isStation) ageWeights = [5, 24, 30, 22, 12, 7];
  else ageWeights = [7, 20, 24, 21, 16, 12];
  const ageNoise = ageWeights.map(w => Math.max(2, Math.round(w + (rand() - 0.5) * 8)));
  const ageSum = ageNoise.reduce((a, b) => a + b, 0);
  const ageData = AGE_GROUPS.map((g, i) => ({ name: g, 비율: Math.round((ageNoise[i] / ageSum) * 1000) / 10 }));
  const topAge = [...ageData].sort((a, b) => b.비율 - a.비율)[0];

  let indWeights;
  if (isCampus) indWeights = [30, 22, 14, 10, 16, 8];
  else if (isTourist) indWeights = [26, 24, 20, 8, 14, 8];
  else if (isStation) indWeights = [24, 20, 16, 14, 18, 8];
  else indWeights = [22, 16, 18, 16, 20, 8];
  const indNoise = indWeights.map(w => Math.max(3, Math.round(w + (rand() - 0.5) * 6)));
  const indSum = indNoise.reduce((a, b) => a + b, 0);
  const industryData = INDUSTRY.map((g, i) => ({ name: g, 비율: Math.round((indNoise[i] / indSum) * 1000) / 10 }));
  const unmannedShare = industryData.find(d => d.name === "무인매장").비율;

  const unmannedBaseCount = Math.round((3 + rand() * 9) * rf);
  const unmannedTypeWeights = [0.28, 0.22, 0.2, 0.16, 0.14].map(w => w + (rand() - 0.5) * 0.08);
  const wtSum = unmannedTypeWeights.reduce((a, b) => a + b, 0);
  const unmannedTypes = UNMANNED_TYPES.map((t, i) => ({
    name: t,
    count: Math.max(0, Math.round((unmannedTypeWeights[i] / wtSum) * unmannedBaseCount)),
  }));
  const photoBoothCount = unmannedTypes[0].count;
  let saturation = "낮음";
  if (unmannedBaseCount >= 9) saturation = "높음";
  else if (unmannedBaseCount >= 5) saturation = "보통";

  const peakIdx = weekdayHourly.reduce((mi, v, i, arr) => v > arr[mi] ? i : mi, 0);
  const totalDaily = Math.round((3000 + rand() * 9000) * rf);

  let districtType = "주거 밀집 상권";
  if (isCampus) districtType = "대학가 상권";
  else if (isTourist) districtType = "관광·유동형 상권";
  else if (isStation) districtType = "역세권 상권";

  const pf = pyeongFactor(pyeong);
  const baseRevenuePerFoot = 900 + rand() * 600;
  const industryMultiplier = 0.85 + (unmannedShare / 100) * 0.6;
  const estMid = Math.round((totalDaily / 1000) * baseRevenuePerFoot * industryMultiplier * pf);
  const estLow = Math.round(estMid * 0.75);
  const estHigh = Math.round(estMid * 1.3);

  return {
    weekdayHourly, weekendHourly, ageData, industryData, topAge,
    totalDaily, peakSlot: SLOTS[peakIdx], districtType,
    unmannedBaseCount, unmannedTypes, photoBoothCount, saturation,
    estLow, estMid, estHigh,
  };
}

const DEFAULT_A = "서울 마포구 홍대";
const DEFAULT_B = "경주 황리단길";

export default function App() {
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  const [addrA, setAddrA] = useState(DEFAULT_A);
  const [addrB, setAddrB] = useState(DEFAULT_B);
  const [radiusA, setRadiusA] = useState(500);
  const [radiusB, setRadiusB] = useState(500);
  const [pyeongA, setPyeongA] = useState(20);
  const [pyeongB, setPyeongB] = useState(20);

  const [liveMode, setLiveMode] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [liveA, setLiveA] = useState(null);
  const [liveB, setLiveB] = useState(null);
  const [statusA, setStatusA] = useState({ loading: false, error: null });
  const [statusB, setStatusB] = useState({ loading: false, error: null });

  const fetchLive = useCallback(async (address, radius, setLive, setStatus) => {
    if (!proxyUrl) { setStatus({ loading: false, error: "프록시 서버 주소를 먼저 입력해주세요." }); return; }
    setStatus({ loading: true, error: null });
    try {
      const base = proxyUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/api/analyze?address=${encodeURIComponent(address)}&radius=${radius}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "조회 실패");
      setLive(json);
      setStatus({ loading: false, error: null });
    } catch (e) {
      setStatus({ loading: false, error: e.message });
    }
  }, [proxyUrl]);

  const dataA = useMemo(() => buildDataset(addrA, radiusA, pyeongA), [addrA, radiusA, pyeongA]);
  const dataB = useMemo(() => buildDataset(addrB, radiusB, pyeongB), [addrB, radiusB, pyeongB]);

  const industryA = liveMode && liveA ? liveA.industryData.map(d => ({ name: d.name, 비율: d.ratio })) : dataA.industryData;
  const industryB = liveMode && liveB ? liveB.industryData.map(d => ({ name: d.name, 비율: d.ratio })) : dataB.industryData;
  const unmannedA = liveMode && liveA ? { unmannedTypes: liveA.unmannedTypes, unmannedBaseCount: liveA.unmannedTotal, saturation: liveA.saturation } : dataA;
  const unmannedB = liveMode && liveB ? { unmannedTypes: liveB.unmannedTypes, unmannedBaseCount: liveB.unmannedTotal, saturation: liveB.saturation } : dataB;

  const combinedHourly = SLOTS.map((slot, i) => ({
    slot, [addrA]: dataA.weekdayHourly[i], [addrB]: dataB.weekdayHourly[i],
  }));
  const combinedAge = AGE_GROUPS.map((g, i) => ({
    name: g, [addrA]: dataA.ageData[i].비율, [addrB]: dataB.ageData[i].비율,
  }));
  const industryNames = Array.from(new Set([...industryA.map(d => d.name), ...industryB.map(d => d.name)]));
  const combinedIndustry = industryNames.map(name => ({
    name,
    [addrA]: industryA.find(d => d.name === name)?.비율 ?? 0,
    [addrB]: industryB.find(d => d.name === name)?.비율 ?? 0,
  }));

  return (
    <div className="min-h-screen bg-white text-[#111111]" style={{ fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <div className="border-b border-[#E5E7EB] px-6 py-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-xs tracking-widest text-[#9CA3AF] font-medium uppercase mb-2">
            전국 매출분석시스템
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#111111]">두 지역, 나란히 비교한다</h1>
          <p className="text-sm text-[#6B7280] mt-1">반경·업종·무인매장·예상 매출까지 한 화면에서 비교하세요</p>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#E5E7EB] pt-4">
            <button
              onClick={() => setLiveMode(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                liveMode ? "bg-[#111111] text-white border-[#111111]" : "border-[#E5E7EB] text-[#6B7280]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${liveMode ? "bg-white" : "bg-[#D1D5DB]"}`} />
              실시간 데이터 모드 {liveMode ? "ON" : "OFF"}
            </button>
            {liveMode && (
              <input
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="프록시 서버 주소 (예: https://내프로젝트.vercel.app)"
                className="flex-1 min-w-[240px] text-xs bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg px-3 py-1.5 outline-none placeholder:text-[#9CA3AF]"
              />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-8 grid md:grid-cols-2 gap-6">
        <InputBlock
          label="지역 A" accent={ACCENTS.A}
          value={inputA} setValue={setInputA} placeholder="예: 서울 마포구 홍대"
          onSubmit={() => {
            const addr = inputA.trim(); if (!addr) return;
            setAddrA(addr);
            if (liveMode) fetchLive(addr, radiusA, setLiveA, setStatusA);
          }}
          radius={radiusA} setRadius={setRadiusA}
          pyeong={pyeongA} setPyeong={setPyeongA}
          status={statusA}
        />
        <InputBlock
          label="지역 B" accent={ACCENTS.B}
          value={inputB} setValue={setInputB} placeholder="예: 경주 황리단길"
          onSubmit={() => {
            const addr = inputB.trim(); if (!addr) return;
            setAddrB(addr);
            if (liveMode) fetchLive(addr, radiusB, setLiveB, setStatusB);
          }}
          radius={radiusB} setRadius={setRadiusB}
          pyeong={pyeongB} setPyeong={setPyeongB}
          status={statusB}
        />
      </div>
      <div className="max-w-5xl mx-auto px-6 md:px-10 flex items-center gap-1.5 mt-4 text-xs text-[#9CA3AF]">
        <Info size={13} />
        {liveMode
          ? "업종 구성·무인매장은 실제 공공데이터 기반입니다. 시간대·연령대 유동인구·예상 매출은 공공 API 미제공 항목으로 추정 모델을 사용합니다."
          : "샘플 데이터 기반 프로토타입입니다. 상단의 실시간 데이터 모드를 켜고 프록시 서버 주소를 입력하면 업종·무인매장 항목이 실제 공공데이터로 전환됩니다."}
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-8">
        <SectionHeader icon={<Users size={15} />} title="핵심 지표" note="추정 모델 · 공공 API 미제공 항목" />
        <div className="grid md:grid-cols-2 gap-4">
          <CompareCard label={addrA} radius={radiusA} d={dataA} />
          <CompareCard label={addrB} radius={radiusB} d={dataB} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-8">
        <SectionHeader icon={<Clock size={15} />} title="평일 시간대별 유동인구" />
        <div className="border border-[#E5E7EB] rounded-xl p-5">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={combinedHourly}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="slot" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey={addrA} stroke={ACCENTS.A} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey={addrB} stroke={ACCENTS.B} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-10">
        <SectionHeader icon={<Users size={15} />} title="연령대 분포" />
        <div className="border border-[#E5E7EB] rounded-xl p-5">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={combinedAge}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} unit="%" />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={addrA} fill={ACCENTS.A} radius={[4, 4, 0, 0]} />
              <Bar dataKey={addrB} fill={ACCENTS.B} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-10">
        <SectionHeader icon={<Store size={15} />} title="업종 구성 분석"
          note={liveMode && (liveA || liveB) ? "실제 공공데이터 (상가업소 정보)" : "추정 모델"} />
        <div className="border border-[#E5E7EB] rounded-xl p-5">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={combinedIndustry} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" stroke="#9CA3AF" fontSize={12} unit="%" />
              <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={12} width={70} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey={addrA} fill={ACCENTS.A} radius={[0, 4, 4, 0]} barSize={10} />
              <Bar dataKey={addrB} fill={ACCENTS.B} radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-10">
        <SectionHeader icon={<Boxes size={15} />} title="무인매장 분석"
          note={liveMode && (liveA || liveB) ? "실제 공공데이터 (상호명 기반 집계)" : "추정 모델 · 포토부스 경쟁 여부 별도 표시"} />
        <div className="grid md:grid-cols-2 gap-4">
          <UnmannedCard label={addrA} d={unmannedA} />
          <UnmannedCard label={addrB} d={unmannedB} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-10 pb-14">
        <SectionHeader icon={<TrendingUp size={15} />} title="예상 월 매출" note="추정 모델 · 공공 API 미제공 항목" />
        <div className="grid md:grid-cols-2 gap-4">
          <RevenueCard label={addrA} pyeong={pyeongA} d={dataA} />
          <RevenueCard label={addrB} pyeong={pyeongB} d={dataB} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, note }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-[#111111]">{icon}{title}</div>
      {note && <span className="text-xs text-[#9CA3AF]">{note}</span>}
    </div>
  );
}

function InputBlock({ label, accent, value, setValue, placeholder, onSubmit, radius, setRadius, pyeong, setPyeong, status }) {
  return (
    <div className="border border-[#E5E7EB] rounded-xl p-5">
      <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: accent }}>
        <MapPin size={12} /> {label}
      </div>
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
          <Search size={14} className="text-[#9CA3AF] shrink-0" />
          <input
            value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder={placeholder}
            className="bg-transparent outline-none w-full text-sm placeholder:text-[#9CA3AF] text-[#111111]"
          />
        </div>
        <button onClick={onSubmit}
          className="px-4 py-2.5 rounded-lg font-semibold text-sm text-white bg-[#111111] hover:bg-[#333] transition">
          분석
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[#9CA3AF]">반경</span>
        <div className="flex gap-1.5">
          {RADIUS_OPTIONS.map(r => (
            <button key={r} onClick={() => setRadius(r)}
              className={`px-2.5 py-1 rounded-md text-xs border transition ${
                radius === r ? "bg-[#111111] text-white border-[#111111]" : "border-[#E5E7EB] text-[#6B7280]"
              }`}>
              {r}m
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#9CA3AF]">매장 평수</span>
        <div className="flex items-center gap-2">
          <input type="range" min={5} max={80} value={pyeong}
            onChange={(e) => setPyeong(Number(e.target.value))}
            className="accent-[#111111]" />
          <span className="text-xs font-medium text-[#111111] w-12 text-right">{pyeong}평</span>
        </div>
      </div>

      {status?.loading && <div className="text-[11px] text-[#9CA3AF] mt-3">공공데이터 조회 중...</div>}
      {status?.error && <div className="text-[11px] text-[#B91C1C] mt-3">{status.error}</div>}
    </div>
  );
}

function CompareCard({ label, radius, d }) {
  return (
    <div className="border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold truncate text-[#111111]">{label}</div>
        <span className="text-[11px] text-[#9CA3AF]">반경 {radius}m</span>
      </div>
      <div className="text-xs text-[#9CA3AF] mb-4">{d.districtType}</div>
      <div className="grid grid-cols-3 gap-3">
        <Metric icon={<Users size={13} />} label="일 평균" value={d.totalDaily.toLocaleString()} unit="명" />
        <Metric icon={<Clock size={13} />} label="피크" value={d.peakSlot} unit="시" />
        <Metric icon={<MapPin size={13} />} label="최다 연령" value={d.topAge.name} unit={`${d.topAge.비율}%`} />
      </div>
    </div>
  );
}

function Metric({ icon, label, value, unit }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF] mb-1">{icon}{label}</div>
      <div className="text-sm font-semibold leading-tight text-[#111111]">{value}</div>
      <div className="text-[11px] text-[#9CA3AF]">{unit}</div>
    </div>
  );
}

function RevenueCard({ label, pyeong, d }) {
  return (
    <div className="border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[#111111]">{label}</div>
        <span className="text-[11px] text-[#9CA3AF]">{pyeong}평 기준</span>
      </div>
      <div className="text-2xl font-bold text-[#111111] mb-1">
        {d.estMid.toLocaleString()}만원
      </div>
      <div className="text-xs text-[#9CA3AF]">
        예상 범위 {d.estLow.toLocaleString()}만~{d.estHigh.toLocaleString()}만원 / 월
      </div>
    </div>
  );
}

function UnmannedCard({ label, d }) {
  return (
    <div className="border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[#111111]">{label}</div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
          d.saturation === "높음" ? "border-[#111111] text-[#111111]" : "border-[#E5E7EB] text-[#9CA3AF]"
        }`}>
          경쟁 포화도 {d.saturation}
        </span>
      </div>
      <div className="text-xs text-[#9CA3AF] mb-4">반경 내 무인매장 {d.unmannedBaseCount}개</div>
      <div className="space-y-2">
        {d.unmannedTypes.map((t, i) => (
          <div key={t.name} className="flex items-center gap-3">
            <span className={`text-xs w-36 shrink-0 ${i === 0 ? "font-semibold text-[#111111]" : "text-[#6B7280]"}`}>
              {t.name}{i === 0 && " ★"}
            </span>
            <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
              <div className="h-full bg-[#111111] rounded-full"
                style={{ width: `${Math.min(100, (t.count / Math.max(1, d.unmannedBaseCount)) * 100 * 1.4)}%`, opacity: i === 0 ? 1 : 0.35 + (0.5 - i * 0.08) }} />
            </div>
            <span className="text-xs text-[#111111] w-8 text-right">{t.count}</span>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-[#9CA3AF] mt-3">★ 포토부스/무인사진관 — 직접 경쟁 업종</div>
    </div>
  );
}
