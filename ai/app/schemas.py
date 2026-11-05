from pydantic import BaseModel, Field


class GradeItem(BaseModel):
    subject: str
    credits: int = Field(ge=0, le=30)
    grade4: float = Field(ge=0, le=4)
    is_counted_in_cpa: bool = True


class AdviceRequest(BaseModel):
    student_name: str | None = None
    target_cpa: float | None = Field(default=None, ge=0, le=4)
    grades: list[GradeItem] = Field(default_factory=list)
    question: str | None = None


class AdviceResponse(BaseModel):
    advice: str
    model: str
    used_fallback: bool


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=1)
    max_sentences: int = Field(default=6, ge=1, le=20)


class SummarizeResponse(BaseModel):
    summary: str
    model: str
    used_fallback: bool


class QaDocument(BaseModel):
    title: str = "Untitled"
    text: str = Field(min_length=1)


class QaRequest(BaseModel):
    question: str = Field(min_length=1)
    documents: list[QaDocument] = Field(default_factory=list)


class QaSource(BaseModel):
    title: str
    snippet: str


class QaResponse(BaseModel):
    answer: str
    sources: list[QaSource]
    model: str
    used_fallback: bool
