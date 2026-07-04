# Hostinger → Contabo 서버 이전 기록

**이전일:** 2026-07-04

## 서버 정보

| 항목 | 기존 (Hostinger) | 신규 (Contabo) |
|------|-------------------|----------------|
| IP | 187.127.107.200 | 155.133.7.76 |
| 위치 | 말레이시아 | 도쿄 (일본) |
| 스펙 | 4GB RAM | 6 vCPU / 12GB RAM / 100GB NVMe |
| 플랜 | Hostinger VPS | Cloud VPS 10 SSD |
| 월 비용 | ~20,000원 | €9.55 (~14,000원) |
| OS | Ubuntu | Ubuntu 24.04 |

## 운영 중인 사이트

| 사이트 | 도메인 | 구성 |
|--------|--------|------|
| 에드가공매 | https://edgauction.com | Node.js Express + SQLite (systemd) |
| 비즈그랜트 | https://bizgrant.kr | Spring + PostgreSQL + React (Docker) |

---

## 이전 과정

### 1. Contabo VPS 주문

- https://contabo.com → Cloud VPS 10 SSD
- Region: Japan (Tokyo)
- OS: Ubuntu 24.04
- 1 Month 결제 (€9.55)
- 서류 확인(Verification) 통과 필요 (신분증 + 카드 앞면)

### 2. 서버 초기 설정

```bash
ssh root@155.133.7.76
```

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

### 3. 에드가공매 설치

```bash
git clone https://github.com/edgacst/onbidapp.git /opt/onbidapp
cd /opt/onbidapp
npm install
mkdir -p data logs
```

### 4. 에드가공매 .env 설정

```bash
nano /opt/onbidapp/.env
```

```env
NODE_ENV=production
PORT=3010
ONBID_SERVICE_KEY=인증키
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=freecompr20@gmail.com
SMTP_PASS=Gmail앱비밀번호
MAIL_FROM=freecompr20@gmail.com
MAIL_FROM_NAME=에드가공매
DATABASE_PATH=/opt/onbidapp/data/members.sqlite
ADMIN_EMAIL=freecompr20@gmail.com
ADMIN_PASSWORD=관리자비밀번호
SESSION_TTL_DAYS=30
```

### 5. 에드가공매 빌드 + 서비스 등록

```bash
cd /opt/onbidapp
node scripts/build-prod.mjs
cp deploy/hostinger/onbidapp.service /etc/systemd/system/onbidapp.service
systemctl daemon-reload
systemctl enable onbidapp
systemctl start onbidapp
```

### 6. nginx 설정 (edgauction.com)

```bash
cat > /etc/nginx/sites-available/edgauction << 'EOF'
server {
    listen 80;
    server_name edgauction.com;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/edgauction /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 7. DNS 변경 (edgauction.com)

- Cloudflare → A 레코드 `@` → `155.133.7.76` (DNS only)

### 8. SSL 발급 (edgauction.com)

```bash
certbot --nginx -d edgauction.com --non-interactive --agree-tos -m freecompr20@gmail.com
```

### 9. Docker 설치

```bash
curl -fsSL https://get.docker.com | sh
```

### 10. 비즈그랜트 파일 전송 (Hostinger → Contabo)

Hostinger에서 실행:

```bash
rsync -avz --progress /root/bizgrant/ root@155.133.7.76:/root/bizgrant/
```

### 11. 비즈그랜트 DB 백업 + 전송

Hostinger에서:

```bash
docker exec bizgrant-db pg_dump -U postgres bizgrant | gzip > /root/bizgrant-db-backup.sql.gz
scp /root/bizgrant-db-backup.sql.gz root@155.133.7.76:/root/bizgrant-db-backup.sql.gz
```

### 12. 비즈그랜트 .env 설정

Contabo에서:

```bash
cd /root/bizgrant
nano .env
```

Hostinger의 `.env` 내용 복사 후 포트 변경:

```env
HTTP_PORT=8081
HTTPS_PORT=8444
```

### 13. 비즈그랜트 Docker 빌드 + 실행

```bash
cd /root/bizgrant
docker compose -f docker-compose.prod.yml up -d --build
```

### 14. 비즈그랜트 DB 복원

```bash
gunzip -c /root/bizgrant-db-backup.sql.gz | docker exec -i bizgrant-db psql -U postgres bizgrant
```

### 15. nginx 설정 (bizgrant.kr)

```bash
cat > /etc/nginx/sites-available/bizgrant << 'EOF'
server {
    listen 80;
    server_name bizgrant.kr www.bizgrant.kr;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/bizgrant /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 16. DNS 변경 (bizgrant.kr)

- 후이즈 → A 레코드 → `155.133.7.76`

### 17. SSL 발급 (bizgrant.kr)

```bash
certbot --nginx -d bizgrant.kr -d www.bizgrant.kr --non-interactive --agree-tos -m freecompr20@gmail.com
```

### 18. 에드가공매 회원 데이터 복원

Hostinger에서:

```bash
scp /opt/onbidapp/data/members.sqlite root@155.133.7.76:/opt/onbidapp/data/members.sqlite
```

Contabo에서:

```bash
systemctl restart onbidapp
```

---

## Contabo 서버 구조

```
호스트 nginx (80/443, SSL)
├── edgauction.com → proxy → 127.0.0.1:3010 (onbidapp systemd)
└── bizgrant.kr    → proxy → 127.0.0.1:8081 (bizgrant Docker)

onbidapp (systemd, 포트 3010)
└── /opt/onbidapp — Express + SQLite

bizgrant (Docker)
├── bizgrant-web  (nginx, 포트 8081)
├── bizgrant-api  (Spring Boot, 내부 8080)
└── bizgrant-db   (PostgreSQL 16, 내부 5432)
```

---

## 일상 운영 명령어

### 에드가공매 업데이트

```bash
cd /opt/onbidapp && git pull && bash deploy/oracle/update-app.sh
```

### 비즈그랜트 업데이트

```bash
cd /root/bizgrant && docker compose -f docker-compose.prod.yml up -d --build
```

### 서비스 상태 확인

```bash
systemctl status onbidapp
docker ps
```

### SSL 인증서 갱신 (자동, 확인용)

```bash
certbot renew --dry-run
```

### DB 백업

```bash
# 에드가공매
cp /opt/onbidapp/data/members.sqlite ~/backup-onbid-$(date +%F).sqlite

# 비즈그랜트
docker exec bizgrant-db pg_dump -U postgres bizgrant | gzip > ~/backup-bizgrant-$(date +%F).sql.gz
```

---

## Contabo 관리

- 패널: https://new.contabo.com/
- 고객 ID: 15152526
- 주문 ID: 15152527
- 서버: vmi3417449
- IP: 155.133.7.76

---

## 주의사항

- Hostinger는 안정성 확인 후 해지
- Contabo는 환불 불가 — 1개월 단위 갱신
- 만족 시 12개월 결제로 전환하면 20% 할인
