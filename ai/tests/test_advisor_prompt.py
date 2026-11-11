"""The advisor prompt must carry the official, admin-managed grading scale."""

from app.routers.advisor import _grade_lines, _prompt, _scale_lines
from app.schemas import AdviceRequest, GradeItem, GradeScaleItem, SummaryItem

SCALE = [
    GradeScaleItem(minScore10=9.0, letterGrade="A+", grade4=4.0, isPass=True),
    GradeScaleItem(minScore10=8.5, letterGrade="A", grade4=4.0, isPass=True),
    GradeScaleItem(minScore10=4.0, letterGrade="D", grade4=1.0, isPass=True),
    GradeScaleItem(minScore10=0.0, letterGrade="F", grade4=0.0, isPass=False),
]

GRADES = [
    GradeItem(subject="Giải tích hàm một biến", credits=3, grade4=1.0, score10=4.2, letter="D"),
    GradeItem(subject="Cấu trúc dữ liệu", credits=4, grade4=3.0, score10=7.4, letter="B"),
]


def test_scale_lines_sorted_high_to_low():
    lines = _scale_lines(SCALE)

    assert lines.splitlines()[0].startswith("- Từ 9.0")
    assert "A+ = 4.0/4 (đạt)" in lines
    assert lines.splitlines()[-1].startswith("- Từ 0.0")
    assert "F = 0.0/4 (không đạt)" in lines


def test_scale_falls_back_to_common_convention():
    assert "Chưa cấu hình thang điểm" in _scale_lines([])


def test_grade_lines_include_both_scales():
    lines = _grade_lines(GRADES)

    assert "Giải tích hàm một biến: 4.2/10 (D) = 1.0/4, 3 tín chỉ" in lines
    assert "Cấu trúc dữ liệu: 7.4/10 (B) = 3.0/4, 4 tín chỉ" in lines


def test_prompt_contains_the_configured_scale():
    prompt = _prompt(AdviceRequest(grades=GRADES, grade_scale=SCALE), cpa=2.1, credits=7)

    assert "Thang điểm chính thức của trường" in prompt
    assert "Từ 8.5 điểm hệ 10: A = 4.0/4 (đạt)" in prompt
    assert "không tự bịa ngưỡng khác" in prompt
    assert "4.2/10 (D)" in prompt


def test_prompt_uses_the_backend_summary_when_provided():
    summary = SummaryItem(
        cpa=3.09,
        credits_counted=89,
        credits_earned=90,
        credits_studied=95,
        counted_subjects=30,
        total_attempts=33,
    )
    prompt = _prompt(
        AdviceRequest(grades=GRADES, grade_scale=SCALE, summary=summary),
        cpa=0,
        credits=0,
    )

    assert "CPA hiện tại: 3.09/4.0" in prompt
    assert "Tín chỉ tính CPA: 89" in prompt
    assert "Tín chỉ tích lũy (môn đã đạt): 90" in prompt
    assert "Tín chỉ đã học (gồm môn trượt và học lại): 95" in prompt
    assert "30/33 lượt" in prompt
    # The model must not recompute the totals itself.
    assert "trên 0 tín chỉ" not in prompt


def test_prompt_falls_back_to_computed_cpa_without_summary():
    prompt = _prompt(AdviceRequest(grades=GRADES, grade_scale=SCALE), cpa=2.1, credits=7)

    assert "CPA hiện tại: 2.10/4.0 trên 7 tín chỉ" in prompt
