import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const key = process.env.ONBID_SERVICE_KEY || process.env.VITE_ONBID_SERVICE_KEY || "";
if (!key) {
  console.log("No service key in .env.local");
  process.exit(1);
}

const lot = {
  cltrMngNo: "2021-15016-003",
  pbctCdtnNo: "6031683",
  onbidCltrno: "1574126",
  onbidPbancNo: "891224",
  pbctNo: "10069343",
};

const paths = [
  "/B010003/OnbidRlstDtlSrvc2/getRlstDtlInf2",
  "/B010003/OnbidRlstDtlSrvc2/getRlstDtlInf",
];

for (const path of paths) {
  const params = new URLSearchParams({
    resultType: "json",
    pageNo: "1",
    numOfRows: "1",
    cltrMngNo: lot.cltrMngNo,
    pbctCdtnNo: lot.pbctCdtnNo,
    onbidCltrno: lot.onbidCltrno,
    onbidPbancNo: lot.onbidPbancNo,
    pbctNo: lot.pbctNo,
  });
  const url = `https://apis.data.go.kr${path}?${params}&serviceKey=${key}`;
  const res = await fetch(url);
  const text = await res.text();
  console.log(`\n${path}`);
  console.log("status", res.status);
  if (res.status === 403) {
    console.log("→ 물건상세 조회서비스(SVC-API-004) 활용신청이 이 키에 아직 승인되지 않았습니다.");
    console.log("  공공데이터포털 > 마이페이지 > 활용신청 > '한국자산관리공사_차세대 온비드 부동산 물건상세 조회서비스' 승인 여부를 확인하세요.");
  } else if (res.status === 200) {
    try {
      const payload = JSON.parse(text);
      const header = payload?.response?.header;
      console.log("resultCode", header?.resultCode, header?.resultMsg || "");
      const item = payload?.response?.body?.items?.item;
      if (item) {
        console.log("fields", Object.keys(item).slice(0, 12).join(", "), "...");
        console.log("photos", item.potoUrlList?.item?.length ?? item.potoUrlList?.length ?? 0);
      }
    } catch {
      console.log(text.slice(0, 300));
    }
  } else {
    console.log(text.slice(0, 300));
  }
}

// 목록 API는 같은 키로 동작하는지 확인
const listParams = new URLSearchParams({
  resultType: "json",
  pageNo: "1",
  numOfRows: "1",
  cltrMngNo: lot.cltrMngNo,
});
const listRes = await fetch(`https://apis.data.go.kr/B010003/OnbidRlstListSrvc2/getRlstCltrList2?${listParams}&serviceKey=${key}`);
console.log("\n[list] getRlstCltrList2 status", listRes.status);
