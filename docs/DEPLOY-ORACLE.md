# Oracle Cloud 무료 VM 배포 가이드

에드가공매 Express 서버를 **Oracle Cloud Always Free** ARM VM에 올리는 방법입니다.  
비용: **$0/월** (무료 티어 범위 내).

---

## 준비물

| 항목 | 설명 |
|------|------|
| Oracle Cloud 계정 | [cloud.oracle.com](https://cloud.oracle.com) 가입 |
| 공공데이터 API 키 | `.env`의 `ONBID_SERVICE_KEY` |
| SSH 키 | Windows: `ssh-keygen` 또는 PuTTY |
| 도메인 (선택) | 없으면 IP로 HTTP 접속 가능. HTTPS·플레이스토어에는 도메인 권장 |

---

## 1. Oracle VM 만들기

1. **Compute → Instances → Create instance**
2. 이름: `onbidapp`
3. **Image**: Ubuntu 22.04 (aarch64)
4. **Shape**: `VM.Standard.A1.Flex` — OCPU 1, RAM 6GB (Always Free)
5. **Networking**: 공인 IP 할당 (Assign a public IPv4 address)
6. **SSH keys**: 본인 공개키 업로드
7. 생성 후 **Public IP** 메모

### 방화벽 (필수)

Oracle은 VM 안의 ufw 말고 **VCN 보안 목록**도 열어야 합니다.

1. 인스턴스 → Subnet → Security List → **Add Ingress Rules**
2. 아래 규칙 추가:

| Source | Protocol | Port |
|--------|----------|------|
| 0.0.0.0/0 | TCP | 22 |
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

---

## 2. SSH 접속

```bash
ssh ubuntu@<공인IP>
```

Windows PowerShell에서도 동일합니다.

---

## 3. 서버 최초 설정 (VM에서 1회)

```bash
sudo apt-get update -y
sudo apt-get install -y git
sudo git clone https://github.com/edgacst/onbidapp.git /opt/onbidapp
cd /opt/onbidapp
sudo bash deploy/oracle/setup-vm.sh
```

도메인이 있으면:

```bash
sudo CERTBOT_EMAIL=your@gmail.com bash deploy/oracle/setup-vm.sh onbid.내도메인.com
```

스크립트가 자동으로 처리하는 것:

- Node.js 20, nginx, certbot, ufw
- `npm install` + 프로덕션 빌드
- systemd 서비스 `onbidapp` 등록
- nginx 리버스 프록시 (80 → localhost:3000)
- 도메인 있으면 Let's Encrypt HTTPS

### 환경 변수 설정

```bash
sudo nano /opt/onbidapp/.env
```

최소한 아래를 채웁니다:

```env
NODE_ENV=production
PORT=3000
ONBID_SERVICE_KEY=공공데이터포털_인코딩_인증키
```

저장 후:

```bash
sudo systemctl restart onbidapp
```

### 동작 확인

```bash
sudo systemctl status onbidapp
curl -s http://127.0.0.1:3000 | head
```

브라우저: `http://<공인IP>` 또는 `https://<도메인>`

---

## 4. 이후 코드 업데이트

### VM에서 직접

```bash
bash /opt/onbidapp/deploy/oracle/update-app.sh
```

### PC에서 SSH로

`.env.local`에 추가:

```env
ORACLE_HOST=123.456.789.0
ORACLE_USER=ubuntu
```

```powershell
npm run deploy:oracle
```

---

## 5. 유용한 명령

| 명령 | 설명 |
|------|------|
| `sudo systemctl status onbidapp` | 서비스 상태 |
| `sudo systemctl restart onbidapp` | 재시작 |
| `tail -f /opt/onbidapp/logs/server.log` | 로그 |
| `sudo nginx -t` | nginx 설정 검사 |
| `sudo certbot renew --dry-run` | SSL 갱신 테스트 |

---

## 6. 도메인 연결 (선택)

1. 도메인 구매 (Cloudflare, Namecheap 등 — 연 $1~2 `.xyz` 등)
2. DNS **A 레코드** → VM 공인 IP
3. VM에서:

```bash
cd /opt/onbidapp
sudo bash deploy/oracle/setup-vm.sh onbid.내도메인.com
```

---

## 7. 플레이스토어 앱 연동 (다음 단계)

Android 앱(Capacitor) 빌드 시 API 서버 주소를 지정합니다:

```env
VITE_API_ORIGIN=https://onbid.내도메인.com
```

앱은 `dist`를 번들로 쓰고, `/onbid-api`·`/onbid-file` 요청만 위 서버로 보냅니다.

---

## DB는?

현재 회원·찜·질문은 **브라우저 localStorage**에만 있습니다.  
VM 배포만으로는 **기기마다 데이터가 따로** 남습니다.

서버 DB(SQLite 등)는 **2단계**에서 붙이면 됩니다. 지금은 API 프록시 + 정적 파일 서빙만으로 스토어 출시 가능합니다.

---

## 문제 해결

### 사이트가 안 열림

- Oracle **보안 목록** 80/443 열었는지 확인
- VM 안: `sudo ufw status`
- `systemctl status onbidapp` — `active (running)` 인지

### API 오류 / 빈 목록

- `/opt/onbidapp/.env`의 `ONBID_SERVICE_KEY` 확인
- `tail -f /opt/onbidapp/logs/server.log`

### 빌드 실패

```bash
cd /opt/onbidapp
node scripts/build-prod.mjs
```

### certbot 실패

- 도메인 DNS가 VM IP를 가리키는지 확인 (`ping onbid.내도메인.com`)
- 수동: `sudo certbot --nginx -d onbid.내도메인.com`

---

## 비용 참고

| 항목 | 비용 |
|------|------|
| Oracle Always Free VM | $0 |
| 도메인 | 연 ~$1–15 (선택) |
| DB (나중에 SQLite on VM) | $0 |

월 **$1 미만**으로 가려면: Oracle VM $0 + 저가 도메인만 쓰면 됩니다.
