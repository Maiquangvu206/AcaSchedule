# AcaSchedule AI Service

Microservice cố vấn học tập và RAG cho AcaSchedule. Chạy độc lập với backend Node.js,
giao tiếp nội bộ qua HTTP và được backend proxy tại `/api/ai/*`.

## Chức năng

| Endpoint | Mô tả |
| --- | --- |
| `GET /health` | Trạng thái service + đã cấu hình Gemini hay chưa. |
| `POST /advice` | Phân tích bảng điểm, tính CPA và gợi ý mục tiêu học tập. |
| `POST /documents/summarize` | Tóm tắt văn bản tài liệu bài giảng. |
| `POST /qa` | Hỏi đáp trên ngữ cảnh tài liệu (retrieval + Gemini). |

Khi chưa có `GEMINI_API_KEY`, service vẫn trả lời bằng **fallback cục bộ** (tính CPA,
tóm tắt trích xuất, xếp hạng đoạn liên quan) và đánh dấu `used_fallback: true`.

## Chạy local

```shell
cd ai
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Mở http://localhost:8001/docs để xem OpenAPI.

## Biến môi trường

| Biến | Mặc định | Ghi chú |
| --- | --- | --- |
| `GEMINI_API_KEY` | rỗng | Bật Gemini; để trống dùng fallback. |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Model sinh văn bản. |
| `GEMINI_TIMEOUT_SECONDS` | `30` | Timeout gọi Gemini. |

## Cấu trúc

```
ai/
├── app/
│   ├── config.py            # Pydantic Settings
│   ├── schemas.py           # Request/response models
│   ├── main.py              # FastAPI app
│   ├── routers/             # health, advisor, documents
│   └── services/            # gemini client, RAG helpers
├── requirements.txt
└── Dockerfile
```

## Ghi chú RAG

`app/services/rag.py` hiện dùng chunking + xếp hạng theo truy vấn từ khóa để chạy không
cần hạ tầng vector DB. Khi tích hợp pgvector/Qdrant, chỉ cần thay `retrieve()` và giữ
nguyên contract của router.
