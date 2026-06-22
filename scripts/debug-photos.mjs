import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const lotId = process.argv[2] || "2021-15016-003";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "debug-photo-response.json");

async function fetchJson(path) {
  const response = await fetch(`http://localhost:3000${path}`, { signal: AbortSignal.timeout(25000) });
  const text = await response.text();
  try {
    return { status: response.status, json: JSON.parse(text) };
  } catch {
    return { status: response.status, text: text.slice(0, 500) };
  }
}

const list = await fetchJson(
  `/onbid-api/B010003/OnbidRlstListSrvc2/getRlstCltrList2?resultType=json&pageNo=1&numOfRows=5&cltrMngNo=${encodeURIComponent(lotId)}&prptDivCd=0007&pvctTrgtYn=N`,
);
const listItem = list.json?.response?.body?.items?.item;
const lot = Array.isArray(listItem) ? listItem[0] : listItem;
const pbctCdtnNo = lot?.pbctCdtnNo || "";

let detailPath = `/onbid-api/B010003/OnbidRlstDtlSrvc2/getRlstDtlInf2?resultType=json&cltrMngNo=${encodeURIComponent(lotId)}`;
if (pbctCdtnNo) detailPath += `&pbctCdtnNo=${encodeURIComponent(pbctCdtnNo)}`;

const detail = await fetchJson(detailPath);
const detailItem = detail.json?.response?.body?.items?.item;
const item = Array.isArray(detailItem) ? detailItem[0] : detailItem;

const photoKeys = item ? Object.keys(item).filter((key) => /poto|photo|pic|img|thnl|file/i.test(key)) : [];
const photoSamples = {};
for (const key of photoKeys) {
  photoSamples[key] = item[key];
}

const output = {
  lotId,
  pbctCdtnNo,
  list: {
    status: list.status,
    resultCode: list.json?.response?.header?.resultCode,
    resultMsg: list.json?.response?.header?.resultMsg,
    totalCount: list.json?.response?.body?.totalCount,
    thnlImgUrlAdr: lot?.thnlImgUrlAdr,
    rawText: list.text,
    found: !!lot?.cltrMngNo,
  },
  detail: {
    status: detail.status,
    resultCode: detail.json?.response?.header?.resultCode,
    resultMsg: detail.json?.response?.header?.resultMsg,
    rawText: detail.text,
    photoKeys,
    photoSamples,
  },
};

writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
console.log(`Wrote ${outPath}`);
console.log(`detail photos keys: ${photoKeys.join(", ") || "(none)"}`);
