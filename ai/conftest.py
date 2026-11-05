"""Pytest configuration for AI service tests."""

import pytest


@pytest.fixture
def sample_grades():
    from app.schemas import GradeItem

    return [
        GradeItem(subject="Math", credits=3, grade4=3.5, is_counted_in_cpa=True),
        GradeItem(subject="Physics", credits=2, grade4=3.0, is_counted_in_cpa=True),
        GradeItem(subject="Art", credits=1, grade4=4.0, is_counted_in_cpa=False),
    ]
