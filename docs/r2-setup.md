# Kho lưu trữ file với Cloudflare R2

AcaSchedule **không lưu file trong Postgres**. Cơ sở dữ liệu (Supabase) chỉ giữ
metadata của tài liệu; nội dung file (PDF, DOCX, ảnh…) nằm trong một bucket S3.

```
Trình duyệt ──(1) xin URL ký──► Backend (Render) ── ký presigned URL, TTL 10 phút
            ◄──(2) URL ────────┘
Trình duyệt ──(3) PUT file ───► R2 bucket            ← file thật nằm ở đây
            ──(4) POST /api/documents ──► Supabase (metadata) ← object_key, size, mime
Trình duyệt ──(5) GET tải ────► Backend ký URL tải ──► R2
```

Đường dẫn object: `subjects/<subject_id>/<student_id>/<uuid>.<ext>`

---

## 1. Tạo bucket

1. Đăng nhập <https://dash.cloudflare.com> → **R2 Object Storage**
2. **Create bucket**
   - Name: `acaschedule-documents` (phải trùng `MINIO_BUCKET`)
   - Location: `Automatic`
   - **Không** bật Public access (bucket để private)
3. Ghi lại **Account ID** (góc phải trang R2)

Endpoint của bạn sẽ là:

```
<account-id>.r2.cloudflarestorage.com
```

---

## 2. Tạo API token (S3 credentials)

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Permissions: **Object Read & Write**
3. Specify bucket: **acaschedule-documents**
4. TTL: để trống (không hết hạn)
5. **Create**

Lưu lại 2 giá trị (chỉ hiện 1 lần):

| Cloudflare hiển thị | Biến môi trường |
|---|---|
| Access Key ID | `MINIO_ACCESS_KEY` |
| Secret Access Key | `MINIO_SECRET_KEY` |

---

## 3. Cấu hình CORS cho bucket

R2 → bucket `acaschedule-documents` → **Settings → CORS Policy** → dán:

```json
[
  {
    "AllowedOrigins": [
      "https://acaschedule-frontend-ax5x.onrender.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Thiếu CORS → trình duyệt báo `Failed to fetch` ngay khi upload (dù URL ký hợp lệ).

---

## 4. Biến môi trường trên Render

Render → **acaschedule-backend → Environment** → thêm:

| Key | Value |
|---|---|
| `MINIO_ENDPOINT` | `<account-id>.r2.cloudflarestorage.com` |
| `MINIO_PORT` | `443` |
| `MINIO_USE_SSL` | `true` |
| `MINIO_PUBLIC_ENDPOINT` | `<account-id>.r2.cloudflarestorage.com` |
| `MINIO_PUBLIC_PORT` | `443` |
| `MINIO_PUBLIC_USE_SSL` | `true` |
| `MINIO_ACCESS_KEY` | Access Key ID (bước 2) |
| `MINIO_SECRET_KEY` | Secret Access Key (bước 2) |
| `MINIO_BUCKET` | `acaschedule-documents` |
| `MINIO_REGION` | `auto` |

Lưu ý:

- Endpoint **không** kèm `https://` và **không** kèm port (port khai báo riêng).
- `MINIO_REGION=auto` là bắt buộc với R2 (chữ thường).
- `MINIO_PUBLIC_*` là host mà **trình duyệt** dùng để upload/tải → với R2 trùng hẳn với `MINIO_*`.

`render.yaml` đã có sẵn block này (các key bí mật để `sync: false`), nhưng với
service **đã tồn tại** thì phải thêm tay trong dashboard như bảng trên.

---

## 5. Deploy và kiểm tra

1. **Manual Deploy** backend
2. Mở `https://acaschedule-backend.onrender.com/api/health`

Mong đợi:

```json
{"checks":{"database":"up","redis":"down","storage":"up"}}
```

- `storage: up` → đã nối được bucket
- vẫn `down` → xem log Render, tìm `MinIO not ready — retrying` (sai endpoint/key/bucket)

3. Vào trang **Tài liệu** → chọn môn → chọn file → **Chia sẻ tài liệu**
4. Kiểm tra trong R2 bucket: phải có object `subjects/<uuid>/<uuid>/<uuid>.pdf`

---

## 6. Bảo mật & giới hạn

| Hạng mục | Giá trị hiện tại |
|---|---|
| Bucket visibility | private |
| URL upload | presigned PUT, hết hạn sau **10 phút** |
| URL tải | presigned GET, hết hạn sau **10 phút** |
| Kích thước tối đa | **100 MB** / file (`MAX_DOCUMENT_SIZE_BYTES`) |
| Loại file | PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, PNG, JPG |
| Chặn | exe, msi, bat, cmd, scr, dll, jar, sh, ps1, vbs, js, php, py, apk, dmg… |

Access key chỉ nằm trong Environment của Render, **không** bao giờ gửi xuống frontend.

---

## 7. Chi phí

| Hạng mục | Miễn phí |
|---|---|
| Dung lượng | 10 GB |
| Class A (ghi) | 1 triệu request/tháng |
| Class B (đọc) | 10 triệu request/tháng |
| Egress (băng thông tải ra) | **$0** — không giới hạn |

Với file 100 MB: 10 GB ≈ 100 file. Có thể bật **Lifecycle rule** để tự xoá file cũ
nếu cần.

---

## 8. Đổi nhà cung cấp sau này

Vì dùng chuẩn S3, chỉ cần đổi biến môi trường, **không sửa code**:

| Nhà cung cấp | `MINIO_ENDPOINT` | `MINIO_REGION` |
|---|---|---|
| Cloudflare R2 | `<account>.r2.cloudflarestorage.com` | `auto` |
| Backblaze B2 | `s3.<region>.backblazeb2.com` | `<region>` (vd `us-west-004`) |
| AWS S3 | `s3.<region>.amazonaws.com` | `<region>` (vd `ap-southeast-1`) |
| MinIO tự dựng | host của bạn | `us-east-1` |

Sau khi đổi endpoint, dữ liệu cũ **không tự chuyển** — cần copy object sang bucket mới
(`rclone` hoặc `aws s3 sync`).

---

## 9. Lỗi thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| `storage: down` | Sai endpoint/key/bucket, hoặc token thiếu quyền |
| `Failed to fetch` khi upload | Bucket thiếu CORS (bước 3) |
| `SignatureDoesNotMatch` | `MINIO_SECRET_KEY` sai, hoặc `MINIO_REGION` khác `auto` |
| `Tải tệp lên kho thất bại (HTTP 403)` | Token chỉ Read, thiếu Write |
| Upload xong nhưng không hiện tài liệu | Bước `POST /api/documents` thất bại — xem Network tab |
