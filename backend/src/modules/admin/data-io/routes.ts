import { Router, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../../lib/errors';
import { logger } from '../../../lib/logger';
import { exportCurriculumCsv, importCurriculumCsv } from './curriculum';
import { exportSectionsCsv, importSectionsCsv } from './sections';
import { exportTranscriptCsv, importTranscriptCsv } from './transcript';

/**
 * Admin → nhập / xuất dữ liệu hàng loạt.
 *
 * Mục tiêu: thay vì cấu hình từng bản ghi một, admin tải file CSV (mở
 * bằng Excel được) rồi nhập lại; hệ thống tự tạo môn / khoa / ngành còn
 * thiếu và báo cáo rõ từng dòng lỗi.
 */
export const adminDataRouter = Router();

const importSchema = z.object({
  csv: z.string().min(1, 'Nội dung file trống').max(2_000_000),
  /** Chỉ kiểm tra mà không ghi vào database. */
  dryRun: z.boolean().optional().default(false),
});

function csvResponse(res: Response, csv: string, filename: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

/** Xuất bảng điểm (CSV). */
adminDataRouter.get(
  '/export/transcript.csv',
  asyncHandler(async (req, res) => {
    const semester = typeof req.query.semester === 'string' ? req.query.semester.trim() : undefined;
    const majorId = typeof req.query.majorId === 'string' ? req.query.majorId : undefined;
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;

    const csv = await exportTranscriptCsv({ semester, majorId, studentId });
    const suffix = semester ? `-${semester.replace(/[^\w.-]+/g, '_')}` : '';
    csvResponse(res, csv, `bang-diem${suffix}.csv`);
  }),
);

/** Nhập bảng điểm từ CSV. */
adminDataRouter.post(
  '/import/transcript',
  asyncHandler(async (req, res) => {
    const input = importSchema.parse(req.body);
    const report = await importTranscriptCsv(input.csv, input.dryRun);
    logger.info({ ...report, dryRun: input.dryRun }, 'Transcript CSV imported');
    res.json({ report, dryRun: input.dryRun });
  }),
);

/** Xuất chương trình đào tạo (CSV). */
adminDataRouter.get(
  '/export/curriculum.csv',
  asyncHandler(async (req, res) => {
    const majorId = typeof req.query.majorId === 'string' ? req.query.majorId : undefined;
    const csv = await exportCurriculumCsv({ majorId });
    csvResponse(res, csv, 'chuong-trinh-dao-tao.csv');
  }),
);

/** Nhập chương trình đào tạo từ CSV. */
adminDataRouter.post(
  '/import/curriculum',
  asyncHandler(async (req, res) => {
    const input = importSchema.parse(req.body);
    const report = await importCurriculumCsv(input.csv, input.dryRun);
    logger.info({ ...report, dryRun: input.dryRun }, 'Curriculum CSV imported');
    res.json({ report, dryRun: input.dryRun });
  }),
);

/** Xuất cấu hình lịch học (CSV), có thể lọc theo học kỳ. */
adminDataRouter.get(
  '/export/sections.csv',
  asyncHandler(async (req, res) => {
    const semester = typeof req.query.semester === 'string' ? req.query.semester.trim() : undefined;
    const csv = await exportSectionsCsv({ semester });
    const suffix = semester ? `-${semester.replace(/[^\w.-]+/g, '_')}` : '';
    csvResponse(res, csv, `lich-hoc${suffix}.csv`);
  }),
);

/** Nhập cấu hình lịch học từ CSV. */
adminDataRouter.post(
  '/import/sections',
  asyncHandler(async (req, res) => {
    const input = importSchema.parse(req.body);
    const report = await importSectionsCsv(input.csv, input.dryRun);
    logger.info({ ...report, dryRun: input.dryRun }, 'Schedule sections CSV imported');
    res.json({ report, dryRun: input.dryRun });
  }),
);

/** Mẫu CSV để admin tải về làm mẫu nhập liệu. */
adminDataRouter.get(
  '/template/:kind',
  asyncHandler(async (req, res) => {
    const kind = req.params.kind;
    if (kind !== 'transcript' && kind !== 'curriculum' && kind !== 'sections') {
      throw AppError.badRequest('Loại mẫu không hợp lệ (transcript | curriculum | sections).');
    }
    const csv =
      kind === 'transcript'
        ? await exportTranscriptCsv({})
        : kind === 'sections'
          ? await exportSectionsCsv({})
          : await exportCurriculumCsv({});
    csvResponse(res, csv, `mau-${kind}.csv`);
  }),
);
