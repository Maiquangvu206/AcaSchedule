"""Unit tests for document routers (ai/app/routers/documents.py)."""

import asyncio

from app.routers.documents import summarize_document, qa
from app.schemas import SummarizeRequest, QaRequest, QaDocument


class TestSummarizeDocument:
    def test_summarize_short_text(self):
        request = SummarizeRequest(text="Văn bản ngắn.", max_sentences=5)
        response = asyncio.run(summarize_document(request))
        assert response.summary == "Văn bản ngắn."
        assert response.model == "fallback"
        assert response.used_fallback is True

    def test_summarize_long_text(self):
        text = " ".join(["Câu thứ {}.".format(i) for i in range(20)])
        request = SummarizeRequest(text=text, max_sentences=3)
        response = asyncio.run(summarize_document(request))
        assert len(response.summary) > 0
        assert response.model == "fallback"


class TestQa:
    def test_qa_no_relevant_chunks(self):
        request = QaRequest(
            question="lập trình python",
            documents=[QaDocument(title="doc1", text="Nấu ăn món Phở")],
        )
        response = asyncio.run(qa(request))
        assert "Không tìm thấy" in response.answer
        assert response.sources == []
        assert response.model == "fallback"
        assert response.used_fallback is True

    def test_qa_with_relevant_chunks(self):
        request = QaRequest(
            question="python",
            documents=[QaDocument(title="doc1", text="Học lập trình Python")],
        )
        response = asyncio.run(qa(request))
        assert len(response.sources) == 1
        assert response.sources[0].title == "doc1"
        assert response.model == "fallback"
        assert response.used_fallback is True
