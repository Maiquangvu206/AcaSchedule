"""Unit tests for RAG service (ai/app/services/rag.py)."""

from app.services.rag import (
    normalize,
    tokenize,
    split_sentences,
    chunk_text,
    retrieve,
    summarize,
)


class TestNormalize:
    def test_lowercase_and_strip_diacritics(self):
        assert normalize("Tiếng Việt") == "tieng viet"
        assert normalize("ĐÀO TẠO") == "dao tao"

    def test_empty_string(self):
        assert normalize("") == ""


class TestTokenize:
    def test_basic_tokenization(self):
        tokens = tokenize("Chào mừng bạn đến với hệ thống")
        assert "chào" in tokens or "chao" in tokens
        assert "he" in tokens or "thong" in tokens

    def test_removes_stopwords(self):
        tokens = tokenize("của và trong với")
        assert len(tokens) == 0  # all are Vietnamese stopwords


class TestSplitSentences:
    def test_splits_on_period(self):
        sentences = split_sentences("Anh đi học. Em đi ngủ.")
        assert len(sentences) == 2

    def test_empty_string(self):
        assert split_sentences("") == []


class TestChunkText:
    def test_short_text_returns_single_chunk(self):
        text = "Văn bản ngắn."
        chunks = chunk_text(text, max_chars=100)
        assert chunks == ["Văn bản ngắn."]

    def test_long_text_splits(self):
        text = "A. " * 100  # ~200 chars
        chunks = chunk_text(text, max_chars=50)
        assert len(chunks) > 1


class TestRetrieve:
    def test_retrieves_relevant_chunks(self):
        documents = [
            ("doc1", "Học lập trình Python rất thú vị"),
            ("doc2", "Nấu ăn món Phở rất ngon"),
        ]
        chunks = retrieve("lập trình python", documents, top_k=1)
        assert len(chunks) == 1
        assert chunks[0].title == "doc1"

    def test_returns_empty_when_no_match(self):
        documents = [("doc1", "Nấu ăn món Phở")]
        chunks = retrieve("lập trình", documents, top_k=3)
        assert len(chunks) == 0

    def test_respects_top_k(self):
        documents = [
            ("doc1", "Python lập trình"),
            ("doc2", "Python web"),
            ("doc3", "Python data"),
        ]
        chunks = retrieve("Python", documents, top_k=2)
        assert len(chunks) <= 2


class TestSummarize:
    def test_summarize_short_text_returns_original(self):
        text = "Chỉ có một câu."
        result = summarize(text, max_sentences=5)
        assert result == "Chỉ có một câu."

    def test_summarize_long_text(self):
        text = " ".join(["Câu thứ {}.".format(i) for i in range(20)])
        result = summarize(text, max_sentences=3)
        assert len(result.split(".")) <= 4  # up to 3 sentences + trailing
