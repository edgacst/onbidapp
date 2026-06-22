import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Filter,
  Gavel,
  Heart,
  Home,
  Landmark,
  Loader2,
  Map,
  MapPin,
  MessageCircleQuestion,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  TrendingDown,
  User,
  UserPlus,
  WalletCards,
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

const homeAssetTypes = [
  { label: "부동산", value: "realty", icon: Building2 },
  { label: "동산", value: "movable", icon: Landmark },
  { label: "차량", value: "car", icon: WalletCards },
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
  const query = encodeURIComponent(lot.id || lot.title);
  return `https://www.onbid.co.kr/op/ppa/plnmmn/publicAnnounceList.do?searchCltrNm=${query}`;
}

function assetTypeFromLotId(id) {
  const text = String(id || "");
  if (/-0500-/.test(text)) return "car";
  if (/-0600-/.test(text)) return "movable";
  return "realty";
}

function isOnbidLotId(value) {
  return /^\d{4}-\d{4}-\d{6}$/.test(String(value || "").trim());
}

function toOnbidFileProxy(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.onbid.co.kr") {
      return `/onbid-file${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return url;
  }
  return url;
}

function AuctionImage({ src, fallbackSrc = "", alt, className = "" }) {
  const sources = [src, fallbackSrc].filter(Boolean).filter((url, index, urls) => urls.indexOf(url) === index);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [displaySrc, setDisplaySrc] = useState("");
  const currentSrc = sources[sourceIndex] || "";

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setDisplaySrc("");

    if (!currentSrc) return undefined;

    if (!currentSrc.startsWith("/onbid-file")) {
      setDisplaySrc(currentSrc);
      return undefined;
    }

    fetch(currentSrc)
      .then((response) => {
        if (!response.ok) throw new Error(`image ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setDisplaySrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSourceIndex((index) => index + 1);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentSrc]);

  useEffect(() => {
    setSourceIndex(0);
  }, [src, fallbackSrc]);

  if (!currentSrc) return <div className={className ? `${className} image-empty` : "image-empty"}>사진 없음</div>;
  if (!displaySrc) return <div className={className ? `${className} image-empty loading` : "image-empty loading"}>사진 불러오는 중</div>;

  return (
    <img
      className={className}
      src={displaySrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setSourceIndex((index) => index + 1)}
    />
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
    const address = item.cltrRadr || [item.lctnSdnm || item.lctnSidoNm, item.lctnSggnm, item.lctnEmdNm].filter(Boolean).join(" ");

    return {
      id: item.cltrMngNo || `onbid-${index}`,
      assetType,
      conditionNo: item.pbctCdtnNo || "",
      onbidNo: item.onbidCltrno || "",
      noticeNo: item.onbidPbancNo || "",
      pbctNo: item.pbctNo || "",
      round: item.pbctNsq || item.pbctSeq || "",
      title: String(item.onbidCltrNm || "온비드 부동산 물건").trim(),
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
      thumbnail: item.thnlImgUrlAdr || item.thnlImgUrl || item.urlAdr || "",
      landArea: Number(item.landSqms ?? 0),
      buildingArea: Number(item.bldSqms ?? 0),
      shareYn: item.alcYn || "",
      privateContractYn: item.pvctTrgtYn || "",
      distributionDue: item.dtbtRqrEdtmCont || "",
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
    const address = item.cltrRadr || item.addr || [item.lctnSdnm || item.lctnSidoNm, item.lctnSggnm, item.lctnEmdNm].filter(Boolean).join(" ");
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
      title: String(item.onbidCltrNm || item.cltrNm || "온비드 입찰결과 물건").trim(),
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
      thumbnail: item.thnlImgUrlAdr || item.thnlImgUrl || item.urlAdr || "",
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
  const photoCandidates = [
    ...asArray(item?.potoUrlList?.item ?? item?.potoUrlList),
    ...asArray(item?.poto360DgrUrlList?.item ?? item?.poto360DgrUrlList),
    ...asArray(item?.photoList?.item ?? item?.photoList),
    ...asArray(item?.picList?.item ?? item?.picList),
    ...asArray(item?.imgList?.item ?? item?.imgList),
    ...asArray(item?.cltrImgList?.item ?? item?.cltrImgList),
    ...asArray(item?.vdoUrlAdrList?.item ?? item?.vdoUrlAdrList),
    ...asArray(item?.lrmUrlAdrList?.item ?? item?.lrmUrlAdrList),
    ...asArray(item?.lmapUrlAdrList?.item ?? item?.lmapUrlAdrList),
  ];
  const photos = photoCandidates
    .map((photo) => {
      const url = typeof photo === "string"
        ? photo
        : photo?.urlAdr || photo?.imgUrl || photo?.thnlImgUrlAdr || photo?.fileUrl || photo?.atchFileUrl || photo?.vdoUrlAdr || photo?.lrmUrlAdr || photo?.lmapUrlAdr;
      return toOnbidFileProxy(url || "");
    })
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index);

  return {
    item,
    photos,
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
  if (filters.keyword.trim()) params.set("onbidCltrNm", filters.keyword.trim());
  if (filters.region !== "전체") params.set("lctnSdnm", filters.region);
  if (filters.statusCode) params.set("pbctStatCd", filters.statusCode);
  if (filters.dspsMethod) params.set("dspsMthodCd", filters.dspsMethod);
  if (filters.usageCategoryId) params.set("cltrUsgMclsCtgrId", filters.usageCategoryId);

  const url = `${API_BASE}${listPath}?${params.toString()}`;
  const response = await fetch(url);
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

async function findOnbidLotById(filters, lotId) {
  if (!lotId) return null;
  const assetType = filters.assetType || assetTypeFromLotId(lotId);
  const propertyCodes = assetType === "movable"
    ? ["0007", "0010", "0005", "0004", "0002", "0003", "0006", "0008", "0011", "0013"]
    : [filters.propertyType].filter(Boolean);
  const contractValues = assetType === "movable" ? ["N", "Y"] : [filters.privateContract].filter(Boolean);

  for (const pvctTrgtYn of contractValues) {
    for (const prptDivCd of propertyCodes) {
      for (let pageNo = 1; pageNo <= 30; pageNo += 1) {
        const result = await fetchOnbidLots({
          ...filters,
          assetType,
          propertyType: prptDivCd,
          privateContract: pvctTrgtYn,
          pageNo,
          numOfRows: 50,
          statusCode: "",
          keyword: "",
          region: regions[0],
          dspsMethod: "",
          usageCategoryId: "",
        });
        const found = result.lots.find((lot) => lot.id === lotId);
        if (found) return found;
        if (pageNo >= Math.ceil((result.totalCount || 0) / 50)) break;
      }
    }
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
  const response = await fetch(url);
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
  const detailPath = detailPathsByAssetType[lot.assetType || filters.assetType] || ONBID_DETAIL_PATH;
  const params = new URLSearchParams({
    resultType: "json",
    cltrMngNo: lot.id,
  });
  if (lot.conditionNo) params.set("pbctCdtnNo", String(lot.conditionNo));

  const response = await fetch(`${API_BASE}${detailPath}?${params.toString()}`);
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
  return normalizeDetail(payload);
}

function App() {
  const [view, setView] = useState("home");
  const [statusFocus, setStatusFocus] = useState("");
  const [checkMode, setCheckMode] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [quickKeyword, setQuickKeyword] = useState("");
  const [homeAssetType, setHomeAssetType] = useState("realty");
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
  const [selectedId, setSelectedId] = useState(sampleLots[0].id);
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
  const [error, setError] = useState("");
  const [member, setMember] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("auctionMember") || "null");
    } catch {
      return null;
    }
  });
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [questionForm, setQuestionForm] = useState({ title: "", body: "", category: "물건검토" });
  const [boardSearch, setBoardSearch] = useState("");
  const [boardStatus, setBoardStatus] = useState("all");
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
      },
    ];
  });

  const filteredQuestions = useMemo(() => {
    const query = boardSearch.trim().toLowerCase();
    return questions.filter((question) => {
      const statusOk = boardStatus === "all" || question.status === boardStatus;
      const queryOk = !query || [question.title, question.body, question.category, question.author].some((value) => String(value || "").toLowerCase().includes(query));
      return statusOk && queryOk;
    });
  }, [questions, boardSearch, boardStatus]);

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
  const links = selected ? mapLinks(selected) : null;
  const displayPhotos = selected
    ? [selected.thumbnail, ...(detail?.photos || [])].filter(Boolean).filter((url, index, urls) => urls.indexOf(url) === index)
    : [];
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
    try {
      const keywordLotId = isOnbidLotId(filters.keyword) ? filters.keyword.trim() : "";
      if (keywordLotId && !filters.statusCode) {
        const assetType = assetTypeFromLotId(keywordLotId);
        const foundLot = await findOnbidLotById({ ...filters, assetType }, keywordLotId);
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
      }
      const result = filters.statusCode === "0010" || filters.statusCode === "0011"
        ? await fetchOnbidResultLots(filters)
        : await fetchOnbidLots(filters);
      if (filters.preserveSelectedId && !result.lots.some((lot) => lot.id === filters.preserveSelectedId)) {
        const foundLot = await findOnbidLotById(filters, filters.preserveSelectedId).catch(() => null);
        if (foundLot) {
          result.lots = [foundLot, ...result.lots.filter((lot) => lot.id !== foundLot.id)];
          result.totalCount = Math.max(result.totalCount || 0, result.lots.length);
        }
      }
      setData({ ...result, sample: false });
      setSelectedId(filters.preserveSelectedId || result.lots[0]?.id || "");
      if (!filters.statusCode) {
        Promise.all([
          fetchOnbidCount(filters, "0001").catch(() => 0),
          fetchOnbidCount(filters, "0010").catch(() => 0),
          fetchOnbidCount(filters, "0011").catch(() => 0),
        ]).then(([ready, sold, failed]) => {
          setStatusTotals({ ready, sold, failed, available: result.totalCount || result.lots.length });
        });
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
        setSelectedId(sampleLots[0].id);
      }
      setError(err instanceof Error ? err.message : "온비드 API 호출에 실패했습니다.");
    } finally {
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
    const rawHash = window.location.hash.replace("#", "");
    const [initialViewToken, ...hashRest] = rawHash.split("-");
    const initialSelectedId = hashRest.length ? decodeURIComponent(hashRest.join("-")) : "";
    const inferredAssetType = initialSelectedId ? assetTypeFromLotId(initialSelectedId) : homeAssetType;

    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      setHomeAssetType(inferredAssetType);
      if (inferredAssetType !== "realty") {
        setHomeUsage("");
        setUsageCategoryId("");
      }
    }

    if (!window.history.state?.appView) {
      const initialView = initialViewToken || "home";
      const safeInitialView = ["home", "search", "watch", "map", "board", "login", "signup", "mypage", "detail"].includes(initialView) ? initialView : "home";
      window.history.replaceState({ appView: safeInitialView, selectedId: initialSelectedId }, "", initialSelectedId ? `#${safeInitialView}-${encodeURIComponent(initialSelectedId)}` : `#${safeInitialView}`);
      setView(safeInitialView);
    }

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

    function handlePopState(event) {
      const state = event.state || {};
      setView(state.appView || "home");
      if (state.selectedId) setSelectedId(state.selectedId);
      if ((state.appView || "home") !== "search") {
        setCheckMode(false);
        setStatusFocus("");
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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

  function selectHomeAssetType(nextType) {
    setHomeAssetType(nextType);
    if (nextType !== "realty") {
      setHomeUsage("");
      setUsageCategoryId("");
    }
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
  }

  async function runQuickSearch() {
    setStatusFocus("");
    setCheckMode(false);
    setPageNo(1);
    const nextKeyword = cleanQuickKeyword(quickKeyword, homeUsage, homeDisposition);
    if (isOnbidLotId(nextKeyword)) {
      const assetType = assetTypeFromLotId(nextKeyword);
      setKeyword(nextKeyword);
      setQuickKeyword(nextKeyword);
      setHomeAssetType(assetType);
      if (assetType !== "realty") {
        setHomeUsage("");
        setUsageCategoryId("");
      }
      const filters = {
        keyword: nextKeyword,
        propertyType,
        bidType,
        privateContract,
        region,
        pageNo: 1,
        numOfRows: PAGE_SIZE,
        statusCode: "",
        dspsMethod: "",
        usageCategoryId: "",
        assetType,
        preserveSelectedId: nextKeyword,
      };
      await loadLots(filters);
      pushAppHistory("detail", nextKeyword);
      setView("detail");
      return;
    }
    const nextDspsMethod = dispositionCodes[homeDisposition] ?? "";
    const nextUsageCategoryId = homeAssetType === "realty" ? homeUsage : "";
    const filters = {
      keyword: nextKeyword,
      propertyType,
      bidType,
      privateContract,
      region,
      pageNo: 1,
      numOfRows: PAGE_SIZE,
      dspsMethod: nextDspsMethod,
      usageCategoryId: nextUsageCategoryId,
      assetType: homeAssetType,
    };
    setKeyword(nextKeyword);
    setQuickKeyword(nextKeyword);
    setDspsMethod(nextDspsMethod);
    setUsageCategoryId(nextUsageCategoryId);
    pushAppHistory("search");
    setView("search");
    loadLots(filters);
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
      },
      ...current,
    ]);
    setQuestionForm({ title: "", body: "", category: "물건검토" });
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
          <button className={view === "map" ? "active" : ""} onClick={() => openView("map")}><Map size={18} /> 지도</button>
          <button className={view === "board" ? "active" : ""} onClick={() => openView("board")}><MessageCircleQuestion size={18} /> 질문</button>
          <button className={view === "mypage" ? "active" : ""} onClick={() => openView("mypage")}><User size={18} /> 내정보</button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>
              {view === "home" && "공매레이더"}
              {view === "search" && "부동산 공매 물건 탐색"}
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
                <label className="home-search-box">
                  <input value={quickKeyword} onChange={(event) => setQuickKeyword(event.target.value)} placeholder="검색어를 입력하세요." />
                  <button type="button" onClick={runQuickSearch} aria-label="검색"><Search size={22} /></button>
                </label>
                <div className="home-search-body">
                  <div className="asset-tabs">
                    {homeAssetTypes.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.value}
                          className={homeAssetType === item.value ? "active" : ""}
                          onClick={() => selectHomeAssetType(item.value)}
                          type="button"
                        >
                          <Icon size={18} /> {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="home-filter-grid">
                    <div>
                      <strong>처분방식</strong>
                      {homeDispositions.map((item) => (
                        <button
                          key={item.value}
                          className={`filter-choice ${homeDisposition === item.value ? "active" : ""}`}
                          onClick={() => setHomeDisposition(item.value)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <strong>용도</strong>
                      {homeUsages.map((item) => (
                        <button
                          key={item.label}
                          className={`filter-choice ${homeUsage === item.value ? "active" : ""}`}
                          onClick={() => setHomeUsage(item.value)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <strong>재산유형</strong>
                      {propertyTypes.slice(0, 4).map((item) => (
                        <button
                          key={item.value}
                          className={`filter-choice ${propertyType === item.value ? "active" : ""}`}
                          onClick={() => setPropertyType(item.value)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <strong>지역</strong>
                      <select value={region} onChange={(event) => setRegion(event.target.value)}>
                        {regions.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {homeAssetType === "car" && <p className="quick-note">차량 목록 API로 자동차·운송장비 물건을 조회합니다.</p>}
                {homeAssetType === "movable" && <p className="quick-note">동산 목록 API로 기계·기구·물품 공매를 조회합니다.</p>}
                <button className="home-search-action" type="button" onClick={runQuickSearch}><Search size={18} /> 물건 보기</button>
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
              <button onClick={() => openView("board")}><MessageCircleQuestion size={22} /><strong>질문게시판</strong><span>물건 검토 질문 남기기</span></button>
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
                    {lot.thumbnail ? <img src={lot.thumbnail} alt={lot.title} loading="lazy" /> : <div className="featured-empty">사진 없음</div>}
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
            <section className="board-main">
              <div className="board-toolbar">
                <div>
                  <h2>질문게시판</h2>
                  <p>공매 물건 검토, 권리관계, 입찰 절차 질문을 모아봅니다.</p>
                </div>
                <div className="board-search">
                  <Search size={17} />
                  <input value={boardSearch} onChange={(event) => setBoardSearch(event.target.value)} placeholder="제목, 작성자, 분류 검색" />
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

              <div className="board-table" role="table" aria-label="질문 목록">
                <div className="board-row board-head" role="row">
                  <span>번호</span>
                  <span>분류</span>
                  <span>제목</span>
                  <span>작성자</span>
                  <span>등록일</span>
                  <span>조회</span>
                  <span>상태</span>
                </div>
                {filteredQuestions.length === 0 && (
                  <div className="board-empty">
                    <MessageCircleQuestion size={28} />
                    <strong>검색된 질문이 없습니다.</strong>
                    <p>검색어를 줄이거나 새 질문을 등록해보세요.</p>
                  </div>
                )}
                {filteredQuestions.map((question) => (
                  <article className="board-row" key={question.id} role="row">
                    <span className="board-no">{question.number || "-"}</span>
                    <span><mark>{question.category || "일반"}</mark></span>
                    <button className="board-title" type="button">
                      <strong>{question.title || question.body}</strong>
                      <small>{question.body}</small>
                    </button>
                    <span>{question.author}</span>
                    <span>{question.createdAt}</span>
                    <span>{question.views ?? 0}</span>
                    <span className={`board-status ${question.status === "답변완료" ? "done" : ""}`}>{question.status}</span>
                  </article>
                ))}
              </div>
            </section>

            <aside className="board-write-card">
              <h2>질문 작성</h2>
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
                  />
                </label>
                <label>
                  내용
                  <textarea
                    value={questionForm.body}
                    onChange={(event) => setQuestionForm((current) => ({ ...current, body: event.target.value }))}
                    placeholder="물건번호, 궁금한 점, 확인한 내용을 적어주세요."
                    rows={6}
                  />
                </label>
                <button className="primary-action" type="submit">등록하기</button>
              </form>
            </aside>
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
            <article className="detail-panel detail-page-panel">
              <div className="photo-strip">
                {displayPhotos.slice(0, 8).map((src, index) => (
                  <AuctionImage key={`${src}-${index}`} src={src} alt={`${selected.title} 사진 ${index + 1}`} />
                ))}
                {!displayPhotos.length && <div className="photo-empty">사진 없음</div>}
              </div>

              <div className="detail-head">
                <span className={`status ${statusClass(selected.status)}`}>{selected.status}</span>
                <button className="icon-button" aria-label="관심 물건 저장" onClick={() => toggleSaved(selected.id)}>
                  <Heart size={19} fill={saved.includes(selected.id) ? "currentColor" : "none"} />
                </button>
              </div>
              <h2>{selected.title}</h2>
              <p className="agency"><Landmark size={16} /> {selected.agency}</p>

              <div className="map-card">
                <iframe title={`${selected.title} 지도`} src={links.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                <div className="map-actions">
                  <a href={links.kakao} target="_blank" rel="noreferrer"><MapPin size={15} /> 카카오맵</a>
                  <a href={links.naver} target="_blank" rel="noreferrer"><Navigation size={15} /> 네이버지도</a>
                  <a href={links.google} target="_blank" rel="noreferrer"><ExternalLink size={15} /> 구글지도</a>
                </div>
              </div>

              <div className="detail-stats">
                <div><small>물건관리번호</small><strong>{selected.id}</strong></div>
                <div><small>공매조건번호</small><strong>{selected.conditionNo || "확인"}</strong></div>
                <div><small>감정가</small><strong>{compactMoney(selected.appraised)}</strong></div>
                <div><small>최저입찰가</small><strong>{compactMoney(selected.minimum)}</strong></div>
                <div><small>토지면적</small><strong>{selected.landArea ? `${selected.landArea.toLocaleString()}㎡` : "확인"}</strong></div>
                <div><small>건물면적</small><strong>{selected.buildingArea ? `${selected.buildingArea.toLocaleString()}㎡` : "확인"}</strong></div>
              </div>

              <div className="timeline">
                <div><CalendarDays size={18} /><span>입찰 시작</span><strong>{selected.starts || "확인"}</strong></div>
                <div><Clock3 size={18} /><span>입찰 마감</span><strong>{selected.ends || "확인"} · {daysLeft(selected.ends)}일</strong></div>
              </div>

              <div className="analysis-box">
                <strong><ShieldAlert size={16} /> 검토 체크</strong>
                <p>{selected.note}</p>
                <div className="check-list">
                  <span className={selected.shareYn === "Y" ? "danger" : ""}>지분물건: {selected.shareYn === "Y" ? "예" : "아니오"}</span>
                  <span>배분요구종기: {selected.distributionDue || "확인 필요"}</span>
                  <span>수의계약: {selected.privateContractYn === "Y" ? "가능" : "대상 아님"}</span>
                </div>
              </div>

              <div className="analysis-box">
                <strong>상세 정보</strong>
                {detailLoading && <p>물건상세 조회 중입니다.</p>}
                {detailError && <p>상세 API 권한이 없어 목록 데이터 기준으로 표시 중입니다. 상세 서비스 승인 후 사진목록, 감정평가, 면적상세가 확장됩니다.</p>}
                {!detailLoading && !detailError && detail && (
                  <div className="detail-extra">
                    <span>사진 {displayPhotos.length}건</span>
                    <span>감정평가 {detail.appraisals.length}건</span>
                    <span>면적상세 {detail.areas.length}건</span>
                  </div>
                )}
              </div>

              <div className="action-row">
                <a className="secondary-action" href={onbidSearchUrl(selected)} target="_blank" rel="noreferrer">온비드 원문 <ExternalLink size={16} /></a>
                <button className="primary-action" onClick={openBidCheck}>검토표 <ChevronRight size={18} /></button>
              </div>
            </article>
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
            {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />} 조회
          </button>
            </form>

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
                  {lot.thumbnail ? <img src={lot.thumbnail} alt={lot.title} loading="lazy" /> : <div className="lot-thumb-empty">사진 없음</div>}
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
              <div className="photo-strip">
                {displayPhotos.slice(0, 8).map((src, index) => (
                  <AuctionImage key={`${src}-${index}`} src={src} alt={`${selected.title} 사진 ${index + 1}`} />
                ))}
                {!displayPhotos.length && <div className="photo-empty">사진 없음</div>}
              </div>

              <div className="detail-head">
                <span className={`status ${statusClass(selected.status)}`}>{selected.status}</span>
                <button className="icon-button" aria-label="관심 물건 저장" onClick={() => toggleSaved(selected.id)}>
                  <Heart size={19} fill={saved.includes(selected.id) ? "currentColor" : "none"} />
                </button>
              </div>
              <h2>{selected.title}</h2>
              <p className="agency"><Landmark size={16} /> {selected.agency}</p>

              <div className="map-card">
                <iframe title={`${selected.title} 지도`} src={links.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                <div className="map-actions">
                  <a href={links.kakao} target="_blank" rel="noreferrer"><MapPin size={15} /> 카카오맵</a>
                  <a href={links.naver} target="_blank" rel="noreferrer"><Navigation size={15} /> 네이버지도</a>
                  <a href={links.google} target="_blank" rel="noreferrer"><ExternalLink size={15} /> 구글지도</a>
                </div>
              </div>

              <div className="detail-stats">
                <div><small>물건관리번호</small><strong>{selected.id}</strong></div>
                <div><small>공매조건번호</small><strong>{selected.conditionNo || "확인"}</strong></div>
                <div><small>감정가</small><strong>{compactMoney(selected.appraised)}</strong></div>
                <div><small>최저입찰가</small><strong>{compactMoney(selected.minimum)}</strong></div>
                <div><small>토지면적</small><strong>{selected.landArea ? `${selected.landArea.toLocaleString()}㎡` : "확인"}</strong></div>
                <div><small>건물면적</small><strong>{selected.buildingArea ? `${selected.buildingArea.toLocaleString()}㎡` : "확인"}</strong></div>
              </div>

              <div className="timeline">
                <div><CalendarDays size={18} /><span>입찰 시작</span><strong>{selected.starts || "확인"}</strong></div>
                <div><Clock3 size={18} /><span>입찰 마감</span><strong>{selected.ends || "확인"} · {daysLeft(selected.ends)}일</strong></div>
              </div>

              <div className="analysis-box">
                <strong><ShieldAlert size={16} /> 검토 체크</strong>
                <p>{selected.note}</p>
                <div className="check-list">
                  <span className={selected.shareYn === "Y" ? "danger" : ""}>지분물건: {selected.shareYn === "Y" ? "예" : "아니오"}</span>
                  <span>배분요구종기: {selected.distributionDue || "확인 필요"}</span>
                  <span>수의계약: {selected.privateContractYn === "Y" ? "가능" : "대상 아님"}</span>
                </div>
              </div>

              <div className="analysis-box">
                <strong>상세 정보</strong>
                {detailLoading && <p>물건상세 조회 중입니다.</p>}
                {detailError && <p>{detailError} 상세 서비스까지 승인되면 사진목록, 감정평가, 면적상세가 더 확장됩니다.</p>}
                {!detailLoading && !detailError && detail && (
                  <div className="detail-extra">
                    <span>사진 {displayPhotos.length}건</span>
                    <span>감정평가 {detail.appraisals.length}건</span>
                    <span>면적상세 {detail.areas.length}건</span>
                  </div>
                )}
              </div>

              <div className="action-row">
                <a className="secondary-action" href={onbidSearchUrl(selected)} target="_blank" rel="noreferrer">온비드 원문 <ExternalLink size={16} /></a>
                <button className="primary-action" onClick={openBidCheck}>검토표 <ChevronRight size={18} /></button>
              </div>
            </aside>
          )}
            </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
