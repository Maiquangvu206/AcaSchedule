from pydantic import BaseModel, Field


class GradeItem(BaseModel):
    subject: str
    credits: int = Field(ge=0, le=30)
    grade4: float = Field(ge=0, le=4)
    # Score on the 10-point scale and the matching letter, as configured by the
    # admin. Optional so older payloads keep working.
    score10: float | None = Field(default=None, ge=0, le=10)
    letter: str | None = None
    is_counted_in_cpa: bool = True


class GradeScaleItem(BaseModel):
    minScore10: float = Field(ge=0, le=10)
    letterGrade: str
    grade4: float = Field(ge=0, le=4)
    isPass: bool


class SummaryItem(BaseModel):
    """Aggregate figures computed by the backend (never recalculated by the model)."""

    cpa: float = 0
    credits_counted: int = 0
    credits_earned: int = 0
    credits_studied: int = 0
    counted_subjects: int = 0
    total_attempts: int = 0


class AdviceRequest(BaseModel):
    student_name: str | None = None
    target_cpa: float | None = Field(default=None, ge=0, le=4)
    grades: list[GradeItem] = Field(default_factory=list)
    # Official, admin-editable grading scale (score 10 → letter → GPA4).
    grade_scale: list[GradeScaleItem] = Field(default_factory=list)
    # Pre-computed totals so the answer matches the transcript page exactly.
    summary: SummaryItem | None = None
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
