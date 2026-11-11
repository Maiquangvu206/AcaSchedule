from __future__ import annotations

from fastapi import APIRouter

from ..schemas import AdviceRequest, AdviceResponse, GradeItem
from ..services.llm import generate_or_fallback_meta

router = APIRouter()


def _counted(grades: list[GradeItem]) -> list[GradeItem]:
    return [grade for grade in grades if grade.is_counted_in_cpa and grade.credits > 0]


def _weighted_cpa(grades: list[GradeItem]) -> tuple[float, int]:
    counted = _counted(grades)
    credits = sum(grade.credits for grade in counted)
    if credits == 0:
        return 0.0, 0
    points = sum(grade.grade4 * grade.credits for grade in counted)
    return points / credits, credits


def _fallback(payload: AdviceRequest, cpa: float, credits: int) -> str:
    lines: list[str] = []

    if credits == 0:
        lines.append("Chưa có môn nào được tính vào CPA. Hãy nhập điểm các môn đã hoàn thành.")
    else:
        lines.append(
            f"CPA hiện tại ước tính: {cpa:.2f}/4.0 trên {credits} tín chỉ được tính."
        )

    if payload.target_cpa is not None and credits > 0:
        if cpa >= payload.target_cpa:
            lines.append(
                f"Bạn đã đạt mục tiêu {payload.target_cpa:.2f}. Hãy giữ phong độ ở các kỳ tiếp theo."
            )
        else:
            needed_points = payload.target_cpa * credits - cpa * credits
            lines.append(
                "Còn thiếu khoảng "
                f"{needed_points:.1f} điểm hệ 4 (tổng) để đạt mục tiêu {payload.target_cpa:.2f}."
            )
            next_credits = 15
            required = (payload.target_cpa * (credits + next_credits) - cpa * credits) / next_credits
            lines.append(
                f"Nếu học thêm {next_credits} tín chỉ, điểm trung bình cần đạt là "
                f"{max(0.0, min(4.0, required)):.2f}."
            )

    weak = sorted(_counted(payload.grades), key=lambda grade: grade.grade4)[:3]
    if weak:
        lines.append("Môn nên ưu tiên cải thiện: " + ", ".join(
            f"{grade.subject} ({grade.grade4:.2f}/4)" for grade in weak
        ) + ".")

    lines.append(
        "Gợi ý: ưu tiên môn nhiều tín chỉ và điểm thấp, đăng ký học cải thiện nếu quy chế cho phép, "
        "và giữ lịch ôn tập đều mỗi tuần."
    )

    if payload.question:
        lines.append(
            "Câu hỏi chi tiết cần AI: hãy cấu hình GEMINI_API_KEYS hoặc OPENROUTER_API_KEYS "
            "để nhận tư vấn cá nhân hóa."
        )

    return "\n".join(lines)


def _prompt(payload: AdviceRequest, cpa: float, credits: int) -> str:
    grade_lines = "\n".join(
        f"- {grade.subject}: {grade.grade4}/4, {grade.credits} tín chỉ, "
        f"{'được tính' if grade.is_counted_in_cpa else 'không tính'} vào CPA"
        for grade in payload.grades
    ) or "- (chưa có dữ liệu điểm)"

    target = f"{payload.target_cpa:.2f}/4.0" if payload.target_cpa is not None else "chưa đặt"

    return (
        "Bạn là cố vấn học tập cho sinh viên đại học Việt Nam. "
        "Trả lời bằng tiếng Việt, ngắn gọn, thực tế và có hành động cụ thể. "
        "Chỉ dùng văn bản thuần: không dùng Markdown, không dùng dấu **, không dùng tiêu đề dạng #. "
        "Mỗi ý chính viết thành một dòng bắt đầu bằng dấu -; tối đa 5 ý, trả lời đầy đủ "
        "và luôn kết thúc ở cuối một câu.\n\n"
        f"Sinh viên: {payload.student_name or 'ẩn danh'}\n"
        f"CPA hiện tại: {cpa:.2f}/4.0 trên {credits} tín chỉ\n"
        f"Mục tiêu CPA: {target}\n"
        f"Bảng điểm:\n{grade_lines}\n"
        f"Câu hỏi: {payload.question or 'Hãy phân tích và đề xuất kế hoạch cải thiện điểm.'}\n\n"
        "Lưu ý quy chế: học lại thay thế cờ CPA của lượt F cũ; học cải thiện chỉ tính lượt cao nhất; "
        "tín chỉ tích lũy chỉ đếm một lần."
    )


@router.post("/advice", response_model=AdviceResponse)
async def advice(payload: AdviceRequest) -> AdviceResponse:
    cpa, credits = _weighted_cpa(payload.grades)
    fallback = _fallback(payload, cpa, credits)
    text, model, used_fallback = await generate_or_fallback_meta(
        _prompt(payload, cpa, credits), fallback
    )

    return AdviceResponse(
        advice=text,
        model=model,
        used_fallback=used_fallback,
    )
