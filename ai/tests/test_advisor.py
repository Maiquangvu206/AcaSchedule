"""Unit tests for AI Advisor (ai/app/routers/advisor.py)."""

from app.routers.advisor import _weighted_cpa, _fallback, _prompt
from app.schemas import AdviceRequest, GradeItem


class TestWeightedCpa:
    def test_empty_grades(self):
        cpa, credits = _weighted_cpa([])
        assert cpa == 0.0
        assert credits == 0

    def test_single_counted_grade(self):
        grades = [
            GradeItem(subject="Math", credits=3, grade4=3.5, is_counted_in_cpa=True)
        ]
        cpa, credits = _weighted_cpa(grades)
        assert cpa == 3.5
        assert credits == 3

    def test_ignores_not_counted(self):
        grades = [
            GradeItem(subject="Math", credits=3, grade4=4.0, is_counted_in_cpa=True),
            GradeItem(subject="Art", credits=2, grade4=2.0, is_counted_in_cpa=False),
        ]
        cpa, credits = _weighted_cpa(grades)
        assert cpa == 4.0
        assert credits == 3

    def test_zero_credits_not_counted(self):
        grades = [
            GradeItem(subject="Math", credits=0, grade4=4.0, is_counted_in_cpa=True),
            GradeItem(subject="Art", credits=3, grade4=3.0, is_counted_in_cpa=True),
        ]
        cpa, credits = _weighted_cpa(grades)
        assert cpa == 3.0
        assert credits == 3


class TestFallback:
    def test_no_credits_message(self):
        request = AdviceRequest(grades=[], target_cpa=None)
        result = _fallback(request, 0.0, 0)
        assert "Chưa có môn nào" in result

    def test_target_achieved(self):
        request = AdviceRequest(grades=[], target_cpa=3.0)
        result = _fallback(request, 3.5, 30)
        assert "đã đạt mục tiêu" in result

    def test_weak_subjects_listed(self):
        grades = [
            GradeItem(subject="Math", credits=3, grade4=2.0, is_counted_in_cpa=True),
            GradeItem(subject="Art", credits=2, grade4=3.5, is_counted_in_cpa=True),
        ]
        request = AdviceRequest(grades=grades)
        result = _fallback(request, 2.75, 5)
        assert "Math" in result


class TestPrompt:
    def test_prompt_contains_student_name(self):
        request = AdviceRequest(student_name="Nguyễn Văn A")
        prompt = _prompt(request, 3.0, 10)
        assert "Nguyễn Văn A" in prompt

    def test_prompt_contains_target_cpa(self):
        request = AdviceRequest(target_cpa=3.5)
        prompt = _prompt(request, 3.0, 10)
        assert "3.50" in prompt
