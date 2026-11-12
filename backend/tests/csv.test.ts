import { describe, expect, it } from 'vitest';
import { csvCell, normalizeHeader, parseCsv, toCsv, toCsvWithBom, trimEmptyRows } from '../src/modules/admin/data-io/csv';

describe('csvCell', () => {
  it('leaves plain values untouched', () => {
    expect(csvCell('abc')).toBe('abc');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes values containing a comma, quote or newline', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('toCsv', () => {
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('adds a BOM so Excel reads UTF-8', () => {
    expect(toCsvWithBom([['a']]).startsWith('\uFEFF')).toBe(true);
  });
});

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('strips the BOM', () => {
    expect(parseCsv('\uFEFFa,b')).toEqual([['a', 'b']]);
  });

  it('detects semicolon separated files (Excel VN)', () => {
    expect(parseCsv('a;b;c\n1;2;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('detects tab separated files', () => {
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quoted values containing the delimiter', () => {
    expect(parseCsv('a,"b,c"')).toEqual([['a', 'b,c']]);
  });

  it('handles escaped quotes', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('handles newlines inside quotes', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']]);
  });

  it('keeps empty cells', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });
});

describe('normalizeHeader', () => {
  it('removes Vietnamese diacritics and punctuation', () => {
    expect(normalizeHeader('Mã sinh viên')).toBe('masinhvien');
    expect(normalizeHeader('Tỉ lệ Process')).toBe('tileprocess');
    expect(normalizeHeader('Học kỳ')).toBe('hocky');
    expect(normalizeHeader('Điểm thi')).toBe('diemthi');
  });
});

describe('trimEmptyRows', () => {
  it('drops rows where every cell is blank', () => {
    expect(trimEmptyRows([['a', 'b'], ['', '  '], []])).toEqual([['a', 'b']]);
  });
});
