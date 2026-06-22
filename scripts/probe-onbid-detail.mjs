const lotId = process.argv[2] || "2021-15016-003";
const listRes = await fetch(
  `http://localhost:3000/onbid-api/B010003/OnbidRlstListSrvc2/getRlstCltrList2?resultType=json&pageNo=1&numOfRows=5&cltrMngNo=${encodeURIComponent(lotId)}&prptDivCd=0007&pvctTrgtYn=N`,
);
const listJson = await listRes.json();
function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

const items = asArray(listJson.body?.items?.item);
const lot = items.find((entry) => entry.cltrMngNo === lotId) ?? items[0];
if (!lot) {
  console.log("lot not found");
  process.exit(1);
}

console.log("lot meta", {
  cltrMngNo: lot.cltrMngNo,
  onbidCltrno: lot.onbidCltrno,
  pbctCdtnNo: lot.pbctCdtnNo,
  pbctNo: lot.pbctNo,
  onbidPbancNo: lot.onbidPbancNo,
  prptDivCd: lot.prptDivCd,
});

const query = new URLSearchParams({
  cltrPrptDivCd: "5",
  cltrScrnGrpCd: "1",
  onbidCltrno: String(lot.onbidCltrno),
  onbidPbancNo: String(lot.onbidPbancNo),
  pbctCdtnNo: String(lot.pbctCdtnNo),
  pbctNo: String(lot.pbctNo),
});

const pageUrl = `http://localhost:3000/onbid-file/op/cltrpbancinf/cltrdtl/CltrDtlController/mvmnCltrDtl.do?${query}`;
const pageRes = await fetch(pageUrl, { headers: { Referer: "https://www.onbid.co.kr/" } });
const html = await pageRes.text();
console.log("page", pageRes.status, "bytes", html.length);

const fileUrls = [...html.matchAll(/dnldFile\.do\?[^"'<>\\s]+/g)].map((match) => match[0]);
console.log("dnldFile count", fileUrls.length);
fileUrls.slice(0, 12).forEach((url, index) => console.log(index + 1, url.slice(0, 140)));

const ajaxHints = [...new Set([...html.matchAll(/select[A-Za-zPotoAtch][A-Za-z]+/g)].map((match) => match[0]))];
console.log("ajax hints", ajaxHints.slice(0, 20));
