# HR-Base

Phần mềm quản lý nhân sự (HRM) tối giản, lấy cảm hứng từ Base HRM, chạy hoàn toàn trên **Cloudflare Free**: 1 Worker (API + static UI) + 1 D1 database.

Module: Tổng quan (headcount, NS theo phòng ban, HĐ sắp hết hạn) · Hồ sơ nhân sự · Phòng ban + sơ đồ tổ chức · Hợp đồng lao động · Nghỉ phép (tạo đơn, duyệt/từ chối).

## Deploy

```bash
npm i
npx wrangler login
npx wrangler d1 create hr-base          # copy database_id vào wrangler.toml
npm run db:remote                       # tạo bảng
npm run deploy                          # -> https://hr-base.<subdomain>.workers.dev
```

## Bảo mật — BẮT BUỘC

App **không có login riêng**: dùng **Cloudflare Access** (Zero Trust, free ≤ 50 users).
Dashboard → Zero Trust → Access → Applications → Self-hosted → domain `hr-base.<subdomain>.workers.dev`
→ policy Allow theo email/domain công ty. Chưa bật Access thì ai có link cũng xem/sửa được dữ liệu.
Email người duyệt nghỉ phép lấy từ header `Cf-Access-Authenticated-User-Email`.

## Dev

```bash
npm run db:local && npm run dev     # http://localhost:8787
npm test                            # smoke test API (cần dev server đang chạy)
```

## Giới hạn Free tier
Workers 100k request/ngày · D1 5 GB, 5M row reads/ngày — dư cho vài nghìn nhân sự.
