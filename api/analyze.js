// /api/analyze.js
// Vercel Serverless Function
// 역할: 주소 → 좌표 변환(카카오 로컬 API) → 반경 내 상가업소 조회(공공데이터포털, 소상공인시장진흥공단)
//       → 업종 구성 / 무인매장 집계까지 서버에서 처리 후 프론트에 JSON으로 반환
//
// 필요한 환경변수 (.env / Vercel 프로젝트 설정에 등록)
//   KAKAO_REST_API_KEY   : 카카오 개발자센터에서 발급한 REST API 키 (주소→좌표 변환용)
//   SEMAS_SERVICE_KEY     : data.go.kr에서 발급한 소상공인시장진흥공단 상가업소 API 서비스키 (Decoding 키 사용)

const KAKAO_GEOCODE_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const SEMAS_RADIUS_URL = "http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius";

// 무인매장으로 분류할 키워드 (상호명 기준, 필요시 자유롭게 추가)
const UNMANNED_KEYWORDS = [
  { label: "무인사진관/포토부스", pattern: /인생네컷|포토(부스|이즘)|하루필름|포토그레이|셀픽|스티커즈|포토matic|포토박스/i },
  { label: "무인아이스크림", pattern: /아이스크림.?할인점|아이스|콜드/i },
  { label: "무인카페", pattern: /무인카페|셀프카페/i },
  { label: "무인세탁", pattern: /무인세탁|크린토피아.?무인|런드리/i },
  { label: "무인편의점", pattern: /무인편의점|스마트스토어/i },
];

async function geocodeAddress(address) {
  const url = `${KAKAO_GEOCODE_URL}?query=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
  });
  if (!res.ok) throw new Error(`카카오 지오코딩 실패: ${res.status}`);
  const data = await res.json();
  if (!data.documents || data.documents.length === 0) {
    throw new Error("주소를 좌표로 변환하지 못했습니다. 주소를 다시 확인해주세요.");
  }
  const doc = data.documents[0];
  return { lon: parseFloat(doc.x), lat: parseFloat(doc.y), roadAddress: doc.address_name };
}

async function fetchStoresInRadius(lon, lat, radius) {
  const params = new URLSearchParams({
    cx: lon, cy: lat, radius: String(radius),
    ServiceKey: process.env.SEMAS_SERVICE_KEY,
    type: "json",
    numOfRows: "1000",
    pageNo: "1",
  });
  const url = `${SEMAS_RADIUS_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`상가업소 API 호출 실패: ${res.status}`);

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error("API가 JSON을 반환하지 않았습니다. XML 파서로 교체가 필요할 수 있습니다.");
  }

  const body = json?.body ?? json?.response?.body;
  const items = body?.items ?? body?.item ?? [];
  return Array.isArray(items) ? items : [items].filter(Boolean);
}

function aggregate(stores) {
  const industryCount = {};
  stores.forEach((s) => {
    const cat = s.indsLclsNm || s.indsMclsNm || "기타";
    industryCount[cat] = (industryCount[cat] || 0) + 1;
  });

  const total = stores.length || 1;
  const industryData = Object.entries(industryCount)
    .map(([name, count]) => ({ name, count, ratio: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);

  const unmannedTypes = UNMANNED_KEYWORDS.map(({ label, pattern }) => ({
    name: label,
    count: stores.filter((s) => pattern.test(s.bizesNm || "")).length,
  }));
  const unmannedTotal = unmannedTypes.reduce((sum, t) => sum + t.count, 0);

  return {
    totalStoreCount: stores.length,
    industryData,
    unmannedTypes,
    unmannedTotal,
    saturation: unmannedTotal >= 9 ? "높음" : unmannedTotal >= 5 ? "보통" : "낮음",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { address, radius = 500 } = req.query;
    if (!address) return res.status(400).json({ error: "address 파라미터가 필요합니다." });

    const { lon, lat, roadAddress } = await geocodeAddress(address);
    const stores = await fetchStoresInRadius(lon, lat, radius);
    const summary = aggregate(stores);

    return res.status(200).json({
      query: { address, radius: Number(radius) },
      location: { lon, lat, roadAddress },
      ...summary,
      note: "업종 구성·무인매장 집계는 실제 공공데이터(상가업소 정보) 기반입니다. 시간대·연령대 유동인구 및 매출 추정치는 해당 공공 API에서 제공하지 않아 별도 모델로 추정됩니다.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
