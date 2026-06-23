import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Gavel,
  Heart,
  Home,
  Landmark,
  Loader2,
  Map as MapIcon,
  MapPin,
  MessageCircleQuestion,
  Navigation,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  SquarePen,
  Star,
  TrendingDown,
  User,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import "./styles.css";

const API_BASE = "/onbid-api";
const ONBID_LIST_PATH = "/B010003/OnbidRlstListSrvc2/getRlstCltrList2";
const ONBID_DETAIL_PATH = "/B010003/OnbidRlstDtlSrvc2/getRlstDtlInf2";
const ONBID_CAR_LIST_PATH = "/B010003/OnbidCarListSrvc2/getCarCltrList2";
const ONBID_CAR_DETAIL_PATH = "/B010003/OnbidCarDtlSrvc2/getCarDtlInf2";
const ONBID_MOVABLE_LIST_PATH = "/B010003/OnbidMvastListSrvc2/getMvastCltrList2";
const ONBID_MOVABLE_DETAIL_PATH = "/B010003/OnbidMvastDtlSrvc2/getMvastDtlInf2";
const ONBID_RESULT_LIST_PATH = "/B010003/OnbidCltrBidRsltListSrvc2/getCltrBidRsltList2";
const PAGE_SIZE = 50;
const API_FETCH_TIMEOUT_MS = 25000;
const PHOTO_PROBE_TIMEOUT_MS = 8000;
const detailResponseCache = new Map();

function apiFetch(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS) });
}

const propertyTypes = [
  { label: "압류재산", value: "0007" },
  { label: "국유재산", value: "0010" },
  { label: "기타일반", value: "0005" },
  { label: "공유재산", value: "0002" },
  { label: "수탁재산", value: "0008" },
  { label: "공공개발", value: "0011" },
];

const bidTypes = [
  { label: "전자입찰", value: "0001" },
  { label: "현장입찰", value: "0002" },
];

const privateContractOptions = [
  { label: "수의계약 제외", value: "N" },
  { label: "수의계약 가능", value: "Y" },
];

const regions = [
  "전체",
  "서울특별시",
  "경기도",
  "부산광역시",
  "대전광역시",
  "인천광역시",
  "대구광역시",
  "광주광역시",
  "충청남도",
  "전라남도",
  "전북특별자치도",
];

const sortOptions = [
  { label: "마감 임박순", value: "deadline" },
  { label: "최저가 낮은순", value: "priceAsc" },
  { label: "감정가 높은순", value: "appraisedDesc" },
  { label: "할인율 높은순", value: "discountDesc" },
];

const statusTiles = [
  { label: "진행물건", value: "available", icon: Gavel, tone: "blue" },
  { label: "준비물건", value: "ready", icon: Clock3, tone: "green" },
  { label: "낙찰물건", value: "sold", icon: Star, tone: "gold" },
  { label: "유찰물건", value: "failed", icon: TrendingDown, tone: "red" },
];

const assetTypeSearchTitle = {
  realty: "부동산 공매 물건 탐색",
  car: "차량 공매 물건 탐색",
  movable: "동산 공매 물건 탐색",
};

const homeAssetTypes = [
  { label: "부동산", value: "realty", icon: Building2, image: "/images/asset-realty.png" },
  { label: "동산", value: "movable", icon: Landmark, image: "/images/asset-movable.png" },
  { label: "차량", value: "car", icon: WalletCards, image: "/images/asset-car.png" },
];

const homeDispositions = [
  { label: "전체", value: "all" },
  { label: "매각", value: "sale" },
  { label: "임대", value: "lease" },
];

const homeUsages = [
  { label: "전체", value: "" },
  { label: "토지", value: "10100" },
  { label: "주거용", value: "10200" },
  { label: "상가/업무용", value: "10300" },
];

const dispositionCodes = {
  all: "",
  sale: "0001",
  lease: "0002",
};

const resultCltrTypeCodes = {
  realty: "0001",
  car: "0002",
  movable: "0003",
};

const listPathsByAssetType = {
  realty: ONBID_LIST_PATH,
  car: ONBID_CAR_LIST_PATH,
  movable: ONBID_MOVABLE_LIST_PATH,
};

const detailPathsByAssetType = {
  realty: ONBID_DETAIL_PATH,
  car: ONBID_CAR_DETAIL_PATH,
  movable: ONBID_MOVABLE_DETAIL_PATH,
};

function cleanQuickKeyword(value, usageCode, disposition) {
  const selectedUsage = homeUsages.find((item) => item.value === usageCode)?.label ?? "";
  const filterWords = [selectedUsage, disposition === "sale" ? "매각" : "", disposition === "lease" ? "임대" : ""].filter(Boolean);
  return filterWords
    .reduce((text, word) => text.replaceAll(word, " "), value)
    .replace(/\s+/g, " ")
    .trim();
}

function formatLotIdFromDigits(digits) {
  if (digits.length === 12) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 10)}-${digits.slice(10)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return digits;
}

function normalizeLotId(value) {
  const text = String(value || "").trim();
  if (/^\d{4,5}-\d{4,5}-\d{3,6}$/.test(text)) return text;
  const digits = text.replace(/[^\d]/g, "");
  if (digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return formatLotIdFromDigits(digits);
  }
  return text;
}

function parseRegionFromKeyword(keyword) {
  const text = String(keyword || "").trim();
  if (!text) return { keyword: "", region: "" };

  const matched = regions
    .filter((name) => name !== "전체")
    .find((name) => text.includes(name));

  if (!matched) return { keyword: text, region: "" };

  return {
    keyword: text.replace(matched, "").replace(/\s+/g, " ").trim(),
    region: matched,
  };
}

const appViews = ["home", "search", "watch", "map", "board", "login", "signup", "mypage", "detail"];

function parseAppHash(rawHash = "") {
  const trimmed = String(rawHash || "").replace(/^#/, "").trim();
  if (!trimmed) return { view: "home", selectedId: "" };
  if (appViews.includes(trimmed)) return { view: trimmed, selectedId: "" };

  const lotCandidate = normalizeLotId(trimmed);
  if (isOnbidLotId(lotCandidate)) {
    return { view: "detail", selectedId: lotCandidate };
  }

  const dashIndex = trimmed.indexOf("-");
  if (dashIndex === -1) return { view: "home", selectedId: "" };

  const viewToken = trimmed.slice(0, dashIndex);
  const rest = trimmed.slice(dashIndex + 1);
  if (viewToken === "detail" && rest) {
    const selectedId = normalizeLotId(decodeURIComponent(rest));
    return { view: "detail", selectedId: isOnbidLotId(selectedId) ? selectedId : decodeURIComponent(rest) };
  }
  if (appViews.includes(viewToken)) {
    return { view: viewToken, selectedId: "" };
  }
  return { view: "home", selectedId: "" };
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f7f9", color: "#17324a" }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ marginTop: 0 }}>화면을 불러오지 못했습니다</h1>
            <p>{this.state.error.message}</p>
            <button type="button" onClick={() => window.location.reload()}>새로고침</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function parseHomeSearchInput(rawKeyword, usageCode, disposition) {
  const trimmed = String(rawKeyword || "").trim();
  const lotId = normalizeLotId(trimmed);
  if (isOnbidLotId(lotId)) {
    return { type: "lot", lotId, keyword: lotId, region: "" };
  }

  const cleaned = cleanQuickKeyword(trimmed, usageCode, disposition) || trimmed;
  const { keyword, region } = parseRegionFromKeyword(cleaned);
  return { type: "list", lotId: "", keyword, region };
}

const sampleLots = [
  {
    id: "sample-1",
    conditionNo: "6023358",
    title: "전북특별자치도 김제시 서암동 248-20",
    category: "토지",
    agency: "한국자산관리공사",
    region: "전북특별자치도",
    address: "전북특별자치도 김제시 서암동 248-20",
    appraised: 14500000,
    minimum: 1450000,
    discount: 90,
    starts: "2026-10-19 14:00",
    ends: "2026-10-21 17:00",
    status: "입찰준비중",
    statusCode: "0001",
    risk: "주의",
    tags: ["압류재산", "토지", "지분물건"],
    note: "실시간 목록 API 호출 전 화면 확인용 샘플입니다.",
    thumbnail: "",
    landArea: 100,
    buildingArea: 0,
    raw: {},
  },
];

function compactMoney(value, emptyText = "\uBE44\uACF5\uAC1C") {
  if (value == null || value === "" || value === "null") return emptyText;
  const numeric = Number(String(value).replace(/[^\d.]/g, ""));
  if (!numeric) return emptyText;
  if (numeric >= 100000000) {
    const eok = numeric / 100000000;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}\uC5B5`;
  }
  return `${Math.round(numeric / 10000).toLocaleString()}\uB9CC`;
}

function parseMoney(value) {
  if (value == null || value === "" || value === "null") return null;
  const numeric = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatOnbidDate(value) {
  const text = String(value ?? "").replace(/[^\d]/g, "");
  if (text.length < 8) return "";
  const ymd = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (text.length >= 12) return `${ymd} ${text.slice(8, 10)}:${text.slice(10, 12)}`;
  return ymd;
}

function scrollPageToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function formatYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function resultDateRange() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { start: formatYmd(start), end: formatYmd(end) };
}

function toDateValue(dateText) {
  const date = new Date(String(dateText).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function daysLeft(dateText) {
  const target = toDateValue(dateText);
  if (target === Number.MAX_SAFE_INTEGER) return "-";
  return Math.max(0, Math.ceil((target - Date.now()) / 86400000));
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function statusClass(status) {
  if (["입찰마감", "유찰", "취소", "낙찰"].includes(status)) return "warn";
  if (["입찰준비중", "입찰예정"].includes(status)) return "ready";
  return "live";
}

function statusGroup(lot) {
  const code = String(lot.statusCode || "");
  const status = String(lot.status || "");
  if (code === "0010" || status.includes("낙찰")) return "sold";
  if (code === "0011" || status.includes("유찰")) return "failed";
  if (code === "0012" || status.includes("취소")) return "cancelled";
  if (code === "0001" || status.includes("준비") || status.includes("예정")) return "ready";
  if (code === "0002" || code === "0003" || code === "0006" || status.includes("진행") || status.includes("마감") || status.includes("개찰")) {
    return "live";
  }
  return "available";
}

function matchesStatusFocus(lot, focus) {
  if (!focus) return true;
  const group = statusGroup(lot);
  if (focus === "available") return ["ready", "live", "available"].includes(group);
  return group === focus;
}

function statusFocusLabel(focus) {
  return statusTiles.find((tile) => tile.value === focus)?.label ?? "전체 물건";
}

function statusCodeForFocus(focus) {
  if (focus === "ready") return "0001";
  if (focus === "sold") return "0010";
  if (focus === "failed") return "0011";
  return "";
}

function isResultFocus(focus) {
  return focus === "sold" || focus === "failed";
}

function needsBidCheck(lot) {
  return lot.shareYn === "Y" || lot.discount >= 50 || daysLeft(lot.ends) <= 7 || /준비|진행|입찰/.test(lot.status);
}

function buildAddress(lot) {
  return lot.address || lot.title || [lot.region, lot.category].filter(Boolean).join(" ");
}

function pickFullLotAddress(lot, detailItem = {}) {
  const raw = lot?.raw || {};
  const regionLine = [
    raw.lctnSdnm || raw.lctnSidoNm,
    raw.lctnSggnm,
    raw.lctnEmdNm,
    raw.lctnDtlNm,
  ].filter(Boolean).join(" ");

  const candidates = [
    detailItem.cltrRadr,
    detailItem.onbidCltrNm,
    detailItem.cltrNm,
    raw.cltrRadr,
    raw.onbidCltrNm,
    lot?.title,
    lot?.address,
    regionLine,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!candidates.length) return "소재지 확인";
  return candidates.reduce((best, current) => (current.length > best.length ? current : best), candidates[0]);
}

function mapLinks(lot) {
  const query = encodeURIComponent(buildAddress(lot));
  return {
    embed: `https://maps.google.com/maps?q=${query}&output=embed`,
    kakao: `https://map.kakao.com/link/search/${query}`,
    naver: `https://map.naver.com/p/search/${query}`,
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
  };
}

function onbidSearchUrl(lot) {
  const query = encodeURIComponent(lot.id || lot.title || "");
  if (isOnbidLotId(lot.id || lot.title)) {
    return `https://www.onbid.co.kr/op/cltrpbancinf/toppagemng/unfsrch/UnfSrchController/mvmnUnfSrchClg.do?searchType=CLTR&searchKeyword=${query}`;
  }
  return `https://www.onbid.co.kr/op/cltrpbancinf/toppagemng/unfsrch/UnfSrchController/mvmnUnfSrchClg.do?searchKeyword=${query}`;
}

function pickOnbidLinkFields(lot, detail = null) {
  const raw = lot?.raw ?? {};
  const detailItem = detail?.item ?? {};
  const id = lot?.id || raw.cltrMngNo || detailItem.cltrMngNo || "";
  return {
    id,
    title: lot?.title || raw.onbidCltrNm || detailItem.onbidCltrNm || "",
    assetType: lot?.assetType || assetTypeFromLotId(id),
    prptDivCd: raw.prptDivCd || detailItem.prptDivCd || "",
    onbidNo: lot?.onbidNo || raw.onbidCltrno || detailItem.onbidCltrno || "",
    conditionNo: lot?.conditionNo || raw.pbctCdtnNo || detailItem.pbctCdtnNo || "",
    pbctNo: lot?.pbctNo || raw.pbctNo || detailItem.pbctNo || "",
    noticeNo: lot?.noticeNo || raw.onbidPbancNo || detailItem.onbidPbancNo || "",
  };
}

function mergeLotWithDetail(lot, detail) {
  if (!lot) return null;
  const item = detail?.item;
  if (!item || !Object.keys(item).length) return lot;
  const raw = { ...(lot.raw || {}), ...item };
  return {
    ...lot,
    onbidNo: lot.onbidNo || item.onbidCltrno || "",
    conditionNo: lot.conditionNo || item.pbctCdtnNo || "",
    pbctNo: lot.pbctNo || item.pbctNo || "",
    noticeNo: lot.noticeNo || item.onbidPbancNo || "",
    raw,
  };
}

function onbidDetailScreen(lot) {
  if (lot?.assetType === "car") return { cltrPrptDivCd: "6", cltrScrnGrpCd: "2" };
  if (lot?.assetType === "movable") return { cltrPrptDivCd: "7", cltrScrnGrpCd: "3" };
  if (lot?.prptDivCd === "0010") return { cltrPrptDivCd: "10", cltrScrnGrpCd: "1" };
  return { cltrPrptDivCd: "5", cltrScrnGrpCd: "1" };
}

function onbidDetailUrl(lot, detail = null) {
  const fields = pickOnbidLinkFields(lot, detail);
  if (!fields.onbidNo || !fields.conditionNo || !fields.pbctNo || !fields.noticeNo) {
    return onbidSearchUrl(fields);
  }
  const screen = onbidDetailScreen(fields);
  const query = new URLSearchParams({
    cltrPrptDivCd: screen.cltrPrptDivCd,
    cltrScrnGrpCd: screen.cltrScrnGrpCd,
    onbidCltrno: String(fields.onbidNo),
    onbidPbancNo: String(fields.noticeNo),
    pbctCdtnNo: String(fields.conditionNo),
    pbctNo: String(fields.pbctNo),
  });
  return `https://www.onbid.co.kr/op/cltrpbancinf/cltrdtl/CltrDtlController/mvmnCltrDtl.do?${query.toString()}`;
}

function openExternalUrl(url, event) {
  if (!url) return;
  event?.preventDefault();
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

function onbidDetailPageProxyUrl(lot, detail = null) {
  const url = onbidDetailUrl(lot, detail);
  if (!url.startsWith("https://www.onbid.co.kr")) return "";
  return toOnbidFileProxy(url.replace("https://www.onbid.co.kr", ""));
}

function formatBidStyle(raw = {}) {
  const cptn = String(raw.cptnMthodNm || "").trim();
  const method = String(raw.bidMthodNm || "").trim();
  const div = String(raw.bidDivNm || "").trim();
  if (cptn && method && div) return `${cptn}(${method})/${div}`;
  if (cptn && method) return `${cptn}(${method})/`;
  if (cptn && div) return `${cptn}/${div}`;
  return [cptn, div].filter(Boolean).join(" / ") || "-";
}

function mergeBadgeLists(...lists) {
  const out = [];
  for (const list of lists) {
    for (const item of list || []) {
      const text = String(item || "").trim();
      if (text && !out.includes(text)) out.push(text);
    }
  }
  return out;
}

function extractOnbidHtmlValue(html, label) {
  const re = new RegExp(`${label}<\\/span>[\\s\\S]{0,180}?txt01[^>]*>([^<]+)<`, "i");
  return html.match(re)?.[1]?.trim() || "";
}

function extractOnbidBadgesAfterLabel(html, label) {
  const idx = html.indexOf(label);
  if (idx < 0) return [];
  const slice = html.slice(idx, idx + 1400);
  const end = slice.indexOf("</ul>");
  const section = end > 0 ? slice.slice(0, end) : slice;
  return [...section.matchAll(/op_cm_badge[^>]*>([^<]+)</g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function extractOnbidSectionBlock(html, sectionTitle) {
  const idx = html.indexOf(sectionTitle);
  if (idx < 0) return "";
  const next = html.indexOf('<div class="gap_group', idx + sectionTitle.length);
  return next > idx ? html.slice(idx, next) : html.slice(idx, idx + 8000);
}

function extractOnbidCaseRows(html, sectionTitle) {
  const block = extractOnbidSectionBlock(html, sectionTitle);
  if (!block) return [];
  return [...block.matchAll(
    /<div class="tit_box02">\s*<span class="tit01">([^<]+)<\/span>[\s\S]*?<div class="con_area01">[\s\S]*?<span class="tit01">([^<]*)<\/span>/g,
  )]
    .map((match) => ({
      label: match[1].trim(),
      value: match[2].trim() || "-",
    }));
}

function extractOnbidTdText(tdHtml) {
  const amount = tdHtml.match(/<span class="txt03[^"]*">([^<]+)</)?.[1]?.trim();
  const text = tdHtml.match(/<span class="txt01[^"]*">([^<]*)</)?.[1]?.trim();
  return amount || text || "";
}

function extractOnbidAppraisalRows(html) {
  const block = extractOnbidSectionBlock(html, "감정평가정보");
  const tbodyMatch = block.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];

  const rows = [];
  for (const trMatch of tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const tds = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    if (tds.length < 4) continue;

    const pdfMatch = (tds[4] || "").match(/fn_chkPdfRead\('(\d+)','(\d+)','[^']*','([^']+)','([^']+)'/);
    let reportUrl = "";
    if (pdfMatch) {
      reportUrl = buildOnbidFileDownloadUrl(
        {
          atchFileLstNo: pdfMatch[1],
          hashCrpsNo: pdfMatch[4],
          path: "/op/cm/syc/filemng/filemngprcs/FileMngPrcsController/dnldFile.do",
        },
        pdfMatch[2],
        "ORGNL_NM",
      );
    }

    rows.push({
      agency: extractOnbidTdText(tds[0]) || "-",
      appraiser: extractOnbidTdText(tds[1]) || "-",
      date: extractOnbidTdText(tds[2]) || "-",
      amount: extractOnbidTdText(tds[3]) || "-",
      reportUrl,
    });
  }
  return rows;
}

function buildUsageRows(pageMeta, lot) {
  if (pageMeta?.usageRows?.length) return pageMeta.usageRows;
  return [
    { label: "위치 및 주위환경", value: "-" },
    { label: "이용상태", value: "-" },
    { label: "기타사항", value: "-" },
  ];
}

function buildAppraisalRows(pageMeta, lot, detail) {
  if (pageMeta?.appraisalRows?.length) return pageMeta.appraisalRows;

  const detailAppraisals = asArray(detail?.appraisals);
  if (detailAppraisals.length) {
    return detailAppraisals.map((item) => ({
      agency: item.apslEvlOrgNm || item.apslEvlClgNm || item.orgNm || "-",
      appraiser: item.apslEvlPsnNm || "-",
      date: formatOnbidDate(item.apslEvlDt || item.apslDt) || "-",
      amount: formatFullMoney(parseMoney(item.apslPrc ?? item.apslEvlAmt ?? item.apslAmt)),
      reportUrl: extractPhotoUrl(item.atchFileUrl || item.fileUrl || item.urlAdr || item.apslEvlFileUrl || ""),
    }));
  }

  if (lot?.appraised) {
    return [{
      agency: "-",
      appraiser: "-",
      date: "-",
      amount: formatFullMoney(lot.appraised),
      reportUrl: "",
    }];
  }
  return [];
}

function buildDeliveryRows(pageMeta, lot) {
  if (pageMeta?.deliveryRows?.length) return pageMeta.deliveryRows;
  const responsibility = lot?.raw?.evcRsbyTrgtCont || lot?.note?.replace(/^인도인수책임:\s*/, "") || "";
  if (!responsibility) return [{ label: "인도/인수 책임", value: "-" }];
  return [{ label: "인도/인수 책임", value: responsibility }];
}

function parseOnbidDetailHtml(html) {
  if (!html || html.length < 1000) return null;

  const noticeDate = extractOnbidHtmlValue(html, "공고일자");
  const firstNoticeDate = extractOnbidHtmlValue(html, "최초공고일자");
  const bidMethods = extractOnbidBadgesAfterLabel(html, '<span class="tit01">입찰방법</span>');
  const bidRestrictions = extractOnbidBadgesAfterLabel(html, "입찰제한정보");

  const pdfMatch = html.match(/fn_chkPdfRead\('(\d+)','(\d+)','[^']*','([^']+)','([^']+)'/);
  let appraisalUrl = "";
  if (pdfMatch) {
    appraisalUrl = buildOnbidFileDownloadUrl(
      {
        atchFileLstNo: pdfMatch[1],
        hashCrpsNo: pdfMatch[4],
        path: "/op/cm/syc/filemng/filemngprcs/FileMngPrcsController/dnldFile.do",
      },
      pdfMatch[2],
      "ORGNL_NM",
    );
  }

  const usageRows = extractOnbidCaseRows(html, "이용 현황");
  const appraisalRows = extractOnbidAppraisalRows(html);
  const deliveryRows = extractOnbidCaseRows(html, "인도/인수 책임 및 부대조건");

  return {
    noticeDate,
    firstNoticeDate,
    bidMethods,
    bidRestrictions,
    appraisalUrl: appraisalUrl || appraisalRows[0]?.reportUrl || "",
    usageRows,
    appraisalRows,
    deliveryRows,
  };
}

const onbidPageMetaCache = new Map();

async function fetchOnbidPageMeta(lot, detail = null) {
  if (!lot?.id) return null;
  const cacheKey = `${lot.id}:${lot.conditionNo || ""}:${detail?.item?.onbidPbancNo || lot.noticeNo || ""}`;
  if (onbidPageMetaCache.has(cacheKey)) return onbidPageMetaCache.get(cacheKey);

  const url = onbidDetailPageProxyUrl(lot, detail);
  if (!url) return null;

  try {
    const response = await apiFetch(url);
    const html = await response.text();
    if (!response.ok) return null;
    const parsed = parseOnbidDetailHtml(html);
    if (parsed) onbidPageMetaCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function buildAppraisalUrlFromLot(lot, pageMeta, detail = null) {
  const page = pageMeta ?? {};
  if (page.appraisalUrl) return page.appraisalUrl;
  if (page.appraisalRows?.[0]?.reportUrl) return page.appraisalRows[0].reportUrl;

  const appraisalItems = asArray(
    detail?.appraisals
    ?? detail?.item?.apslEvlClgList?.item
    ?? detail?.item?.apslEvlClgList
    ?? detail?.item?.apslEvlList?.item,
  );
  for (const item of appraisalItems) {
    const url = extractPhotoUrl(item.atchFileUrl || item.fileUrl || item.urlAdr || item.apslEvlFileUrl || "");
    if (url) return url;
  }

  const meta = parseOnbidFileDownloadUrl(lot?.thumbnail || lot?.raw?.thnlImgUrlAdr || "");
  if (meta) return buildOnbidFileDownloadUrl(meta, 1, "ORGNL_NM");
  return "";
}

function assetTypeFromLotId(id) {
  const text = String(id || "");
  if (/-0500-/.test(text)) return "car";
  if (/-0600-/.test(text)) return "movable";
  return "realty";
}

function isOnbidLotId(value) {
  const text = String(value || "").trim();
  if (/^\d{4,5}-\d{4,5}-\d{3,6}$/.test(text)) return true;
  const digits = text.replace(/[^\d]/g, "");
  return digits.length === 12 || digits.length === 13 || digits.length === 14;
}

function toOnbidFileProxy(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/onbid-file")) return trimmed;

  try {
    const parsed = new URL(trimmed, "https://www.onbid.co.kr");
    if (parsed.hostname.endsWith("onbid.co.kr")) {
      return `/onbid-file${parsed.pathname}${parsed.search}`;
    }
  } catch {
    if (trimmed.startsWith("/")) return `/onbid-file${trimmed}`;
  }

  return trimmed;
}

function extractPhotoUrl(source) {
  if (!source) return "";
  if (typeof source === "string") return toOnbidFileProxy(source);
  return toOnbidFileProxy(
    source.cltrPotoUrlAdr
    || source.potoUrlAdr
    || source.urlAdr
    || source.imgUrl
    || source.thnlImgUrlAdr
    || source.thnlImgUrl
    || source.fileUrl
    || source.atchFileUrl
    || source.cltrImgUrl
    || source.potoUrl
    || "",
  );
}

function parseOnbidFileDownloadUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, "https://www.onbid.co.kr");
    if (!parsed.pathname.includes("dnldFile.do")) return null;
    const atchFileLstNo = parsed.searchParams.get("atchFileLstNo");
    const hashCrpsNo = parsed.searchParams.get("hashCrpsNo");
    if (!atchFileLstNo || !hashCrpsNo) return null;
    return {
      atchFileLstNo,
      hashCrpsNo,
      path: parsed.pathname,
    };
  } catch {
    return null;
  }
}

function buildOnbidFileDownloadUrl(meta, atchSn, downloadImageKind = "ORGNL_NM") {
  const query = new URLSearchParams({
    atchFileLstNo: meta.atchFileLstNo,
    atchSn: String(atchSn),
    hashCrpsNo: meta.hashCrpsNo,
    downloadImageKind,
  });
  return toOnbidFileProxy(`${meta.path}?${query.toString()}`);
}

const galleryPhotoCache = new Map();

function isImageMagic(bytes) {
  if (!bytes || bytes.length < 4) return false;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return false;
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
  return false;
}

async function probeOnbidPhotoUrl(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PHOTO_PROBE_TIMEOUT_MS) });
    if (!response.ok) return false;

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) return false;

    const reader = response.body?.getReader();
    if (!reader) return false;

    const { value } = await reader.read();
    await reader.cancel().catch(() => {});

    if (!value || value.length < 4 || !isImageMagic(value)) return false;

    const size = Number(response.headers.get("content-length") || 0);
    return size > 10000 || value.length >= 4;
  } catch {
    return false;
  }
}

async function probeGalleryFromThumbnail(thumbnailUrl) {
  const meta = parseOnbidFileDownloadUrl(thumbnailUrl);
  if (!meta) return [];

  const cacheKey = `${meta.atchFileLstNo}:${meta.hashCrpsNo}:v2`;
  if (galleryPhotoCache.has(cacheKey)) {
    return galleryPhotoCache.get(cacheKey);
  }

  const photos = [];
  for (let atchSn = 1; atchSn <= 20; atchSn += 1) {
    const originalUrl = buildOnbidFileDownloadUrl(meta, atchSn, "ORGNL_NM");
    const thumbUrl = buildOnbidFileDownloadUrl(meta, atchSn, "THNL_NM");
    let picked = "";

    if (await probeOnbidPhotoUrl(originalUrl)) {
      picked = originalUrl;
    } else if (await probeOnbidPhotoUrl(thumbUrl)) {
      picked = thumbUrl;
    }

    if (picked) {
      photos.push(picked);
      continue;
    }

    if (photos.length) break;
  }

  galleryPhotoCache.set(cacheKey, photos);
  return photos;
}

function isLikelyImageUrl(url) {
  const lower = String(url || "").toLowerCase();
  if (!lower) return false;
  if (/\.(mp4|m3u8|mov|wmv|avi)(\?|$)/.test(lower)) return false;
  if (/(?:^|[/?&])(vdo|video|360|lrm|lmap)(?:[/?&]|$)/.test(lower)) return false;
  return true;
}

function collectDetailPhotos(item) {
  if (!item || !Object.keys(item).length) return [];

  const buckets = [
    item.potoUrlList,
    item.photoList,
    item.picList,
    item.imgList,
    item.cltrImgList,
    item.potoList,
    item.cltrPotoList,
    item.poto360DgrUrlList,
  ];

  const photos = [];
  for (const bucket of buckets) {
    for (const entry of asArray(bucket?.item ?? bucket)) {
      const url = extractPhotoUrl(entry);
      if (url && isLikelyImageUrl(url)) photos.push(url);
    }
  }

  for (const [key, value] of Object.entries(item)) {
    if (!/poto|photo|pic|img/i.test(key) || /thnl|imgurladr$/i.test(key)) continue;
    for (const entry of asArray(value?.item ?? value)) {
      const url = extractPhotoUrl(entry);
      if (url && isLikelyImageUrl(url)) photos.push(url);
    }
  }

  const thumbnail = extractPhotoUrl(item.thnlImgUrlAdr || item.thnlImgUrl || item.urlAdr);
  if (thumbnail && !photos.includes(thumbnail)) photos.unshift(thumbnail);

  return [...new Set(photos)];
}

function resolveLotPhotos(lot, detail) {
  const photos = [...(detail?.photos || [])];
  const listThumb = extractPhotoUrl(lot?.thumbnail);
  if (listThumb && !photos.includes(listThumb)) photos.unshift(listThumb);
  return photos;
}

async function resolveLotPhotosForDisplay(lot, detail) {
  const fromDetail = resolveLotPhotos(lot, detail);
  const thumbnail = extractPhotoUrl(lot?.thumbnail);

  if (fromDetail.length > 1) return [...new Set(fromDetail)];

  const fromAttachment = thumbnail ? await probeGalleryFromThumbnail(thumbnail) : [];
  const merged = [...new Set([thumbnail, ...fromAttachment, ...fromDetail].filter(Boolean))];
  if (merged.length) return merged;

  return fromDetail.length ? fromDetail : (thumbnail ? [thumbnail] : []);
}

function dedupePhotos(photos) {
  return [...new Set(photos.filter(Boolean))];
}

function AuctionImage({ src, fallbackSrc = "", alt, className = "", showEmptyLabel = true }) {
  const sources = [src, fallbackSrc].filter(Boolean).filter((url, index, urls) => urls.indexOf(url) === index);
  const [sourceIndex, setSourceIndex] = useState(0);
  const currentSrc = sources[sourceIndex] || "";

  useEffect(() => {
    setSourceIndex(0);
  }, [src, fallbackSrc]);

  if (!currentSrc || sourceIndex >= sources.length) {
    if (!showEmptyLabel) return null;
    return <div className={className ? `${className} image-empty` : "image-empty"}>사진 없음</div>;
  }

  return (
    <img
      className={className}
      src={currentSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}

function PhotoGallery({ photos, loading, title }) {
  const [validPhotos, setValidPhotos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setValidPhotos(dedupePhotos(photos));
    setActiveIndex(0);
  }, [photos]);

  const dropPhoto = (index) => {
    setValidPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setActiveIndex((current) => {
      if (index < current) return current - 1;
      if (index === current) return 0;
      return current;
    });
  };

  const activePhoto = validPhotos[activeIndex] || "";

  return (
    <section className="photo-gallery" aria-label="물건 사진">
      {loading && validPhotos.length === 0 && (
        <div className="photo-gallery-empty loading">사진 불러오는 중</div>
      )}
      {activePhoto && (
        <div className="photo-gallery-main">
          <img
            src={activePhoto}
            alt={`${title} 사진 ${activeIndex + 1}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => dropPhoto(activeIndex)}
          />
        </div>
      )}
      {validPhotos.length > 1 && (
        <div className="photo-gallery-thumbs">
          {validPhotos.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              className={index === activeIndex ? "active" : ""}
              aria-label={`${title} 사진 ${index + 1} 보기`}
              onClick={() => setActiveIndex(index)}
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => dropPhoto(index)}
              />
            </button>
          ))}
        </div>
      )}
      {!loading && validPhotos.length > 0 && (
        <p className="photo-gallery-count">사진 {activeIndex + 1} / {validPhotos.length}</p>
      )}
    </section>
  );
}

function formatFullMoney(value, emptyText = "-") {
  if (value == null || value === "") return emptyText;
  const numeric = Number(String(value).replace(/[^\d.]/g, ""));
  if (!numeric) return emptyText;
  return `${numeric.toLocaleString("ko-KR")}원`;
}

function formatAreaMetric(value, usePyeong = false, emptyText = "-") {
  const numeric = Number(value);
  if (!numeric) return emptyText;
  if (usePyeong) return `${(numeric * 0.3025).toFixed(1)}평`;
  return `${numeric.toLocaleString("ko-KR")}m²`;
}

function buildAreaRows(lot, detail) {
  const fromDetail = asArray(detail?.areas).map((entry) => ({
    usage: entry.cltrUsgNm || entry.usgNm || entry.areaDivNm || entry.usgDivNm || "면적",
    area: Number(entry.areaSqms ?? entry.sqms ?? entry.area ?? 0),
    share: entry.alcCntnt || entry.shrCntnt || "-",
    note: entry.rmrkCntnt || entry.rmrk || "-",
  })).filter((row) => row.area > 0);

  if (fromDetail.length) return fromDetail;

  const rows = [];
  if (lot.buildingArea) rows.push({ usage: "건물(건물)", area: lot.buildingArea, share: "-", note: "-" });
  if (lot.landArea) rows.push({ usage: "토지(대)", area: lot.landArea, share: "-", note: "-" });
  const etcArea = Number(lot.raw?.etcSqms ?? lot.raw?.etcAreaSqms ?? 0);
  if (etcArea) rows.push({ usage: "기타(제시외)", area: etcArea, share: "-", note: "-" });
  return rows;
}

function lotCapabilityTags(lot, pageMeta) {
  const meta = pageMeta ?? {};
  const raw = lot?.raw || {};
  const fromApi = [
    raw.collbBidPsblYn === "Y" ? "공동입찰가능" : "",
    raw.subtBidPsblYn === "Y" || raw.agntBidPsblYn === "Y" || raw.prxyBidPsblYn === "Y" ? "대리입찰가능" : "",
    raw.scndRnkAplyPsblYn === "Y" ? "차순위 신청가능" : "",
  ].filter(Boolean);
  return mergeBadgeLists(fromApi, meta.bidMethods);
}

function bidRestrictionTags(lot, pageMeta) {
  const meta = pageMeta ?? {};
  const raw = lot?.raw || {};
  const fromApi = [
    "1인 이상의 유효한 입찰",
    raw.twtmGthrBidPsblYn === "Y" || raw.smlCltrReBidPsblYn === "Y" ? "동일물건 2회 이상 입찰가능" : "",
    raw.sameIpBidPsblYn === "Y" ? "동일IP 중복입찰가능" : "",
  ].filter(Boolean);
  const htmlList = meta.bidRestrictions || [];
  if (htmlList.length > fromApi.filter((tag) => tag !== "1인 이상의 유효한 입찰").length) {
    return htmlList.length ? htmlList : fromApi;
  }
  return mergeBadgeLists(fromApi, htmlList);
}

function photoDisplayFallback(url) {
  if (!url) return "";
  if (url.includes("downloadImageKind=ORGNL_NM")) {
    return url.replace("downloadImageKind=ORGNL_NM", "downloadImageKind=THNL_NM");
  }
  return "";
}

function LotDetailPanel({
  lot,
  detail,
  pageMeta,
  pageMetaLoading,
  detailLoading,
  detailError,
  photos,
  galleryLoading,
  links,
  isSaved,
  onToggleSaved,
  onBidCheck,
  layout = "page",
}) {
  const raw = lot?.raw || {};
  const detailItem = detail?.item || {};
  const [mediaMode, setMediaMode] = useState("photo");
  const [usePyeong, setUsePyeong] = useState(false);
  const [activeTab, setActiveTab] = useState("spec");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoFallbacks, setPhotoFallbacks] = useState({});
  const sectionRefs = useRef({});
  const scrollingToTab = useRef(false);

  const detailTabs = [
    { id: "spec", label: "세부정보" },
    { id: "seized", label: "압류재산정보" },
    { id: "bid", label: "입찰정보" },
    { id: "market", label: "인근 시세 및 낙찰 사례" },
  ];

  useEffect(() => {
    setPhotoIndex(0);
    setPhotoFallbacks({});
    setMediaMode("photo");
  }, [photos, lot?.id]);

  useEffect(() => {
    setActiveTab("spec");
    sectionRefs.current = {};
  }, [lot?.id]);

  function goToDetailTab(tabId) {
    setActiveTab(tabId);
    scrollingToTab.current = true;
    requestAnimationFrame(() => {
      sectionRefs.current[tabId]?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        scrollingToTab.current = false;
      }, 700);
    });
  }

  useEffect(() => {
    const sections = detailTabs
      .map((tab) => sectionRefs.current[tab.id])
      .filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingToTab.current) return;
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const tabId = hit?.target?.getAttribute("data-tab-id");
        if (tabId) setActiveTab(tabId);
      },
      { root: null, rootMargin: "-56px 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.7] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [lot?.id, pageMetaLoading, detailLoading]);

  const displayPhotos = dedupePhotos(photos);
  const photoCount = displayPhotos.length;
  const currentPhoto = photoFallbacks[photoIndex] || displayPhotos[photoIndex] || "";
  const propertyTag = raw.prptDivNm || lot.tags[0] || "공매";
  const dispositionTag = raw.dspsMthodNm || lot.tags[1] || "매각";
  const usageTag = lot.subCategory || lot.category || "용도 확인";
  const roundLeft = String(raw.pbctNsq || lot.round || "-").padStart(3, "0");
  const roundRight = String(lot.conditionNo || raw.pbctCdtnNo || "-").slice(-3).padStart(3, "0");
  const areaRows = buildAreaRows(lot, detail);
  const bidStyle = lot.bidStyle || formatBidStyle(raw);
  const noticeDate = pageMeta?.noticeDate || lot.noticeDate || "-";
  const firstNoticeDate = pageMeta?.firstNoticeDate || lot.firstNoticeDate || noticeDate || "-";
  const capabilityTags = lotCapabilityTags(lot, pageMeta);
  const restrictionTags = bidRestrictionTags(lot, pageMeta);
  const appraisalUrl = buildAppraisalUrlFromLot(lot, pageMeta, detail);
  const usageRows = buildUsageRows(pageMeta, lot);
  const appraisalRows = buildAppraisalRows(pageMeta, lot, detail).map((row) => ({
    ...row,
    reportUrl: row.reportUrl || appraisalUrl,
  }));
  const deliveryRows = buildDeliveryRows(pageMeta, lot);
  const roadAddress = lot.roadAddress || detailItem.rdnmAdrs || raw.rdnmAdrs || raw.roadNmRadr || "-";
  const lotAddress = pickFullLotAddress(lot, detailItem);
  const isSeized = /압류/.test(propertyTag);
  const statusLabel = statusGroup(lot) === "ready" ? "입찰시작 전" : lot.status;
  const deptLine = [raw.chrgDeptNm || raw.dpslDeptNm, raw.chrgTelno || raw.telNo].filter(Boolean).join(" / ");
  const onbidUrl = onbidDetailUrl(lot, detail);

  return (
    <article className={`lot-detail-panel lot-detail-panel--${layout}`}>
      <div className="lot-detail-hero">
        <div className="lot-detail-hero-media">
          <div className="lot-detail-media-stage">
            {galleryLoading && photoCount === 0 && mediaMode === "photo" && (
              <div className="lot-detail-media-empty loading">사진 불러오는 중</div>
            )}
            {mediaMode === "photo" && currentPhoto && (
              <img
                src={currentPhoto}
                alt={`${lot.title} 사진 ${photoIndex + 1}`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => {
                  const original = displayPhotos[photoIndex];
                  const fallback = photoDisplayFallback(original);
                  if (fallback && photoFallbacks[photoIndex] !== fallback) {
                    setPhotoFallbacks((current) => ({ ...current, [photoIndex]: fallback }));
                  }
                }}
              />
            )}
            {mediaMode === "map" && links?.embed && (
              <iframe title={`${lot.title} 위치도`} src={links.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            )}
            {mediaMode === "photo" && !galleryLoading && !currentPhoto && (
              <div className="lot-detail-media-empty">등록된 사진이 없습니다.</div>
            )}
          </div>
          <div className="lot-detail-media-tabs">
            <button type="button" className={mediaMode === "photo" ? "active" : ""} onClick={() => setMediaMode("photo")}>사진</button>
            <button type="button" className={mediaMode === "map" ? "active" : ""} onClick={() => setMediaMode("map")}>위치도</button>
          </div>
          {mediaMode === "photo" && photoCount > 0 && (
            <div className="lot-detail-media-pager">
              <button type="button" aria-label="이전 사진" disabled={photoIndex <= 0} onClick={() => setPhotoIndex((index) => Math.max(0, index - 1))}>
                <ChevronLeft size={18} />
              </button>
              <span>{photoIndex + 1} / {photoCount}</span>
              <button type="button" aria-label="다음 사진" disabled={photoIndex >= photoCount - 1} onClick={() => setPhotoIndex((index) => Math.min(photoCount - 1, index + 1))}>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="lot-detail-hero-info">
          <div className="lot-detail-tags">
            <span className="lot-detail-tag green">{propertyTag}</span>
            <span className="lot-detail-tag blue">{dispositionTag}</span>
            <span className="lot-detail-tag purple">{usageTag}</span>
          </div>

          <div className="lot-detail-title-row">
            <div>
              <p className="lot-detail-id">{lot.id}</p>
              <h2>{lot.title}</h2>
            </div>
            <div className="lot-detail-title-actions">
              <button type="button" className="icon-button" aria-label="관심 물건 저장" onClick={onToggleSaved}>
                <Heart size={19} fill={isSaved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          <div className="lot-detail-quick-actions">
            <a href={links?.kakao} target="_blank" rel="noreferrer">상권분석</a>
            <a href={onbidUrl} target="_blank" rel="noreferrer" onClick={(event) => openExternalUrl(onbidUrl, event)}>등기열람하기</a>
            <a href={links?.kakao} target="_blank" rel="noreferrer">지도</a>
            <a className="primary" href={onbidUrl} target="_blank" rel="noreferrer" onClick={(event) => openExternalUrl(onbidUrl, event)}>공고보기</a>
          </div>

          <div className="lot-detail-spec-grid">
            <div className="lot-detail-spec-item">
              <span>물건종류</span>
              <strong>{propertyTag}</strong>
            </div>
            <div className="lot-detail-spec-item span-2">
              <span>
                면적
                <button type="button" className={`lot-detail-unit-toggle ${usePyeong ? "active" : ""}`} onClick={() => setUsePyeong((value) => !value)}>평</button>
              </span>
              <strong>
                {lot.landArea ? `토지 ${formatAreaMetric(lot.landArea, usePyeong, "")}` : ""}
                {lot.landArea && lot.buildingArea ? ", " : ""}
                {lot.buildingArea ? `건물 ${formatAreaMetric(lot.buildingArea, usePyeong, "")}` : ""}
                {!lot.landArea && !lot.buildingArea ? "-" : ""}
              </strong>
            </div>
            <div className="lot-detail-spec-item span-2">
              <span>입찰방식</span>
              <strong>{bidStyle}</strong>
            </div>
            <div className="lot-detail-spec-item">
              <span>감정평가금액(원)</span>
              <strong>{formatFullMoney(lot.appraised)}</strong>
            </div>
            <div className="lot-detail-spec-item">
              <span>배분요구종기</span>
              <strong>{lot.distributionDue || "-"}</strong>
            </div>
            <div className="lot-detail-spec-item span-2 bid-period">
              <span>입찰기간</span>
              <div>
                <em className={`lot-detail-status ${statusClass(lot.status)}`}>{statusLabel}</em>
                <strong>{lot.starts || "-"} ~ {lot.ends || "-"}</strong>
              </div>
            </div>
            <div className="lot-detail-spec-item">
              <span>회차</span>
              <strong>{roundLeft} / {roundRight}</strong>
            </div>
            <div className="lot-detail-spec-item highlight">
              <span>최저입찰가(원)</span>
              <strong>{formatFullMoney(lot.minimum)}</strong>
            </div>
            <div className="lot-detail-spec-item">
              <span>최초공고일자</span>
              <strong>{firstNoticeDate}</strong>
            </div>
            <div className="lot-detail-spec-item">
              <span>유찰횟수</span>
              <strong>{lot.failedCount ?? 0}회</strong>
            </div>
          </div>
        </div>
      </div>

      <section className="lot-detail-meta-card">
        <ul>
          <li><strong>공고기관</strong><span>{lot.agency || "-"}</span></li>
          <li><strong>담당지점</strong><span>{deptLine || "온비드 원문 확인"}</span></li>
          <li><strong>공매기관</strong><span>{lot.requestAgency || lot.agency || "-"}</span></li>
          <li>
            <strong>공고종류</strong>
            <span className="lot-detail-inline-tag">{raw.pbancDivNm || raw.pbancTypeNm || "일반공고"}</span>
          </li>
          <li><strong>공고일자</strong><span>{noticeDate}</span></li>
        </ul>
        <ul>
          <li className="lot-detail-meta-row-span">
            <strong>입찰방법</strong>
            <div className="lot-detail-chip-row">
              {capabilityTags.length > 0 ? capabilityTags.map((tag) => (
                <span key={tag} className="lot-detail-chip blue">{tag}</span>
              )) : <span className="muted">{pageMetaLoading ? "불러오는 중" : "-"}</span>}
            </div>
          </li>
          <li className="lot-detail-meta-row-span">
            <strong>입찰제한정보</strong>
            <div className="lot-detail-chip-row">
              {restrictionTags.map((tag) => <span key={tag} className="lot-detail-chip gray">{tag}</span>)}
            </div>
          </li>
        </ul>
        {appraisalUrl && (
          <div className="lot-detail-meta-footer">
            <a className="lot-detail-doc-link" href={appraisalUrl} target="_blank" rel="noreferrer">
              <FileText size={16} /> 감정평가서
            </a>
          </div>
        )}
      </section>

      {isSeized && (
        <div className="lot-detail-warning">
          <p>※ 해당 재산은 압류재산입니다. 입찰전 주의사항을 반드시 확인하세요.</p>
          <a href={onbidUrl} target="_blank" rel="noreferrer" onClick={(event) => openExternalUrl(onbidUrl, event)}>입찰 전 주의사항</a>
        </div>
      )}

      <section className="lot-detail-tabs-wrap">
        <div className="lot-detail-tabs" role="tablist" aria-label="물건 상세 탭">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`lot-detail-section-${tab.id}`}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => goToDetailTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="lot-detail-tab-panel" role="tabpanel">
          <section
            id="lot-detail-section-spec"
            data-tab-id="spec"
            className="lot-detail-tab-section"
            ref={(node) => { sectionRefs.current.spec = node; }}
            aria-labelledby="lot-detail-tab-spec"
          >
            <h3 id="lot-detail-tab-spec"><CheckCircle2 size={18} /> 세부정보</h3>
              <div className="lot-detail-section">
                <h4>면적정보</h4>
                <table className="lot-detail-table">
                  <thead>
                    <tr>
                      <th>용도</th>
                      <th>면적</th>
                      <th>지분</th>
                      <th>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaRows.length > 0 ? areaRows.map((row) => (
                      <tr key={`${row.usage}-${row.area}`}>
                        <td>{row.usage}</td>
                        <td>{formatAreaMetric(row.area, usePyeong)}</td>
                        <td>{row.share}</td>
                        <td>{row.note}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4}>면적 상세는 온비드 원문에서 확인하세요.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="lot-detail-section">
                <h4>지역</h4>
                <table className="lot-detail-kv-table">
                  <tbody>
                    <tr>
                      <th>지번</th>
                      <td>{lotAddress}</td>
                    </tr>
                    <tr>
                      <th>도로명</th>
                      <td>{roadAddress}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="lot-detail-section">
                <h4>이용 현황</h4>
                <table className="lot-detail-kv-table lot-detail-usage-table">
                  <tbody>
                    {usageRows.map((row) => (
                      <tr key={row.label}>
                        <th>{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lot-detail-section">
                <h4>감정평가정보</h4>
                <table className="lot-detail-table lot-detail-appraisal-table">
                  <thead>
                    <tr>
                      <th>감정평가기관</th>
                      <th>감정평가사</th>
                      <th>감정평가일</th>
                      <th>감정평가금액(원)</th>
                      <th>감정평가서</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appraisalRows.length > 0 ? appraisalRows.map((row, index) => (
                      <tr key={`${row.agency}-${row.date}-${index}`}>
                        <td>{row.agency}</td>
                        <td>{row.appraiser}</td>
                        <td>{row.date}</td>
                        <td className="lot-detail-appraisal-amount">{row.amount}</td>
                        <td>
                          {row.reportUrl ? (
                            <a className="lot-detail-pdf-link" href={row.reportUrl} target="_blank" rel="noreferrer" aria-label="감정평가서 PDF">
                              <FileText size={18} />
                            </a>
                          ) : "-"}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5}>{pageMetaLoading ? "불러오는 중" : "감정평가정보가 없습니다."}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="lot-detail-section">
                <h4>인도/인수 책임 및 부대조건</h4>
                <table className="lot-detail-kv-table lot-detail-usage-table">
                  <tbody>
                    {deliveryRows.map((row) => (
                      <tr key={row.label}>
                        <th>{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pageMetaLoading && <p className="muted">온비드 상세 정보를 불러오는 중입니다.</p>}
              {detailLoading && <p className="muted">상세 API 조회 중입니다.</p>}
              {detailError && <p className="muted">상세 API 권한이 없어 온비드 원문 기준으로 표시 중입니다.</p>}
          </section>

          <section
            id="lot-detail-section-seized"
            data-tab-id="seized"
            className="lot-detail-tab-section"
            ref={(node) => { sectionRefs.current.seized = node; }}
            aria-labelledby="lot-detail-tab-seized"
          >
            <h3 id="lot-detail-tab-seized"><CheckCircle2 size={18} /> 압류재산정보</h3>
              <div className="lot-detail-field-grid">
                <div className="lot-detail-field">
                  <strong>재산구분</strong>
                  <span>{propertyTag}</span>
                </div>
                <div className="lot-detail-field">
                  <strong>지분물건</strong>
                  <span>{lot.shareYn === "Y" ? "예" : "아니오"}</span>
                </div>
                <div className="lot-detail-field">
                  <strong>수의계약</strong>
                  <span>{lot.privateContractYn === "Y" ? "가능" : "대상 아님"}</span>
                </div>
                <div className="lot-detail-field">
                  <strong>인도인수</strong>
                  <span>{lot.note || "-"}</span>
                </div>
              </div>
          </section>

          <section
            id="lot-detail-section-bid"
            data-tab-id="bid"
            className="lot-detail-tab-section"
            ref={(node) => { sectionRefs.current.bid = node; }}
            aria-labelledby="lot-detail-tab-bid"
          >
            <h3 id="lot-detail-tab-bid"><CheckCircle2 size={18} /> 입찰정보</h3>
              <div className="lot-detail-field-grid">
                <div className="lot-detail-field">
                  <strong>입찰방식</strong>
                  <span>{bidStyle}</span>
                </div>
                <div className="lot-detail-field lot-detail-field-span">
                  <strong>입찰방법</strong>
                  <span className="lot-detail-chip-row">
                    {capabilityTags.length > 0 ? capabilityTags.map((tag) => (
                      <span key={tag} className="lot-detail-chip blue">{tag}</span>
                    )) : "-"}
                  </span>
                </div>
                <div className="lot-detail-field lot-detail-field-span">
                  <strong>입찰제한정보</strong>
                  <span className="lot-detail-chip-row">
                    {restrictionTags.map((tag) => <span key={tag} className="lot-detail-chip gray">{tag}</span>)}
                  </span>
                </div>
                <div className="lot-detail-field">
                  <strong>입찰기간</strong>
                  <span>{lot.starts || "-"} ~ {lot.ends || "-"}</span>
                </div>
                <div className="lot-detail-field">
                  <strong>최저입찰가</strong>
                  <span>{formatFullMoney(lot.minimum)}</span>
                </div>
                <div className="lot-detail-field">
                  <strong>감정평가액</strong>
                  <span>{formatFullMoney(lot.appraised)}</span>
                </div>
                <div className="lot-detail-field">
                  <strong>배분요구종기</strong>
                  <span>{lot.distributionDue || "-"}</span>
                </div>
                <div className="lot-detail-field">
                  <strong>유찰횟수</strong>
                  <span>{lot.failedCount ?? 0}회</span>
                </div>
              </div>
          </section>

          <section
            id="lot-detail-section-market"
            data-tab-id="market"
            className="lot-detail-tab-section"
            ref={(node) => { sectionRefs.current.market = node; }}
            aria-labelledby="lot-detail-tab-market"
          >
            <h3 id="lot-detail-tab-market"><CheckCircle2 size={18} /> 인근 시세 및 낙찰 사례</h3>
            <p className="muted">인근 시세와 낙찰 사례는 온비드 원문에서 확인할 수 있습니다. 하단의 온비드 상세 보기를 이용하세요.</p>
          </section>
        </div>
      </section>

      <div className="lot-detail-footer-actions">
        <a className="secondary-action" href={onbidUrl} target="_blank" rel="noreferrer" onClick={(event) => openExternalUrl(onbidUrl, event)}>온비드 상세 보기 <ExternalLink size={16} /></a>
        <button className="primary-action" type="button" onClick={onBidCheck}>검토표 <ChevronRight size={18} /></button>
      </div>
    </article>
  );
}

function normalizeItems(payload, assetType = "realty") {
  const body = payload?.response?.body ?? payload?.body ?? {};
  const items = body?.items?.item ?? body?.items ?? [];
  const list = asArray(items);

  return list.map((item, index) => {
    const appraised = parseMoney(item.apslPrc ?? item.apslEvlAmt ?? item.frstBidPrc);
    const minimum = parseMoney(item.lowstBidPrc ?? item.lowstBidPrcIndctCont);
    const ratio = Number(item.apslPrcCtrsLowstBidRto ?? item.feeRate);
    const discount = Number.isFinite(ratio)
      ? Math.max(0, Math.round(100 - ratio))
      : appraised && minimum
        ? Math.max(0, Math.round((1 - minimum / appraised) * 100))
        : 0;
    const regionLine = [item.lctnSdnm || item.lctnSidoNm, item.lctnSggnm, item.lctnEmdNm].filter(Boolean).join(" ");
    const title = String(item.onbidCltrNm || "온비드 부동산 물건").trim();
    const address = [title, item.cltrRadr, regionLine]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] || "소재지 확인";

    return {
      id: item.cltrMngNo || `onbid-${index}`,
      assetType,
      conditionNo: item.pbctCdtnNo || "",
      onbidNo: item.onbidCltrno || "",
      noticeNo: item.onbidPbancNo || "",
      pbctNo: item.pbctNo || "",
      round: item.pbctNsq || item.pbctSeq || "",
      title,
      category: item.cltrUsgMclsCtgrNm || item.cltrUsgLclsCtgrNm || "부동산",
      subCategory: item.cltrUsgSclsCtgrNm || "",
      agency: item.orgNm || item.rqstOrgNm || "기관 확인",
      requestAgency: item.rqstOrgNm || "",
      region: item.lctnSdnm || item.lctnSidoNm || address.slice(0, 2) || "전국",
      address: address || "소재지 확인",
      appraised,
      minimum,
      discount,
      starts: formatOnbidDate(item.cltrBidBgngDt),
      ends: formatOnbidDate(item.cltrBidEndDt),
      status: item.pbctStatNm || "상태 확인",
      statusCode: item.pbctStatCd || "",
      risk: item.alcYn === "Y" ? "주의" : Number(item.usbdNft ?? 0) > 0 ? "검토" : "보통",
      tags: [
        item.prptDivNm,
        item.dspsMthodNm,
        item.bidDivNm,
        item.cptnMthodNm,
        item.alcYn === "Y" ? "지분물건" : "",
        item.collbBidPsblYn === "Y" ? "공동입찰 가능" : "",
      ].filter(Boolean),
      note: item.evcRsbyTrgtCont ? `인도인수책임: ${item.evcRsbyTrgtCont}` : "권리관계와 공고문은 온비드 원문에서 확인하세요.",
      thumbnail: extractPhotoUrl(item.thnlImgUrlAdr || item.thnlImgUrl || item.urlAdr || ""),
      landArea: Number(item.landSqms ?? 0),
      buildingArea: Number(item.bldSqms ?? 0),
      shareYn: item.alcYn || "",
      privateContractYn: item.pvctTrgtYn || "",
      distributionDue: item.dtbtRqrEdtmCont || "",
      failedCount: Number(item.usbdNft ?? 0),
      firstNoticeDate: formatOnbidDate(item.frstPbancDt ?? item.frstOpbdDt),
      noticeDate: formatOnbidDate(item.pbancDt ?? item.pbctBegnDt),
      roadAddress: item.rdnmAdrs || item.roadNmRadr || "",
      bidStyle: formatBidStyle(item),
      bidMethod: formatBidStyle(item),
      raw: item,
    };
  });
}

function normalizeResultItems(payload, assetType = "realty") {
  const body = payload?.response?.body ?? payload?.body ?? {};
  const items = body?.items?.item ?? body?.items ?? [];
  const list = asArray(items);

  return list.map((item, index) => {
    const appraised = parseMoney(item.apslEvlAmt ?? item.apslPrc ?? item.frstBidPrc);
    const minimum = parseMoney(item.lowstBidPrc ?? item.lowstBidPrcIndctCont ?? item.sfbidPrc);
    const soldAmount = parseMoney(item.scfbAmt ?? item.scsbidAmt ?? item.bidPrc);
    const regionLine = [item.lctnSdnm || item.lctnSidoNm, item.lctnSggnm, item.lctnEmdNm].filter(Boolean).join(" ");
    const title = String(item.onbidCltrNm || item.cltrNm || "온비드 입찰결과 물건").trim();
    const address = [title, item.cltrRadr, item.addr, regionLine]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] || item.onbidCltrNm || "소재지 확인";
    const status = item.pbctStatNm || (item.pbctStatCd === "0010" ? "낙찰" : item.pbctStatCd === "0011" ? "유찰" : "입찰결과");
    const ratio = Number(item.scfbRate ?? item.scsbidRate ?? item.feeRate);
    const discount = Number.isFinite(ratio)
      ? Math.max(0, Math.round(100 - ratio))
      : appraised && (soldAmount || minimum)
        ? Math.max(0, Math.round((1 - (soldAmount || minimum) / appraised) * 100))
        : 0;

    return {
      id: item.cltrMngNo || `result-${index}`,
      assetType,
      conditionNo: item.pbctCdtnNo || "",
      onbidNo: item.onbidCltrno || "",
      noticeNo: item.onbidPbancNo || "",
      pbctNo: item.pbctNo || "",
      round: item.pbctNsq || item.pbctSeq || "",
      title,
      category: item.cltrUsgMclsCtgrNm || item.cltrUsgLclsCtgrNm || "부동산",
      subCategory: item.cltrUsgSclsCtgrNm || "",
      agency: item.orgNm || item.rqstOrgNm || "기관 확인",
      requestAgency: item.rqstOrgNm || "",
      region: item.lctnSdnm || item.lctnSidoNm || address.slice(0, 2) || "전국",
      address: address || item.onbidCltrNm || "소재지 확인",
      appraised,
      minimum: soldAmount || minimum,
      discount,
      starts: formatOnbidDate(item.cltrOpbdDt ?? item.opbdDt ?? item.opbdDtm ?? item.cltrBidBgngDt),
      ends: formatOnbidDate(item.cltrOpbdDt ?? item.opbdDt ?? item.opbdDtm ?? item.cltrBidEndDt),
      status,
      statusCode: item.pbctStatCd || "",
      risk: status.includes("유찰") ? "재입찰 검토" : status.includes("낙찰") ? "결과 확인" : "검토",
      tags: [
        item.prptDivNm,
        item.dspsMthodNm,
        item.bidDivNm,
        item.cptnMthodNm,
        item.usbdNft ? `유찰 ${item.usbdNft}회` : "",
        item.vldBddrNope != null ? `유효입찰 ${item.vldBddrNope}명` : "",
      ].filter(Boolean),
      note: `입찰결과 목록 API 기준 ${status} 물건입니다. 낙찰가와 개찰일시는 원문에서 최종 확인하세요.`,
      thumbnail: extractPhotoUrl(item.thnlImgUrlAdr || item.thnlImgUrl || item.urlAdr || ""),
      landArea: Number(item.landSqms ?? 0),
      buildingArea: Number(item.bldSqms ?? 0),
      shareYn: item.alcYn || "",
      privateContractYn: item.pvctTrgtYn || "",
      distributionDue: item.dtbtRqrEdtmCont || "",
      raw: item,
    };
  });
}

function normalizeDetail(payload) {
  const body = payload?.response?.body ?? payload?.body ?? {};
  const item = asArray(body?.items?.item ?? body?.items)[0] ?? body?.item ?? {};
  const photos = collectDetailPhotos(item);

  return {
    item,
    photos,
    thumbnail: photos[0] || "",
    appraisals: asArray(item?.apslEvlClgList?.item ?? item?.apslEvlClgList ?? item?.apslEvlList?.item),
    areas: asArray(item?.areaDtlList?.item ?? item?.areaDtlList ?? item?.rlstAreaList?.item),
  };
}

async function fetchOnbidLots(filters) {
  const listPath = listPathsByAssetType[filters.assetType] || ONBID_LIST_PATH;
  const params = new URLSearchParams({
    pageNo: String(filters.pageNo),
    numOfRows: String(filters.numOfRows),
    resultType: "json",
  });

  if (filters.propertyType) params.set("prptDivCd", filters.propertyType);
  if (filters.privateContract) params.set("pvctTrgtYn", filters.privateContract);
  if (filters.bidType) params.set("bidDivCd", filters.bidType);
  if (filters.managementNo?.trim()) params.set("cltrMngNo", filters.managementNo.trim());
  else if (filters.keyword.trim()) params.set("onbidCltrNm", filters.keyword.trim());
  if (filters.region !== "전체") params.set("lctnSdnm", filters.region);
  if (filters.statusCode) params.set("pbctStatCd", filters.statusCode);
  if (filters.dspsMethod) params.set("dspsMthodCd", filters.dspsMethod);
  if (filters.usageCategoryId) params.set("cltrUsgMclsCtgrId", filters.usageCategoryId);

  const url = `${API_BASE}${listPath}?${params.toString()}`;
  const response = await apiFetch(url);
  const text = await response.text();

  if (!response.ok) {
    const assetLabel = homeAssetTypes.find((item) => item.value === filters.assetType)?.label || "온비드";
    if (response.status === 403 && filters.assetType === "movable") {
      throw new Error("동산 물건목록 조회서비스가 이 인증키에 아직 승인되지 않았습니다. 공공데이터포털에서 '한국자산관리공사_차세대 온비드 동산 물건목록 조회서비스' 활용신청 상태를 확인해주세요.");
    }
    if (response.status === 403) throw new Error(`${assetLabel} 물건목록 조회서비스가 이 인증키에 아직 승인되지 않았습니다.`);
    throw new Error(`온비드 목록 API HTTP ${response.status}: ${text || response.statusText}`);
  }

  const payload = JSON.parse(text);
  const header = payload?.response?.header ?? payload?.header;
  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(`${header.resultCode} ${header.resultMsg ?? "API 오류"}`);
  }

  const body = payload?.response?.body ?? payload?.body ?? {};
  return {
    lots: normalizeItems(payload, filters.assetType || "realty"),
    pageNo: Number(body.pageNo ?? filters.pageNo),
    numOfRows: Number(body.numOfRows ?? filters.numOfRows),
    totalCount: Number(body.totalCount ?? 0),
  };
}

async function fetchLotFromListByManagementNo(lotId, assetType) {
  const baseFilters = {
    assetType,
    managementNo: lotId,
    propertyType: "",
    privateContract: "",
    pageNo: 1,
    numOfRows: 10,
    keyword: "",
    region: "전체",
    bidType: "",
    statusCode: "",
    dspsMethod: "",
    usageCategoryId: "",
  };

  try {
    const result = await fetchOnbidLots(baseFilters);
    const direct = result.lots.find((lot) => lot.id === lotId);
    if (direct) return direct;
  } catch {
    // 물건관리번호 단건 조회 실패 시 아래 조합 검색으로 폴백
  }

  const propertyTypes = assetType === "movable"
    ? ["0007", "0010", "0005", "0004", "0002"]
    : ["0007", "0010", "0005", "0002", "0008"];

  for (const propertyType of propertyTypes) {
    for (const privateContract of ["N", "Y"]) {
      try {
        const result = await fetchOnbidLots({ ...baseFilters, propertyType, privateContract });
        const found = result.lots.find((lot) => lot.id === lotId);
        if (found) return found;
      } catch {
        // 다음 조합 시도
      }
    }
  }
  return null;
}

async function fetchLotFromDetail(lotId, assetType) {
  try {
    const detail = await fetchOnbidDetail({ assetType }, { id: lotId, conditionNo: "", assetType });
    const item = detail?.item;
    if (!item || !Object.keys(item).length) return null;
    const [lot] = normalizeItems({ response: { body: { items: { item } } } }, assetType);
    return lot?.id ? lot : null;
  } catch {
    return null;
  }
}

async function fetchLotByManagementNo(lotId, preferredAssetType = "realty") {
  if (!lotId) return null;

  const lookupAssetType = async (assetType) => {
    const fromList = await fetchLotFromListByManagementNo(lotId, assetType);
    if (fromList) return fromList;
    return fetchLotFromDetail(lotId, assetType);
  };

  const preferred = await lookupAssetType(preferredAssetType);
  if (preferred) return preferred;

  const otherTypes = ["realty", "movable", "car"].filter((type) => type !== preferredAssetType);
  for (const assetType of otherTypes) {
    const found = await lookupAssetType(assetType);
    if (found) return found;
  }
  return null;
}

async function fetchOnbidResultLots(filters) {
  const { start, end } = resultDateRange();
  const params = new URLSearchParams({
    pageNo: String(filters.pageNo),
    numOfRows: String(filters.numOfRows),
    resultType: "json",
    cltrTypeCd: resultCltrTypeCodes[filters.assetType] || "0001",
    prptDivCd: filters.propertyType,
    opbdDtStart: start,
    opbdDtEnd: end,
  });

  if (filters.keyword.trim()) params.set("onbidCltrNm", filters.keyword.trim());
  if (filters.bidType) params.set("bidDivCd", filters.bidType);
  if (filters.statusCode) params.set("pbctStatCd", filters.statusCode);
  if (filters.dspsMethod) params.set("dspsMthodCd", filters.dspsMethod);
  if (filters.usageCategoryId) params.set("cltrUsgMclsCtgrId", filters.usageCategoryId);

  const url = `${API_BASE}${ONBID_RESULT_LIST_PATH}?${params.toString()}`;
  const response = await apiFetch(url);
  const text = await response.text();

  if (!response.ok) {
    if (response.status === 403) throw new Error("입찰결과목록 조회서비스가 이 인증키에 아직 승인되지 않았습니다.");
    throw new Error(`온비드 입찰결과목록 API HTTP ${response.status}: ${text || response.statusText}`);
  }

  const payload = JSON.parse(text);
  const header = payload?.response?.header ?? payload?.header;
  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(`${header.resultCode} ${header.resultMsg ?? "입찰결과목록 API 오류"}`);
  }

  const body = payload?.response?.body ?? payload?.body ?? {};
  return {
    lots: normalizeResultItems(payload, filters.assetType || "realty"),
    pageNo: Number(body.pageNo ?? filters.pageNo),
    numOfRows: Number(body.numOfRows ?? filters.numOfRows),
    totalCount: Number(body.totalCount ?? 0),
  };
}

async function fetchOnbidCount(filters, statusCode = "") {
  const nextFilters = { ...filters, pageNo: 1, numOfRows: 1, statusCode };
  const result = isResultFocus(statusCode === "0010" ? "sold" : statusCode === "0011" ? "failed" : "")
    ? await fetchOnbidResultLots(nextFilters)
    : await fetchOnbidLots(nextFilters);
  return result.totalCount || result.lots.length || 0;
}

async function fetchOnbidDetail(filters, lot) {
  if (!lot?.id) return null;
  const assetType = lot.assetType || filters.assetType;
  const cacheKey = `${assetType}:${lot.id}:${lot.conditionNo || ""}`;
  if (detailResponseCache.has(cacheKey)) {
    return detailResponseCache.get(cacheKey);
  }

  const detailPath = detailPathsByAssetType[assetType] || ONBID_DETAIL_PATH;
  const params = new URLSearchParams({
    resultType: "json",
    cltrMngNo: lot.id,
  });
  if (lot.conditionNo) params.set("pbctCdtnNo", String(lot.conditionNo));

  const response = await apiFetch(`${API_BASE}${detailPath}?${params.toString()}`);
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 403) throw new Error("부동산 물건상세 조회서비스가 이 키에 아직 승인되지 않았습니다.");
    throw new Error(`상세 API HTTP ${response.status}: ${text || response.statusText}`);
  }

  const payload = JSON.parse(text);
  const header = payload?.response?.header ?? payload?.header;
  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(`${header.resultCode} ${header.resultMsg ?? "상세 API 오류"}`);
  }
  const normalized = normalizeDetail(payload);
  detailResponseCache.set(cacheKey, normalized);
  return normalized;
}

function getQuestionComments(question) {
  return Array.isArray(question?.comments) ? question.comments : [];
}

function getCommentsByParent(comments, parentId = null) {
  return comments
    .filter((comment) => (comment.parentId || null) === parentId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function formatCommentAuthor(author) {
  const name = String(author || "비회원");
  return name.slice(0, 4);
}

function getCurrentAuthor(member) {
  return member?.name || "비회원";
}

function isOwnComment(comment, currentAuthor) {
  return String(comment?.author || "비회원") === currentAuthor;
}

function collectCommentBranchIds(comments, rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    comments.forEach((comment) => {
      if (comment.parentId && ids.has(comment.parentId) && !ids.has(comment.id)) {
        ids.add(comment.id);
        changed = true;
      }
    });
  }
  return ids;
}

function BoardCommentSection({
  question,
  currentAuthor,
  replyingTo,
  commentDraft,
  editingComment,
  editCommentDraft,
  onDraftChange,
  onSubmit,
  onReply,
  onCancelReply,
  onEditStart,
  onEditDraftChange,
  onEditSave,
  onEditCancel,
  onDelete,
}) {
  const comments = getQuestionComments(question);
  const isReplyingHere = replyingTo.questionId === question.id;
  const replyTarget = isReplyingHere
    ? comments.find((comment) => comment.id === replyingTo.parentId)
    : null;

  function renderBranch(parentId = null, depth = 0) {
    return getCommentsByParent(comments, parentId).map((comment) => {
      const isEditing = editingComment.questionId === question.id && editingComment.commentId === comment.id;
      const isOwn = isOwnComment(comment, currentAuthor);

      return (
      <article key={comment.id} className={`board-comment ${depth ? "is-child" : ""}`}>
        <p className="board-comment-line">
          <strong className="board-comment-author">{formatCommentAuthor(comment.author)}</strong>
          <span className="board-comment-date">{comment.createdAt}</span>
          {isEditing ? (
            <form className="board-comment-edit" onSubmit={(event) => onEditSave(event, question.id)}>
              <textarea
                value={editCommentDraft}
                onChange={(event) => onEditDraftChange(event.target.value)}
                rows={2}
                required
              />
              <span className="board-comment-edit-actions">
                <button type="submit" className="board-comment-action">저장</button>
                <button type="button" className="board-comment-action" onClick={onEditCancel}>취소</button>
              </span>
            </form>
          ) : (
            <span className="board-comment-body">
              <span className="board-comment-text">{comment.body}</span>
              <button type="button" className="board-comment-reply" onClick={() => onReply(question.id, comment.id)}>
                답글
              </button>
              {isOwn && (
                <>
                  <button type="button" className="board-comment-action" onClick={() => onEditStart(question.id, comment)}>
                    수정
                  </button>
                  <button type="button" className="board-comment-action danger" onClick={() => onDelete(question.id, comment.id)}>
                    삭제
                  </button>
                </>
              )}
            </span>
          )}
        </p>
        {getCommentsByParent(comments, comment.id).length > 0 && (
          <div className="board-comment-children">
            {renderBranch(comment.id, depth + 1)}
          </div>
        )}
      </article>
      );
    });
  }

  return (
    <section className="board-comments" aria-label="댓글">
      <div className="board-comments-head">
        <strong>댓글 {comments.length}</strong>
        {isReplyingHere && replyingTo.parentId && (
          <button type="button" className="plain-action" onClick={onCancelReply}>답글 취소</button>
        )}
      </div>
      <div className="board-comment-tree">
        {comments.length === 0 ? (
          <p className="board-comment-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
        ) : (
          renderBranch()
        )}
      </div>
      {replyTarget && (
        <p className="board-reply-hint">{replyTarget.author}님에게 답글 작성 중</p>
      )}
      <form className="board-comment-form" onSubmit={(event) => onSubmit(event, question.id)}>
        <textarea
          value={commentDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={replyTarget ? "답글을 입력하세요." : "댓글을 입력하세요."}
          rows={2}
          required
        />
        <button className="board-comment-submit" type="submit">{replyTarget ? "답글 등록" : "댓글 등록"}</button>
      </form>
    </section>
  );
}

function readInitialRoute() {
  return parseAppHash(window.location.hash);
}

function App() {
  const initialRoute = readInitialRoute();
  const [view, setView] = useState(initialRoute.view);
  const [statusFocus, setStatusFocus] = useState("");
  const [checkMode, setCheckMode] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [quickKeyword, setQuickKeyword] = useState("");
  const [homeAssetType, setHomeAssetType] = useState(
    initialRoute.selectedId ? assetTypeFromLotId(initialRoute.selectedId) : "realty",
  );
  const [homeDisposition, setHomeDisposition] = useState("all");
  const [homeUsage, setHomeUsage] = useState("");
  const [dspsMethod, setDspsMethod] = useState("");
  const [usageCategoryId, setUsageCategoryId] = useState("");
  const [propertyType, setPropertyType] = useState("0007");
  const [bidType, setBidType] = useState("0001");
  const [privateContract, setPrivateContract] = useState("N");
  const [region, setRegion] = useState("전체");
  const [sortBy, setSortBy] = useState("deadline");
  const [pageNo, setPageNo] = useState(1);
  const [data, setData] = useState({ lots: sampleLots, totalCount: sampleLots.length, sample: true });
  const [statusTotals, setStatusTotals] = useState({});
  const [selectedId, setSelectedId] = useState(initialRoute.selectedId || sampleLots[0].id);
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("onbidSavedLots") || "[]");
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [pageMeta, setPageMeta] = useState(null);
  const [pageMetaLoading, setPageMetaLoading] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [error, setError] = useState("");
  const [member, setMember] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("auctionMember") || "null");
    } catch {
      return null;
    }
  });
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [boardSearch, setBoardSearch] = useState("");
  const [boardStatus, setBoardStatus] = useState("all");
  const [boardWriteOpen, setBoardWriteOpen] = useState(false);
  const [openQuestionId, setOpenQuestionId] = useState("");
  const [replyingTo, setReplyingTo] = useState({ questionId: "", parentId: "" });
  const [commentDraft, setCommentDraft] = useState("");
  const [editingComment, setEditingComment] = useState({ questionId: "", commentId: "" });
  const [editCommentDraft, setEditCommentDraft] = useState("");
  const [questionForm, setQuestionForm] = useState({ title: "", body: "", category: "물건검토" });
  const [questions, setQuestions] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("auctionQuestions") || "[]");
      if (stored.length) return stored;
    } catch {
      // ignore malformed localStorage
    }
    return [
      {
        id: "sample-q-3",
        number: 3,
        title: "유찰 12회 물건은 최저가만 보고 들어가도 괜찮을까요?",
        body: "권리관계와 점유 여부를 먼저 확인해야 할 것 같습니다. 확인 순서를 알고 싶습니다.",
        category: "입찰전략",
        author: "freecompr20",
        createdAt: "2026.06.21",
        status: "답변대기",
        views: 28,
        comments: [],
      },
      {
        id: "sample-q-2",
        number: 2,
        title: "공동입찰 가능 물건은 어디서 확인하나요?",
        body: "목록에서 공동입찰 가능 여부가 보이는데 상세에서 다시 확인하는 위치가 궁금합니다.",
        category: "이용문의",
        author: "온비드초보",
        createdAt: "2026.06.20",
        status: "답변완료",
        views: 41,
        comments: [
          {
            id: "sample-c-2-1",
            parentId: null,
            author: "공매도우미",
            body: "목록 카드 태그와 상세 패널의 입찰 정보에서 공동입찰 가능 여부를 함께 확인할 수 있습니다.",
            createdAt: "2026.06.20",
          },
          {
            id: "sample-c-2-2",
            parentId: "sample-c-2-1",
            author: "온비드초보",
            body: "상세 패널 어디에 표시되는지 알려주실 수 있을까요?",
            createdAt: "2026.06.20",
          },
          {
            id: "sample-c-2-3",
            parentId: "sample-c-2-2",
            author: "공매도우미",
            body: "상세 화면 하단 검토 체크 영역과 온비드 원문 링크를 같이 보면 됩니다.",
            createdAt: "2026.06.21",
          },
        ],
      },
      {
        id: "sample-q-1",
        number: 1,
        title: "토지와 건물 면적이 따로 나오는 물건 해석 문의",
        body: "목록에 토지면적과 건물면적이 함께 표시되는 경우 어떤 서류를 먼저 봐야 하나요?",
        category: "권리분석",
        author: "비회원",
        createdAt: "2026.06.19",
        status: "답변완료",
        views: 36,
        comments: [
          {
            id: "sample-c-1-1",
            parentId: null,
            author: "권리분석러",
            body: "우선 등기사항전부증명서와 감정평가서를 확인하고, 공고문의 면적 표기와 대조하는 순서가 좋습니다.",
            createdAt: "2026.06.19",
          },
        ],
      },
    ];
  });

  const filteredQuestions = useMemo(() => {
    const query = boardSearch.trim().toLowerCase();
    return questions
      .filter((question) => {
      const statusOk = boardStatus === "all" || question.status === boardStatus;
      const queryOk = !query || [question.title, question.body, question.category, question.author].some((value) => String(value || "").toLowerCase().includes(query));
      return statusOk && queryOk;
    })
      .sort((a, b) => Number(b.number || 0) - Number(a.number || 0));
  }, [questions, boardSearch, boardStatus]);

  useEffect(() => {
    setOpenQuestionId("");
    setReplyingTo({ questionId: "", parentId: "" });
    setCommentDraft("");
    setEditingComment({ questionId: "", commentId: "" });
    setEditCommentDraft("");
  }, [boardSearch, boardStatus]);

  const sortedLots = useMemo(() => {
    const base = data.sample ? sampleLots : data.lots;
    const viewFiltered = view === "watch" ? base.filter((lot) => saved.includes(lot.id)) : base;
    const focused = viewFiltered.filter((lot) => matchesStatusFocus(lot, statusFocus));
    const checked = checkMode ? focused.filter(needsBidCheck) : focused;
    const next = [...(checked.length || view === "watch" || statusFocus || checkMode ? checked : base)];
    next.sort((a, b) => {
      if (checkMode) return daysLeft(a.ends) - daysLeft(b.ends) || b.discount - a.discount;
      if (sortBy === "priceAsc") return (a.minimum ?? Number.MAX_SAFE_INTEGER) - (b.minimum ?? Number.MAX_SAFE_INTEGER);
      if (sortBy === "appraisedDesc") return (b.appraised ?? 0) - (a.appraised ?? 0);
      if (sortBy === "discountDesc") return b.discount - a.discount;
      return toDateValue(a.ends) - toDateValue(b.ends);
    });
    return next;
  }, [data.lots, sortBy, statusFocus, view, saved, checkMode]);

  const statusCounts = useMemo(() => {
    const base = data.sample ? sampleLots : data.lots;
    const counts = Object.fromEntries(
      statusTiles.map((tile) => [tile.value, base.filter((lot) => matchesStatusFocus(lot, tile.value)).length]),
    );
    if (!data.sample && data.totalCount) counts.available = data.totalCount;
    Object.assign(counts, statusTotals);
    return counts;
  }, [data.lots, data.sample, data.totalCount, statusTotals]);

  const selected = sortedLots.find((lot) => lot.id === selectedId)
    ?? (selectedId
      ? {
          id: selectedId,
          assetType: assetTypeFromLotId(selectedId),
          conditionNo: "",
          title: selectedId,
          agency: "온비드",
          address: "",
          tags: [],
          thumbnail: "",
          appraised: null,
          minimum: null,
          discount: 0,
          status: "상세 조회",
          starts: "",
          ends: "",
          note: "상세 API에서 물건 정보를 불러오는 중입니다.",
        }
      : sortedLots[0]);
  const selectedLot = useMemo(() => mergeLotWithDetail(selected, detail), [selected, detail]);
  const links = selectedLot ? mapLinks(selectedLot) : null;
  const displayPhotos = galleryPhotos;
  const totalMinimum = sortedLots.reduce((sum, lot) => sum + (lot.minimum ?? 0), 0);
  const averageDiscount = Math.round(sortedLots.reduce((sum, lot) => sum + lot.discount, 0) / sortedLots.length || 0);
  const visibleTotal = statusFocus || checkMode || view === "watch" ? sortedLots.length : data.totalCount || sortedLots.length;

  const activeFilters = useMemo(
    () => ({
      keyword,
      propertyType,
      bidType,
      privateContract,
      region,
      pageNo,
      numOfRows: PAGE_SIZE,
      statusCode: statusCodeForFocus(statusFocus),
      dspsMethod,
      usageCategoryId,
      assetType: homeAssetType,
    }),
    [keyword, propertyType, bidType, privateContract, region, pageNo, statusFocus, dspsMethod, usageCategoryId, homeAssetType],
  );

  async function loadLots(filters = activeFilters) {
    setLoading(true);
    setError("");
    let loadingGuard = null;
    try {
      loadingGuard = window.setTimeout(() => {
        setLoading(false);
      }, API_FETCH_TIMEOUT_MS + 5000);

      const preserveId = filters.preserveSelectedId
        ? normalizeLotId(filters.preserveSelectedId)
        : (view === "detail" && selectedId ? normalizeLotId(selectedId) : "");
      if (preserveId && !filters.keyword?.trim() && !filters.statusCode) {
        const assetType = filters.assetType || assetTypeFromLotId(preserveId);
        const foundLot = await fetchLotByManagementNo(preserveId, assetType);
        if (foundLot) {
          setHomeAssetType(foundLot.assetType || assetType);
          if ((foundLot.assetType || assetType) !== "realty") {
            setHomeUsage("");
            setUsageCategoryId("");
          }
          setData({ lots: [foundLot], pageNo: 1, numOfRows: PAGE_SIZE, totalCount: 1, sample: false });
          setSelectedId(preserveId);
          setStatusTotals({ available: 1, ready: matchesStatusFocus(foundLot, "ready") ? 1 : 0, sold: 0, failed: 0 });
          return;
        }

        setData({ lots: [], pageNo: 1, numOfRows: PAGE_SIZE, totalCount: 0, sample: false });
        setSelectedId(preserveId);
        setStatusTotals({ available: 0, ready: 0, sold: 0, failed: 0 });
        setError("해당 물건관리번호를 찾지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const keywordLotId = isOnbidLotId(filters.keyword) ? normalizeLotId(filters.keyword.trim()) : "";
      if (keywordLotId && !filters.statusCode) {
        const assetType = assetTypeFromLotId(keywordLotId);
        const foundLot = await fetchLotByManagementNo(keywordLotId, assetType);
        if (foundLot) {
          setHomeAssetType(assetType);
          if (assetType !== "realty") {
            setHomeUsage("");
            setUsageCategoryId("");
          }
          setData({ lots: [foundLot], pageNo: 1, numOfRows: PAGE_SIZE, totalCount: 1, sample: false });
          setSelectedId(keywordLotId);
          setStatusTotals({ available: 1, ready: matchesStatusFocus(foundLot, "ready") ? 1 : 0, sold: 0, failed: 0 });
          return;
        }

        setHomeAssetType(assetType);
        setData({ lots: [], pageNo: 1, numOfRows: PAGE_SIZE, totalCount: 0, sample: false });
        setSelectedId(keywordLotId);
        setStatusTotals({ available: 0, ready: 0, sold: 0, failed: 0 });
        if (filters.preserveSelectedId) return;

        setError("해당 물건관리번호를 찾지 못했습니다. 번호를 확인하거나 온비드에서 직접 조회해보세요.");
        return;
      }
      const result = filters.statusCode === "0010" || filters.statusCode === "0011"
        ? await fetchOnbidResultLots(filters)
        : await fetchOnbidLots(filters);
      if (filters.preserveSelectedId && !result.lots.some((lot) => lot.id === filters.preserveSelectedId)) {
        const normalizedId = normalizeLotId(filters.preserveSelectedId);
        const foundLot = await fetchLotByManagementNo(normalizedId, assetTypeFromLotId(normalizedId)).catch(() => null);
        if (foundLot) {
          result.lots = [foundLot, ...result.lots.filter((lot) => lot.id !== foundLot.id)];
          result.totalCount = Math.max(result.totalCount || 0, result.lots.length);
        }
      }
      setData({ ...result, sample: false });
      const nextSelectedId = preserveId
        || (result.lots.some((lot) => lot.id === selectedId) ? selectedId : "")
        || result.lots[0]?.id
        || "";
      setSelectedId(nextSelectedId);
      if (!filters.statusCode) {
        const availableCount = result.totalCount || result.lots.length;
        window.setTimeout(() => {
          Promise.all([
            fetchOnbidCount(filters, "0001").catch(() => 0),
            fetchOnbidCount(filters, "0010").catch(() => 0),
            fetchOnbidCount(filters, "0011").catch(() => 0),
          ]).then(([ready, sold, failed]) => {
            setStatusTotals({ ready, sold, failed, available: availableCount });
          });
        }, 0);
      }
    } catch (err) {
      if (filters.statusCode === "0010" || filters.statusCode === "0011") {
        setData({ lots: [], totalCount: 0, sample: false });
        setSelectedId("");
      } else if (filters.assetType && filters.assetType !== "realty") {
        setData({ lots: [], totalCount: 0, sample: false });
        setSelectedId("");
      } else {
        setData({ lots: sampleLots, totalCount: sampleLots.length, sample: true });
        if (!(view === "detail" && selectedId)) {
          setSelectedId(sampleLots[0].id);
        }
      }
      setError(err instanceof Error ? err.message : "온비드 API 호출에 실패했습니다.");
    } finally {
      if (loadingGuard) window.clearTimeout(loadingGuard);
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("onbidSavedLots", JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    localStorage.setItem("auctionQuestions", JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    if (member) localStorage.setItem("auctionMember", JSON.stringify(member));
    else localStorage.removeItem("auctionMember");
  }, [member]);

  useEffect(() => {
    const { view: initialView, selectedId: initialSelectedId } = parseAppHash(window.location.hash);
    const inferredAssetType = initialSelectedId ? assetTypeFromLotId(initialSelectedId) : homeAssetType;

    setView(initialView);
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      setHomeAssetType(inferredAssetType);
      if (inferredAssetType !== "realty") {
        setHomeUsage("");
        setUsageCategoryId("");
      }
    }

    window.history.replaceState(
      { appView: initialView, selectedId: initialSelectedId },
      "",
      initialSelectedId ? `#${initialView}-${encodeURIComponent(initialSelectedId)}` : `#${initialView}`,
    );

    const initialFilters = {
      keyword,
      propertyType,
      bidType,
      privateContract,
      region,
      pageNo: 1,
      numOfRows: PAGE_SIZE,
      statusCode: "",
      dspsMethod,
      usageCategoryId: inferredAssetType === "realty" ? usageCategoryId : "",
      assetType: inferredAssetType,
      preserveSelectedId: initialSelectedId,
    };
    loadLots(initialFilters);

    function applyRouteFromLocation(state = {}, preferHash = false) {
      const parsed = parseAppHash(window.location.hash);
      const nextView = preferHash
        ? (parsed.view || state.appView || "home")
        : (state.appView || parsed.view || "home");
      const nextSelectedId = preferHash
        ? (parsed.selectedId || state.selectedId || "")
        : (state.selectedId || parsed.selectedId || "");
      setView(nextView);
      if (nextSelectedId) setSelectedId(nextSelectedId);
      if ((nextView || "home") !== "search") {
        setCheckMode(false);
        setStatusFocus("");
      }
    }

    function handlePopState(event) {
      applyRouteFromLocation(event.state || {}, false);
    }

    function handleHashChange() {
      applyRouteFromLocation(window.history.state || {}, true);
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (view !== "detail" || !selectedId) return;
    scrollPageToTop();
  }, [view, selectedId]);

  useEffect(() => {
    if (!selected || data.sample) {
      setDetail(null);
      setDetailError("");
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    fetchOnbidDetail(activeFilters, selected)
      .then((nextDetail) => {
        if (!cancelled) setDetail(nextDetail);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "상세 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.conditionNo, selected?.assetType, data.sample]);

  useEffect(() => {
    if (!selected || data.sample) {
      setPageMeta(null);
      return;
    }

    let cancelled = false;
    setPageMetaLoading(true);
    fetchOnbidPageMeta(selectedLot, detail)
      .then((nextMeta) => {
        if (!cancelled) setPageMeta(nextMeta);
      })
      .catch(() => {
        if (!cancelled) setPageMeta(null);
      })
      .finally(() => {
        if (!cancelled) setPageMetaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLot?.id, selectedLot?.conditionNo, selectedLot?.onbidNo, selectedLot?.pbctNo, selectedLot?.noticeNo, detail?.item, data.sample]);

  useEffect(() => {
    if (!selected || data.sample || loading) {
      setGalleryPhotos([]);
      setGalleryLoading(false);
      return undefined;
    }

    let cancelled = false;
    setGalleryLoading(true);

    resolveLotPhotosForDisplay(selected, detail)
      .then((photos) => {
        if (!cancelled) setGalleryPhotos(photos);
      })
      .finally(() => {
        if (!cancelled) setGalleryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.thumbnail, selected?.conditionNo, detail, data.sample, loading]);

  function submitSearch(event) {
    event.preventDefault();
    const filters = { keyword, propertyType, bidType, privateContract, region, pageNo: 1, numOfRows: PAGE_SIZE, statusCode: statusCodeForFocus(statusFocus), dspsMethod, usageCategoryId, assetType: homeAssetType };
    setPageNo(1);
    loadLots(filters);
  }

  function movePage(nextPage) {
    const safePage = Math.max(1, nextPage);
    setPageNo(safePage);
    loadLots({ keyword, propertyType, bidType, privateContract, region, pageNo: safePage, numOfRows: PAGE_SIZE, statusCode: statusCodeForFocus(statusFocus), dspsMethod, usageCategoryId, assetType: homeAssetType });
  }

  function toggleSaved(id) {
    setSaved((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function openAssetTypeSearch(nextType) {
    setStatusFocus("");
    setCheckMode(false);
    setPageNo(1);
    setHomeAssetType(nextType);

    const nextDspsMethod = dispositionCodes[homeDisposition] ?? "";
    const nextUsageCategoryId = nextType === "realty" ? homeUsage : "";
    if (nextType !== "realty") {
      setHomeUsage("");
      setUsageCategoryId("");
    } else {
      setUsageCategoryId(nextUsageCategoryId);
    }
    setDspsMethod(nextDspsMethod);

    const nextKeyword = cleanQuickKeyword(quickKeyword, nextType === "realty" ? homeUsage : "", homeDisposition);
    const parsed = parseHomeSearchInput(nextKeyword, nextType === "realty" ? homeUsage : "", homeDisposition);
    const nextRegion = parsed.region || region;
    if (parsed.region) setRegion(parsed.region);
    setKeyword(parsed.type === "lot" ? parsed.lotId : parsed.keyword);
    setQuickKeyword(parsed.type === "lot" ? parsed.lotId : parsed.keyword);

    if (parsed.type === "lot") {
      const assetType = assetTypeFromLotId(parsed.lotId);
      setHomeAssetType(assetType);
      if (assetType !== "realty") {
        setHomeUsage("");
        setUsageCategoryId("");
      }
      pushAppHistory("detail", parsed.lotId);
      setView("detail");
      loadLots({
        keyword: parsed.lotId,
        propertyType,
        bidType,
        privateContract,
        region: nextRegion,
        pageNo: 1,
        numOfRows: PAGE_SIZE,
        statusCode: "",
        dspsMethod: nextDspsMethod,
        usageCategoryId: nextUsageCategoryId,
        assetType,
        preserveSelectedId: parsed.lotId,
      });
      return;
    }

    pushAppHistory("search");
    setView("search");
    loadLots({
      keyword: parsed.keyword,
      propertyType,
      bidType,
      privateContract,
      region: nextRegion,
      pageNo: 1,
      numOfRows: PAGE_SIZE,
      statusCode: "",
      dspsMethod: nextDspsMethod,
      usageCategoryId: nextUsageCategoryId,
      assetType: nextType,
    });
  }

  function pushAppHistory(nextView, nextSelectedId = selectedId) {
    const state = { appView: nextView, selectedId: nextSelectedId || "" };
    const current = window.history.state || {};
    if (current.appView === state.appView && current.selectedId === state.selectedId) return;
    const hash = state.selectedId ? `#${state.appView}-${encodeURIComponent(state.selectedId)}` : `#${state.appView}`;
    window.history.pushState(state, "", hash);
  }

  function openView(nextView) {
    const shouldReloadAll = nextView === "search" && (statusFocus || checkMode);
    pushAppHistory(nextView);
    setStatusFocus("");
    setCheckMode(false);
    setView(nextView);
    if (shouldReloadAll) {
      setPageNo(1);
      loadLots({ keyword, propertyType, bidType, privateContract, region, pageNo: 1, numOfRows: PAGE_SIZE, dspsMethod, usageCategoryId, assetType: homeAssetType });
    }
  }

  function openStatus(tileValue) {
    setCheckMode(false);
    setStatusFocus(tileValue);
    setPageNo(1);
    pushAppHistory("search");
    setView("search");
    loadLots({ keyword, propertyType, bidType, privateContract, region, pageNo: 1, numOfRows: PAGE_SIZE, statusCode: statusCodeForFocus(tileValue), dspsMethod, usageCategoryId, assetType: homeAssetType });
  }

  function openBidCheck() {
    setStatusFocus("");
    setCheckMode(true);
    setSortBy("deadline");
    pushAppHistory("search");
    setView("search");
  }

  function openDetail(id) {
    setSelectedId(id);
    pushAppHistory("detail", id);
    setView("detail");
    scrollPageToTop();
  }

  async function runQuickSearch(rawKeyword = quickKeyword) {
    setStatusFocus("");
    setCheckMode(false);
    setPageNo(1);

    const parsed = parseHomeSearchInput(rawKeyword, homeUsage, homeDisposition);
    const nextRegion = parsed.region || region;
    if (parsed.region) setRegion(parsed.region);

    if (parsed.type === "lot") {
      const assetType = assetTypeFromLotId(parsed.lotId);
      setKeyword(parsed.lotId);
      setQuickKeyword(parsed.lotId);
      setHomeAssetType(assetType);
      if (assetType !== "realty") {
        setHomeUsage("");
        setUsageCategoryId("");
      }
      const filters = {
        keyword: parsed.lotId,
        propertyType,
        bidType,
        privateContract,
        region: nextRegion,
        pageNo: 1,
        numOfRows: PAGE_SIZE,
        statusCode: "",
        dspsMethod: "",
        usageCategoryId: "",
        assetType,
        preserveSelectedId: parsed.lotId,
      };
      pushAppHistory("detail", parsed.lotId);
      setView("detail");
      loadLots(filters);
      return;
    }

    const nextDspsMethod = dispositionCodes[homeDisposition] ?? "";
    const nextUsageCategoryId = homeAssetType === "realty" ? homeUsage : "";
    const filters = {
      keyword: parsed.keyword,
      propertyType,
      bidType,
      privateContract,
      region: nextRegion,
      pageNo: 1,
      numOfRows: PAGE_SIZE,
      dspsMethod: nextDspsMethod,
      usageCategoryId: nextUsageCategoryId,
      assetType: homeAssetType,
    };
    setKeyword(parsed.keyword);
    setQuickKeyword(parsed.keyword);
    setDspsMethod(nextDspsMethod);
    setUsageCategoryId(nextUsageCategoryId);
    pushAppHistory("search");
    setView("search");
    loadLots(filters);
  }

  function submitHomeSearch(event) {
    event.preventDefault();
    runQuickSearch();
  }

  function submitAuth(event) {
    event.preventDefault();
    const name = authForm.name.trim() || authForm.email.split("@")[0] || "회원";
    const email = authForm.email.trim() || "guest@local.app";
    setMember({ name, email, joinedAt: new Date().toISOString() });
    setAuthForm({ name: "", email: "", password: "" });
    pushAppHistory("mypage");
    setView("mypage");
  }

  function openBoardWrite() {
    setBoardWriteOpen(true);
  }

  function closeBoardWrite() {
    setBoardWriteOpen(false);
  }

  function toggleQuestion(questionId) {
    setOpenQuestionId((current) => (current === questionId ? "" : questionId));
    setReplyingTo({ questionId: "", parentId: "" });
    setCommentDraft("");
  }

  function startCommentReply(questionId, parentId) {
    cancelCommentEdit();
    setReplyingTo({ questionId, parentId });
    setCommentDraft("");
  }

  function cancelCommentReply() {
    setReplyingTo({ questionId: "", parentId: "" });
    setCommentDraft("");
  }

  function startCommentEdit(questionId, comment) {
    cancelCommentReply();
    setEditingComment({ questionId, commentId: comment.id });
    setEditCommentDraft(comment.body);
  }

  function cancelCommentEdit() {
    setEditingComment({ questionId: "", commentId: "" });
    setEditCommentDraft("");
  }

  function saveCommentEdit(event, questionId) {
    event.preventDefault();
    const body = editCommentDraft.trim();
    if (!body || editingComment.questionId !== questionId || !editingComment.commentId) return;
    setQuestions((current) => current.map((question) => {
      if (question.id !== questionId) return question;
      const comments = getQuestionComments(question).map((comment) => (
        comment.id === editingComment.commentId ? { ...comment, body } : comment
      ));
      return { ...question, comments };
    }));
    cancelCommentEdit();
  }

  function deleteComment(questionId, commentId) {
    const question = questions.find((item) => item.id === questionId);
    const comments = getQuestionComments(question);
    const removeIds = collectCommentBranchIds(comments, commentId);

    if (replyingTo.questionId === questionId && replyingTo.parentId && removeIds.has(replyingTo.parentId)) {
      cancelCommentReply();
    }
    if (editingComment.questionId === questionId && removeIds.has(editingComment.commentId)) {
      cancelCommentEdit();
    }

    setQuestions((current) => current.map((item) => {
      if (item.id !== questionId) return item;
      return {
        ...item,
        comments: getQuestionComments(item).filter((comment) => !removeIds.has(comment.id)),
      };
    }));
  }

  function submitComment(event, questionId) {
    event.preventDefault();
    const body = commentDraft.trim();
    if (!body) return;
    const parentId = replyingTo.questionId === questionId && replyingTo.parentId ? replyingTo.parentId : null;
    setQuestions((current) => current.map((question) => {
      if (question.id !== questionId) return question;
      const comments = [
        ...(getQuestionComments(question)),
        {
          id: `c-${Date.now()}`,
          parentId,
          author: member?.name || "비회원",
          body,
          createdAt: new Date().toLocaleDateString("ko-KR"),
        },
      ];
      return { ...question, comments };
    }));
    cancelCommentReply();
  }

  function submitQuestion(event) {
    event.preventDefault();
    const title = questionForm.title.trim();
    const body = questionForm.body.trim();
    if (!title || !body) return;
    setQuestions((current) => [
      {
        id: `q-${Date.now()}`,
        number: Math.max(0, ...current.map((question) => Number(question.number || 0))) + 1,
        title,
        body,
        category: questionForm.category,
        author: member?.name || "비회원",
        createdAt: new Date().toLocaleDateString("ko-KR"),
        status: "답변대기",
        views: 0,
        comments: [],
      },
      ...current,
    ]);
    setQuestionForm({ title: "", body: "", category: "물건검토" });
    setBoardStatus("all");
    setBoardSearch("");
    setBoardWriteOpen(false);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Gavel size={22} /></span>
          <div>
            <strong>공매레이더</strong>
            <small>온비드 실시간 분석</small>
          </div>
        </div>

        <nav className="nav-list" aria-label="주 메뉴">
          <button className={view === "home" ? "active" : ""} onClick={() => openView("home")}><Home size={18} /> 홈</button>
          <button className={view === "search" || view === "detail" ? "active" : ""} onClick={() => openView("search")}><Search size={18} /> 탐색</button>
          <button className={view === "watch" ? "active" : ""} onClick={() => openView("watch")}><Heart size={18} /> 관심</button>
          <button className={view === "map" ? "active" : ""} onClick={() => openView("map")}><MapIcon size={18} /> 지도</button>
          <button className={view === "board" ? "active" : ""} onClick={() => openView("board")}><MessageCircleQuestion size={18} /> 질문</button>
          <button className={view === "mypage" ? "active" : ""} onClick={() => openView("mypage")}><User size={18} /> 내정보</button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>
              {view === "home" && "공매레이더"}
              {view === "search" && (assetTypeSearchTitle[homeAssetType] || assetTypeSearchTitle.realty)}
              {view === "detail" && "물건 상세"}
              {view === "watch" && "관심 물건"}
              {view === "map" && "지도 검색"}
              {view === "board" && "질문게시판"}
              {view === "login" && "로그인"}
              {view === "signup" && "회원가입"}
              {view === "mypage" && "마이페이지"}
            </h1>
            <p>
              {view === "home" && "오늘 볼 물건과 검토 흐름을 빠르게 시작합니다."}
              {view === "search" && "가격, 일정, 지도, 원문 링크를 한 화면에서 확인합니다."}
              {view === "detail" && "선택한 물건의 가격, 일정, 위치, 검토 정보를 확인합니다."}
              {view === "watch" && "저장한 물건만 모아 다시 검토합니다."}
              {view === "map" && "선택한 물건의 위치와 외부 지도 링크를 중심으로 확인합니다."}
              {view === "board" && "공매 물건 검토 질문과 답변을 남깁니다."}
              {view === "login" && "내 관심 물건과 질문 이력을 이어서 관리합니다."}
              {view === "signup" && "공매레이더 회원 정보를 만듭니다."}
              {view === "mypage" && "관심 물건, 질문, 계정 정보를 한곳에서 확인합니다."}
            </p>
          </div>
          <div className="top-actions">
            {member ? (
              <button className="user-chip" onClick={() => openView("mypage")}><User size={16} /> {member.name}</button>
            ) : (
              <>
                <button className="plain-action" onClick={() => openView("login")}>로그인</button>
                <button className="user-chip signup-action" onClick={() => openView("signup")}><UserPlus size={16} /> 회원가입</button>
              </>
            )}
            <button className="icon-button" aria-label="새로고침" onClick={() => loadLots()}>
              {loading ? <Loader2 className="spin" size={20} /> : <RefreshCw size={20} />}
            </button>
          </div>
        </header>

        {error && (
          <div className="notice" role="status">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {view === "home" ? (
          <section className="home-page">
            <section className="home-main">
              <div className="home-search-panel">
                <h2><Search size={22} /> 빠른검색</h2>
                <form className="home-search-box" onSubmit={submitHomeSearch}>
                  <input
                    value={quickKeyword}
                    onChange={(event) => setQuickKeyword(event.target.value)}
                    placeholder="물건명, 주소, 물건관리번호"
                    aria-label="빠른검색"
                  />
                  <button type="submit" disabled={loading} aria-label="검색">
                    {loading ? <Loader2 className="spin" size={22} /> : <Search size={22} />}
                  </button>
                </form>
                <div className="asset-tabs">
                  {homeAssetTypes.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.value}
                        className={`asset-tab-card ${homeAssetType === item.value ? "active" : ""}`}
                        style={{ backgroundImage: `url(${item.image})` }}
                        onClick={() => openAssetTypeSearch(item.value)}
                        type="button"
                      >
                        <span className="asset-tab-overlay" aria-hidden="true" />
                        <span className="asset-tab-content">
                          <Icon size={18} /> {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="home-filter-grid">
                    <div>
                      <strong>처분방식</strong>
                      <select value={homeDisposition} onChange={(event) => setHomeDisposition(event.target.value)}>
                        {homeDispositions.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <strong>용도</strong>
                      <select
                        value={homeUsage}
                        onChange={(event) => setHomeUsage(event.target.value)}
                        disabled={homeAssetType !== "realty"}
                      >
                        {homeUsages.map((item) => (
                          <option key={item.label} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <strong>재산유형</strong>
                      <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
                        {propertyTypes.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <strong>지역</strong>
                      <select value={region} onChange={(event) => setRegion(event.target.value)}>
                        {regions.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </div>
                </div>
                {homeAssetType === "car" && <p className="quick-note">차량 목록 API로 자동차·운송장비 물건을 조회합니다.</p>}
                {homeAssetType === "movable" && <p className="quick-note">동산 목록 API로 기계·기구·물품 공매를 조회합니다.</p>}
                <button className="home-search-action" type="button" onClick={runQuickSearch} disabled={loading}>
                  {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
                  {loading ? "검색 중..." : "물건 보기"}
                </button>
              </div>

              <aside className="home-my-panel">
                <div className="home-visual">
                  <img src="/images/auction-home-visual.png" alt="공매 물건과 지도 검색 이미지" />
                </div>
                <h2><User size={22} /> 나의 공매</h2>
                <p>{member ? `${member.name}님의 관심 물건과 질문을 확인하세요.` : "로그인 후 나의 입찰정보를 확인해보세요."}</p>
                <div className="my-panel-stats">
                  <div><span>관심물건</span><strong>{saved.length}</strong></div>
                  <div><span>질문</span><strong>{questions.length}</strong></div>
                </div>
                <button className="primary-action" onClick={() => openView(member ? "mypage" : "login")}>
                  {member ? "마이페이지" : "로그인"}
                </button>
                {!member && <button className="secondary-action" onClick={() => openView("signup")}>회원가입</button>}
              </aside>
            </section>

            <section className="home-info-grid">
              <button onClick={() => openView("board")}><MessageCircleQuestion size={22} /><strong>질문게시판</strong><span>질문 보기 · 새 작성하기</span></button>
              <button onClick={openBidCheck}><ShieldAlert size={22} /><strong>입찰참가 안내</strong><span>일정·가격·지분 체크</span></button>
              <button onClick={() => openStatus("sold")}><Star size={22} /><strong>낙찰결과</strong><span>최근 개찰 결과 확인</span></button>
              <button onClick={() => openView("search")}><Bell size={22} /><strong>공지사항</strong><span>서비스 안내와 변경사항</span></button>
            </section>

            <div className="status-grid">
              {statusTiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.value}
                    className={`status-tile ${tile.tone}`}
                    onClick={() => openStatus(tile.value)}
                  >
                    <span><Icon size={22} /></span>
                    <strong>{tile.label}</strong>
                    <small>{statusCounts[tile.value] || 0}건</small>
                  </button>
                );
              })}
            </div>

            <div className="quick-grid">
              <button onClick={() => openView("search")}><Building2 size={20} /><strong>물건 탐색</strong><span>온비드 목록 조회</span></button>
              <button onClick={() => openView("map")}><Navigation size={20} /><strong>지도 검색</strong><span>3개 지도 연결</span></button>
              <button onClick={openBidCheck}><ShieldAlert size={20} /><strong>입찰 체크</strong><span>지분·일정·가격</span></button>
            </div>

            <section className="home-section">
              <div className="section-title">
                <h2>{statusFocus ? statusFocusLabel(statusFocus) : "추천 검토 물건"}</h2>
                <button onClick={() => openView("search")}>전체 보기 <ChevronRight size={16} /></button>
              </div>
              <div className="featured-list">
                {sortedLots.slice(0, 3).map((lot) => (
                  <article key={`featured-${lot.id}`} onClick={() => openDetail(lot.id)}>
                    {lot.thumbnail ? <AuctionImage src={lot.thumbnail} alt={lot.title} /> : <div className="featured-empty">사진 없음</div>}
                    <div>
                      <span className={`status ${statusClass(lot.status)}`}>{lot.status}</span>
                      <h3>{lot.title}</h3>
                      <p><MapPin size={14} /> {lot.address}</p>
                      <div className="featured-meta">
                        <strong>{compactMoney(lot.minimum)}</strong>
                        <span>{daysLeft(lot.ends)}일 남음</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : view === "board" ? (
          <section className="board-page">
            <section className="board-hero">
              <article className="board-summary-card board-summary-primary">
                <span className="board-summary-label">질문 현황</span>
                <strong>{questions.length}건</strong>
                <p>물건 검토, 권리분석, 입찰 전략 질문을 빠르게 모아봅니다.</p>
              </article>
              <article className="board-summary-card">
                <span className="board-summary-label">답변완료</span>
                <strong>{questions.filter((question) => question.status === "답변완료").length}건</strong>
                <p>실제 검토 흐름에 참고할 수 있는 답변이 정리되어 있습니다.</p>
              </article>
              <article className="board-summary-card board-summary-tip">
                <span className="board-summary-label">이용 안내</span>
                <strong>새 작성하기로 질문 등록</strong>
                <p>물건번호와 확인한 내용을 적어 두면 답변 대기 목록에 바로 추가됩니다.</p>
              </article>
            </section>

            <section className="board-main">
              <div className="board-toolbar">
                <div>
                  <h2>질문게시판</h2>
                  <p>공매 물건 검토, 권리관계, 입찰 절차 질문을 주제별로 한눈에 확인합니다.</p>
                </div>
                <div className="board-toolbar-actions">
                  <div className="board-search">
                    <Search size={17} />
                    <input value={boardSearch} onChange={(event) => setBoardSearch(event.target.value)} placeholder="제목, 작성자, 분류 검색" />
                  </div>
                  <button className="board-write-button" type="button" onClick={openBoardWrite}>
                    <SquarePen size={18} /> 새 작성하기
                  </button>
                </div>
              </div>

              <div className="board-tabs" aria-label="질문 상태">
                {[
                  ["all", "전체", questions.length],
                  ["답변대기", "답변대기", questions.filter((question) => question.status === "답변대기").length],
                  ["답변완료", "답변완료", questions.filter((question) => question.status === "답변완료").length],
                ].map(([value, label, count]) => (
                  <button key={value} className={boardStatus === value ? "active" : ""} onClick={() => setBoardStatus(value)} type="button">
                    {label}<span>{count}</span>
                  </button>
                ))}
              </div>

              <div className="board-list" aria-label="질문 목록">
                {filteredQuestions.length === 0 && (
                  <div className="board-empty">
                    <MessageCircleQuestion size={28} />
                    <strong>검색된 질문이 없습니다.</strong>
                    <p>검색어를 줄이거나 새 작성하기로 질문을 등록해보세요.</p>
                  </div>
                )}
                {filteredQuestions.map((question) => {
                  const isOpen = openQuestionId === question.id;
                  return (
                  <article className={`board-card ${isOpen ? "expanded" : ""}`} key={question.id}>
                    <div className="board-row">
                      <button
                        className="board-title"
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleQuestion(question.id)}
                      >
                        <span className="board-no">{question.number ?? "-"}</span>
                        <strong>{question.title || question.body}</strong>
                      </button>
                      <div className="board-row-aside">
                        <span className="board-author">{question.author}</span>
                        <span className={`board-status ${question.status === "답변완료" ? "done" : ""}`}>{question.status}</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="board-body">
                        <p>{question.body}</p>
                        <BoardCommentSection
                          question={question}
                          currentAuthor={getCurrentAuthor(member)}
                          replyingTo={replyingTo}
                          commentDraft={commentDraft}
                          editingComment={editingComment}
                          editCommentDraft={editCommentDraft}
                          onDraftChange={setCommentDraft}
                          onSubmit={submitComment}
                          onReply={startCommentReply}
                          onCancelReply={cancelCommentReply}
                          onEditStart={startCommentEdit}
                          onEditDraftChange={setEditCommentDraft}
                          onEditSave={saveCommentEdit}
                          onEditCancel={cancelCommentEdit}
                          onDelete={deleteComment}
                        />
                      </div>
                    )}
                  </article>
                  );
                })}
              </div>
            </section>

            {boardWriteOpen && (
              <div className="board-write-modal" role="dialog" aria-modal="true" aria-labelledby="board-write-title">
                <button className="board-write-backdrop" type="button" aria-label="작성 창 닫기" onClick={closeBoardWrite} />
                <section className="board-write-panel">
                  <div className="board-write-head">
                    <div>
                      <h2 id="board-write-title">새 질문 작성</h2>
                      <p>물건번호, 궁금한 점, 확인한 내용을 적어주세요.</p>
                    </div>
                    <button className="icon-button" type="button" aria-label="닫기" onClick={closeBoardWrite}>
                      <X size={20} />
                    </button>
                  </div>
                  <form className="question-form" onSubmit={submitQuestion}>
                    <label>
                      분류
                      <select value={questionForm.category} onChange={(event) => setQuestionForm((current) => ({ ...current, category: event.target.value }))}>
                        <option>물건검토</option>
                        <option>권리분석</option>
                        <option>입찰전략</option>
                        <option>이용문의</option>
                      </select>
                    </label>
                    <label>
                      제목
                      <input
                        value={questionForm.title}
                        onChange={(event) => setQuestionForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="질문 제목"
                        required
                      />
                    </label>
                    <label>
                      내용
                      <textarea
                        value={questionForm.body}
                        onChange={(event) => setQuestionForm((current) => ({ ...current, body: event.target.value }))}
                        placeholder="물건번호, 궁금한 점, 확인한 내용을 적어주세요."
                        rows={7}
                        required
                      />
                    </label>
                    <div className="board-write-actions">
                      <button className="secondary-action" type="button" onClick={closeBoardWrite}>취소</button>
                      <button className="primary-action" type="submit">등록하기</button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </section>
        ) : view === "login" || view === "signup" ? (
          <section className="service-page narrow">
            <form className="service-card auth-form" onSubmit={submitAuth}>
              <h2>{view === "signup" ? "회원가입" : "로그인"}</h2>
              {view === "signup" && (
                <label>
                  이름
                  <input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} placeholder="이름" />
                </label>
              )}
              <label>
                이메일
                <input value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} placeholder="email@example.com" type="email" />
              </label>
              <label>
                비밀번호
                <input value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} placeholder="비밀번호" type="password" />
              </label>
              <button className="primary-action" type="submit">{view === "signup" ? "가입하기" : "로그인"}</button>
              <button className="secondary-action" type="button" onClick={() => openView(view === "signup" ? "login" : "signup")}>
                {view === "signup" ? "이미 계정이 있어요" : "회원가입으로 이동"}
              </button>
            </form>
          </section>
        ) : view === "mypage" ? (
          <section className="service-page">
            <section className="service-card profile-card">
              <h2>{member ? `${member.name}님` : "비회원"}</h2>
              <p>{member ? member.email : "로그인하면 관심 물건과 질문 이력을 저장할 수 있습니다."}</p>
              <div className="profile-stats">
                <div><span>관심 물건</span><strong>{saved.length}건</strong></div>
                <div><span>질문</span><strong>{questions.length}건</strong></div>
              </div>
              {member ? (
                <button className="secondary-action" onClick={() => setMember(null)}>로그아웃</button>
              ) : (
                <button className="primary-action" onClick={() => openView("login")}>로그인하기</button>
              )}
            </section>
            <section className="service-card">
              <h2>내 활동</h2>
              <div className="question-list">
                {questions.filter((question) => !member || question.author === member.name || question.author === "비회원").slice(0, 5).map((question) => (
                  <article key={question.id}>
                    <span>{question.status}</span>
                    <strong>{question.title || question.body}</strong>
                    <small>{question.category || "일반"} · {question.createdAt}</small>
                  </article>
                ))}
                {questions.length === 0 && <p className="muted">아직 활동 내역이 없습니다.</p>}
              </div>
            </section>
          </section>
        ) : view === "detail" && selected ? (
          <section className="detail-page">
            <button className="back-button" onClick={() => openView("search")}>목록으로</button>
            <LotDetailPanel
              lot={selectedLot}
              detail={detail}
              pageMeta={pageMeta}
              pageMetaLoading={pageMetaLoading}
              detailLoading={detailLoading}
              detailError={detailError}
              photos={displayPhotos}
              galleryLoading={galleryLoading}
              links={links}
              isSaved={saved.includes(selected.id)}
              onToggleSaved={() => toggleSaved(selected.id)}
              onBidCheck={openBidCheck}
              layout="page"
            />
          </section>
        ) : (
          <>
            {(statusFocus || view === "watch" || checkMode) && (
              <div className="filter-chip-row">
                <span>
                  {checkMode && "입찰 체크가 필요한 물건을 마감 임박순으로 보고 있습니다."}
                  {!checkMode && view === "watch" && "관심 물건만 보고 있습니다."}
                  {!checkMode && view !== "watch" && `${statusFocusLabel(statusFocus)} 중심으로 보고 있습니다.`}
                </span>
                <button onClick={() => openView("search")}>전체 보기</button>
              </div>
            )}

            <section className="metrics" aria-label="요약 지표">
              <div><span><Building2 size={18} /> {statusFocus || checkMode || view === "watch" ? "조회 결과" : "전체 물건"}</span><strong>{visibleTotal.toLocaleString()}건</strong></div>
              <div><span><WalletCards size={18} /> 최저입찰 합계</span><strong>{compactMoney(totalMinimum)}</strong></div>
              <div><span><TrendingDown size={18} /> 평균 할인율</span><strong>{averageDiscount}%</strong></div>
            </section>

            <div className="explore-search-sticky">
            <form className="controls api-controls" onSubmit={submitSearch}>
          <label className="search-field">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="물건명 검색" />
          </label>

          <label className="select-field">
            <SlidersHorizontal size={17} />
            <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
              {propertyTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="select-field">
            <Filter size={17} />
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              {regions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label className="select-field">
            <Gavel size={17} />
            <select value={privateContract} onChange={(event) => setPrivateContract(event.target.value)}>
              {privateContractOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="select-field">
            <TrendingDown size={17} />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {sortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <div className="segmented" aria-label="입찰 구분">
            {bidTypes.map((item) => (
              <button type="button" key={item.value} className={bidType === item.value ? "selected" : ""} onClick={() => setBidType(item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <button className="search-button" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            {loading ? "검색 중..." : "조회"}
          </button>
            </form>
            </div>

            {checkMode && (
              <section className="bid-check-panel">
                <div>
                  <strong><ShieldAlert size={17} /> 입찰 전 확인</strong>
                  <p>마감일, 지분 여부, 최저입찰가 변동, 지도 위치를 상세 패널에서 함께 확인하세요.</p>
                </div>
                <button onClick={() => setCheckMode(false)}>체크 해제</button>
              </section>
            )}

            {view === "watch" && sortedLots.length === 0 && (
              <section className="empty-state">
                <Heart size={28} />
                <strong>저장한 관심 물건이 없습니다.</strong>
                <p>탐색 화면에서 하트 버튼을 눌러 관심 물건을 저장하세요.</p>
                <button onClick={() => openView("search")}>물건 탐색으로 이동</button>
              </section>
            )}

            {view !== "watch" && sortedLots.length === 0 && (
              <section className="empty-state">
                <Search size={28} />
                <strong>조회된 물건이 없습니다.</strong>
                <p>{statusFocus ? `${statusFocusLabel(statusFocus)}은 현재 목록 조회서비스에서 반환된 데이터가 없습니다.` : "검색 조건을 바꿔 다시 조회하세요."}</p>
                <button onClick={() => openView("search")}>전체 물건 보기</button>
              </section>
            )}

            {view === "map" && selected && (
              <section className="map-overview">
                <div>
                  <span className={`status ${statusClass(selected.status)}`}>{selected.status}</span>
                  <h2>{selected.title}</h2>
                  <p><MapPin size={16} /> {selected.address}</p>
                </div>
                <div className="map-card">
                  <iframe title={`${selected.title} 지도`} src={links.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  <div className="map-actions">
                    <a href={links.kakao} target="_blank" rel="noreferrer"><MapPin size={15} /> 카카오맵</a>
                    <a href={links.naver} target="_blank" rel="noreferrer"><Navigation size={15} /> 네이버지도</a>
                    <a href={links.google} target="_blank" rel="noreferrer"><ExternalLink size={15} /> 구글지도</a>
                  </div>
                </div>
              </section>
            )}

            {sortedLots.length > 0 && (
            <div className={`content-grid ${view === "map" ? "map-mode" : ""}`}>
          <section className="lot-list" aria-label="공매 물건 목록">
            {sortedLots.map((lot) => (
              <article className={`lot-row ${selected?.id === lot.id ? "picked" : ""}`} key={`${lot.id}-${lot.conditionNo}`} onClick={() => openDetail(lot.id)}>
                <div className="lot-thumb-block">
                  {lot.thumbnail ? <AuctionImage src={lot.thumbnail} alt={lot.title} /> : <div className="lot-thumb-empty">사진 없음</div>}
                  <div className="lot-tools">
                    <button type="button" onClick={(event) => event.stopPropagation()}>＋ 물건비교</button>
                    <span aria-hidden="true">|</span>
                    <button
                      type="button"
                      className={saved.includes(lot.id) ? "tool-saved" : ""}
                      onClick={(event) => { event.stopPropagation(); toggleSaved(lot.id); }}
                      aria-label="관심 물건 저장"
                    >
                      <Heart size={18} fill={saved.includes(lot.id) ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>
                <div className="lot-main">
                  <div className="lot-badges">
                    <span className={`status ${statusClass(lot.status)}`}>{lot.prptDivNm || lot.tags[0] || "공매"}</span>
                    <span>{lot.tags[1] || "매각"}</span>
                    <span>{lot.subCategory || lot.category}</span>
                  </div>
                  <div className="lot-title-line">
                    <h2>{lot.id || lot.conditionNo || lot.noticeNo}</h2>
                    <div className="mobile-price">
                      <em>{lot.discount ? `↓ ${lot.discount}%` : ""}</em>
                      <strong>{compactMoney(lot.minimum)}</strong>
                    </div>
                  </div>
                  <p>{lot.title}</p>
                  <div className="tag-line">{lot.tags.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}</div>
                </div>
                <div className="lot-round">
                  <strong>{lot.round || lot.raw?.pbctNsq || "-"}</strong>
                </div>
                <div className="lot-schedule">
                  <span>{statusGroup(lot) === "ready" ? "입찰시작 전" : lot.status}</span>
                  <strong>{lot.starts || "일정 확인"}<br />~<br />{lot.ends || "일정 확인"}</strong>
                </div>
                <div className="lot-price">
                  <small>{compactMoney(lot.appraised)}</small>
                  <em>{lot.discount ? `↓ ${lot.discount}%` : ""}</em>
                  <strong>{compactMoney(lot.minimum)}</strong>
                </div>
              </article>
            ))}

            <div className="pager">
              <button onClick={() => movePage(pageNo - 1)} disabled={pageNo <= 1 || loading}>이전</button>
              <span>{pageNo} / {Math.max(1, Math.ceil((data.totalCount || sortedLots.length) / PAGE_SIZE))}</span>
              <button onClick={() => movePage(pageNo + 1)} disabled={loading}>다음</button>
            </div>
          </section>

          {selected && (
            <aside className="detail-panel">
              <LotDetailPanel
                lot={selectedLot}
                detail={detail}
                pageMeta={pageMeta}
                pageMetaLoading={pageMetaLoading}
                detailLoading={detailLoading}
                detailError={detailError}
                photos={displayPhotos}
                galleryLoading={galleryLoading}
                links={links}
                isSaved={saved.includes(selected.id)}
                onToggleSaved={() => toggleSaved(selected.id)}
                onBidCheck={openBidCheck}
                layout="aside"
              />
            </aside>
          )}
            </div>
            )}
          </>
        )}
      </section>

      {loading && (
        <div className="search-loading-overlay" role="alert" aria-live="assertive" aria-busy="true">
          <div className="search-loading-card">
            <Loader2 className="spin" size={36} />
            <p>검색 중입니다. 잠시만 기다려주세요.</p>
          </div>
        </div>
      )}
    </main>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
