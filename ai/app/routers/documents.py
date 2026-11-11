from __future__ import annotations

from fastapi import APIRouter

from ..config import get_settings
from ..schemas import (
    QaRequest,
    QaResponse,
    QaSource,
    SummarizeRequest,
    SummarizeResponse,
)
from ..services import rag
from ..services.llm import generate_or_fallback_meta

router = APIRouter()


@router.post("/documents/summarize", response_model=SummarizeResponse)
async def summarize_document(payload: SummarizeRequest) -> SummarizeResponse:
    settings = get_settings()
    text = payload.text[: settings.max_context_chars]
    fallback = rag.summarize(text, max_sentences=payload.max_sentences)

    prompt = (
        "Tóm tắt tài liệu học tập sau bằng tiếng Việt, giữ lại định nghĩa, công thức và ý chính. "
        f"Tối đa {payload.max_sentences} câu.\n\n---\n{text}\n---"
    )
    summary, model, used_fallback = await generate_or_fallback_meta(prompt, fallback)

    return SummarizeResponse(
        summary=summary,
        model=model,
        used_fallback=used_fallback,
    )


@router.post("/qa", response_model=QaResponse)
async def qa(payload: QaRequest) -> QaResponse:
    settings = get_settings()
    documents = [
        (document.title, document.text[: settings.max_context_chars])
        for document in payload.documents
    ]
    chunks = rag.retrieve(payload.question, documents)

    if not chunks:
        return QaResponse(
            answer=(
                "Không tìm thấy đoạn tài liệu nào liên quan tới câu hỏi. "
                "Hãy tải thêm tài liệu hoặc diễn đạt lại câu hỏi."
            ),
            sources=[],
            model="fallback",
            used_fallback=True,
        )

    context = "\n\n".join(f"[{chunk.title}]\n{chunk.text}" for chunk in chunks)
    fallback = (
        "Các đoạn tài liệu liên quan nhất:\n\n"
        + "\n\n".join(f"[{chunk.title}] {chunk.text[:400]}..." for chunk in chunks)
    )

    prompt = (
        "Bạn là trợ lý ôn thi. Chỉ dùng ngữ cảnh dưới đây để trả lời bằng tiếng Việt. "
        "Nếu ngữ cảnh không đủ, nói rõ là không đủ thông tin.\n\n"
        f"Ngữ cảnh:\n{context}\n\nCâu hỏi: {payload.question}"
    )
    answer, model, used_fallback = await generate_or_fallback_meta(prompt, fallback)

    sources = [
        QaSource(title=chunk.title, snippet=chunk.text[:300])
        for chunk in chunks
    ]

    return QaResponse(
        answer=answer,
        sources=sources,
        model=model,
        used_fallback=used_fallback,
    )
