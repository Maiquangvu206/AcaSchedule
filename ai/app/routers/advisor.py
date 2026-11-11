from __future__ import annotations

from fastapi import APIRouter

from ..schemas import AdviceRequest, AdviceResponse, GradeItem, GradeScaleItem
from ..services.llm import generate_or_fallback_meta

router = APIRouter()


def _scale_lines(scales: list[GradeScaleItem]) -> str:
    """Official grading scale, highest threshold first."""
    if not scales:
        return (
            "- (Chưa cấu hình thang điểm. Dùng quy ước phổ biến: A+ >= 9.0, A >= 8.5, "
            "B+ >= 8.0, B >= 7.0, C+ >= 6.5, C >= 5.5, D+ >= 5.0, D >= 4.0, F < 4.0)"
        )

    ordered = sorted(scales, key=lambda item: item.minScore10, reverse=True)
    return "\n".join(
        f"- Từ {item.minScore10:.1f} điểm hệ 10: {item.letterGrade} = "
        f"{item.grade4:.1f}/4 ({'đạt' if item.isPass else 'không đạt'})"
        for item in ordered
    )


def _grade_lines(grades: list[GradeItem]) -> str:
    lines: list[str] = []
    for grade in grades:
        score = (
            f"{grade.score10:.1f}/10"
            if grade.score10 is not None
            else "chưa có điểm hệ 10"
        )
        letter = f" ({grade.letter})" if grade.letter else ""
        counted = "được tính" if grade.is_counted_in_cpa else "không tính"
        lines.append(
            f"- {grade.subject}: {score}{letter} = {grade.grade4:.1f}/4, "
            f"{grade.credits} tín chỉ, {counted} vào CPA"
        )
    return "\n".join(lines) or "- (chưa có dữ liệu điểm)"


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
    grade_lines = _grade_lines(payload.grades)
    scale_lines = _scale_lines(payload.grade_scale)

    target = f"{payload.target_cpa:.2f}/4.0" if payload.target_cpa is not None else "chưa đặt"

    # Khi backend gửi kèm số liệu tổng hợp thì dùng luôn, để câu trả lời khớp
    # chính xác với trang bảng điểm (AI không tự tính lại).
    summary = payload.summary
    if summary is not None:
        stats_block = (
            f"CPA hiện tại: {summary.cpa:.2f}/4.0\n"
            f"Tín chỉ tính CPA: {summary.credits_counted}\n"
            f"Tín chỉ tích lũy (môn đã đạt): {summary.credits_earned}\n"
            f"Tín chỉ đã học (gồm môn trượt và học lại): {summary.credits_studied}\n"
            f"Số môn tính CPA: {summary.counted_subjects}/{summary.total_attempts} lượt"
        )
    else:
        stats_block = (
            f"CPA hiện tại: {cpa:.2f}/4.0 trên {credits} tín chỉ được tính"
        )

    return (
        "Bạn là cố vấn học tập cho sinh viên đại học Việt Nam. "
        "Trả lời bằng tiếng Việt, ngắn gọn, thực tế và có hành động cụ thể. "
        "Chỉ dùng văn bản thuần: không dùng Markdown, không dùng dấu **, không dùng tiêu đề dạng #. "
        "Mỗi ý chính viết thành một dòng bắt đầu bằng dấu -; tối đa 5 ý, trả lời đầy đủ "
        "và luôn kết thúc ở cuối một câu.\n\n"
        f"Sinh viên: {payload.student_name or 'ẩn danh'}\n"
        f"{stats_block}\n"
        f"Mục tiêu CPA: {target}\n\n"
        "Thang điểm chính thức của trường (bắt buộc dùng đúng thang này khi đổi điểm hệ 10 "
        f"sang điểm chữ/hệ 4; không tự bịa ngưỡng khác):\n{scale_lines}\n\n"
        f"Bảng điểm của sinh viên:\n{grade_lines}\n\n"
        f"Câu hỏi: {payload.question or 'Hãy phân tích và đề xuất kế hoạch cải thiện điểm.'}\n\n"
        "Khi nhắc đến điểm của một môn, ghi kèm cả điểm hệ 10 (nếu có), điểm chữ và điểm hệ 4 "
        "theo thang điểm trên. Mọi con số CPA/mục tiêu phải dùng đúng số liệu đã cung cấp. "
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
