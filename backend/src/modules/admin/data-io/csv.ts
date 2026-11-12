/**
 * CSV helpers cho nhập / xuất dữ liệu.
 *
 * - Xuất: UTF-8 **có BOM** để Excel mở đúng tiếng Việt, phân cách cột bằng `,`.
 * - Nhập: tự nhận diện dấu phân cách (`,`, `;`, tab) vì Excel Việt Nam hay
 *   xuất file dùng `;`, và bỏ qua dấu BOM.
 */

/** Ô CSV: escape theo RFC 4180. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Chuyển mảng dòng thành nội dung CSV (không kèm BOM). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** CSV có BOM để Excel nhận đúng UTF-8. */
export function toCsvWithBom(rows: (string | number | null | undefined)[][]): string {
  return `\uFEFF${toCsv(rows)}`;
}

/** Chuẩn hoá tên cột: bỏ dấu tiếng Việt, ký tự lạ, viết thường. */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Đoán dấu phân cách cột từ dòng tiêu đề. */
function detectDelimiter(firstLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Tách nội dung CSV thành mảng dòng / ô.
 * Hỗ trợ dấu nháy kép, dòng mới trong ô và BOM.
 */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = delimiter ?? detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === sep) {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\r') continue;
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Bỏ các dòng trống ở cuối file. */
export function trimEmptyRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}
