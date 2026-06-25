# Hostinger — 기존 사이트 보호 배포

**원칙: 기존 nginx 설정 파일은 수정·삭제하지 않습니다.**  
`onbidapp` 파일만 추가하고, 전용 **서브도메인**으로만 연결합니다.

## 절대 하지 말 것

| 금지 | 이유 |
|------|------|
| `deploy/oracle/setup-vm.sh` | default nginx 삭제 |
| `server_name _` / IP 단독 연결 | 기존 도메인 트래픽 간섭 가능 |
| 포트 80을 Node가 직접 사용 | 기존 nginx 중단 |

---

## 안전 배포 (3단계)

### 1) 사전 점검 + nginx 백업

```bash
git clone https://github.com/edgacst/onbidapp.git /opt/onbidapp
bash /opt/onbidapp/deploy/hostinger/preflight.sh onbid.내도메인.com
```

- 도메인이 기존 nginx와 **겹치면 중단**
- `/opt/onbidapp/backups/nginx/` 에 자동 백업

### 2) 앱만 먼저 (nginx **미변경**)

```bash
nano /opt/onbidapp/.env   # ONBID_SERVICE_KEY
APP_ONLY=1 bash /opt/onbidapp/deploy/hostinger/setup-existing.sh onbid.내도메인.com
```

기존 사이트 **100% 동일**. 에드가공매는 `127.0.0.1:3010` 에만 떠 있음.

```bash
curl -s http://127.0.0.1:3010/ | head
```

### 3) 문제없으면 nginx 연결

DNS: `onbid.내도메인.com` → `187.127.107.200`

```bash
CERTBOT_EMAIL=freecompr20@gmail.com \
  bash /opt/onbidapp/deploy/hostinger/setup-existing.sh onbid.내도메인.com
```

- `sites-available/onbidapp` **새 파일만** 생성
- `nginx -t` 실패 시 **자동 롤백** (기존 설정 복구)

SSL 나중에:

```bash
SKIP_SSL=1 bash /opt/onbidapp/deploy/hostinger/setup-existing.sh onbid.내도메인.com
```

---

## 롤백 (에드가공매만 제거)

```bash
bash /opt/onbidapp/deploy/hostinger/rollback.sh
```

기존 사이트 nginx는 그대로, onbidapp 항목만 삭제.

---

## 구조

```
nginx :80/:443
├── 기존사이트.com   → 기존 설정 (변경 없음)
└── onbid.도메인.com → 127.0.0.1:3010 (신규 파일만)
```

기본 포트 **3010** (3000과 충돌 방지).

---

## 업데이트

```bash
bash /opt/onbidapp/deploy/oracle/update-app.sh
```

nginx는 건드리지 않고 앱만 재시작합니다.
