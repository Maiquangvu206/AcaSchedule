"""Lightweight RAG helpers: chunking, ranking and extractive summarisation.

Designed to work without a vector database so the service can run in development
with zero extra infrastructure. Swap ``retrieve`` for pgvector/Qdrant later.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

_WORD_RE = re.compile(r"\w+", re.UNICODE)
_SENTENCE_RE = re.compile(r"(?<=[.!?…])\s+|\n+")

_VI_STOPWORDS = {
    "va", "la", "cua", "cho", "cac", "nhung", "trong", "voi", "khi", "de",
    "mot", "nhieu", "nhu", "the", "nay", "do", "thi", "se", "da", "dang",
    "tu", "den", "tren", "duoi", "boi", "vi", "nen", "ma", "hoac", "vao",
    "ra", "co", "khong", "duoc", "bi", "tai", "theo", "ve", "o", "a", "an",
}

_EN_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "it", "this", "that", "as",
    "by", "from", "at", "which", "we", "you", "they", "he", "she", "not",
}

STOPWORDS = _VI_STOPWORDS | _EN_STOPWORDS


@dataclass(frozen=True)
class Chunk:
    title: str
    text: str
    score: float = 0.0


def normalize(text: str) -> str:
    """Lowercase and strip Vietnamese diacritics for fuzzy matching."""

    lowered = text.lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d")


def tokenize(text: str) -> list[str]:
    return [
        token
        for token in _WORD_RE.findall(normalize(text))
        if len(token) > 1 and token not in STOPWORDS
    ]


def split_sentences(text: str) -> list[str]:
    return [sentence.strip() for sentence in _SENTENCE_RE.split(text) if sentence.strip()]


def chunk_text(text: str, max_chars: int = 900, overlap: int = 120) -> list[str]:
    """Split text into overlapping chunks on sentence boundaries."""

    if len(text) <= max_chars:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sentence in split_sentences(text):
        if current and current_len + len(sentence) > max_chars:
            chunks.append(" ".join(current).strip())
            # Keep a tail of the previous chunk for context continuity.
            tail = " ".join(current)[-overlap:]
            current = [tail] if tail else []
            current_len = len(tail)

        current.append(sentence)
        current_len += len(sentence) + 1

    if current:
        chunks.append(" ".join(current).strip())

    return chunks


def retrieve(question: str, documents: list[tuple[str, str]], top_k: int = 3) -> list[Chunk]:
    """Rank document chunks by keyword overlap with the question."""

    query_terms = set(tokenize(question))
    if not query_terms:
        return []

    candidates: list[Chunk] = []
    for title, body in documents:
        for chunk in chunk_text(body):
            terms = Counter(tokenize(chunk))
            if not terms:
                continue
            score = sum(terms.get(term, 0) for term in query_terms)
            if score > 0:
                candidates.append(Chunk(title=title, text=chunk, score=float(score)))

    candidates.sort(key=lambda item: item.score, reverse=True)
    return candidates[:top_k]


def summarize(text: str, max_sentences: int = 6) -> str:
    """Extractive summary: rank sentences by informative word frequency."""

    sentences = split_sentences(text)
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    frequencies = Counter(tokenize(text))
    if not frequencies:
        return " ".join(sentences[:max_sentences])

    scored: list[tuple[float, int, str]] = []
    for index, sentence in enumerate(sentences):
        terms = tokenize(sentence)
        if not terms:
            continue
        score = sum(frequencies[term] for term in terms) / (len(terms) ** 0.5)
        scored.append((score, index, sentence))

    top = sorted(scored, key=lambda item: item[0], reverse=True)[:max_sentences]
    ordered = sorted(top, key=lambda item: item[1])
    return " ".join(sentence for _, _, sentence in ordered)
