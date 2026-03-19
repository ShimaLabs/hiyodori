import Papa from 'papaparse';

export interface ParsedRow {
  reading: string;
  audioUrl: string;
  written?: string;
  pitch?: number;
}

export interface ParseWarning {
  row: number;
  message: string;
}

export interface DuplicateWarning {
  reading: string;
  pitch: number | undefined;
  rows: number[];
}

export interface ParseResult {
  rows: ParsedRow[];
  missingFieldWarnings: ParseWarning[];
  duplicateWarnings: DuplicateWarning[];
}

export function parseCSV(raw: string): ParseResult {
  // Auto-detect delimiter: try tab first, fall back to comma
  const delimiter = raw.includes('\t') ? '\t' : ',';

  const result = Papa.parse<Record<string, string>>(raw.trim(), {
    delimiter,
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedRow[] = [];
  const missingFieldWarnings: ParseWarning[] = [];

  result.data.forEach((record, i) => {
    const rowNum = i + 2; // 1-based, skipping header
    const reading = record['reading']?.trim();
    const audioUrl = record['audio_url']?.trim();

    if (!reading || !audioUrl) {
      missingFieldWarnings.push({
        row: rowNum,
        message: !reading && !audioUrl
          ? 'Missing reading and audio_url'
          : !reading
          ? 'Missing reading'
          : 'Missing audio_url',
      });
      return;
    }

    const writtenRaw = record['written']?.trim();
    const pitchRaw = record['pitch']?.trim();
    const pitch = pitchRaw !== undefined && pitchRaw !== '' ? Number(pitchRaw) : undefined;

    rows.push({
      reading,
      audioUrl,
      written: writtenRaw || undefined,
      pitch: pitch !== undefined && !isNaN(pitch) ? pitch : undefined,
    });
  });

  // Detect functionally duplicate entries: same reading + same pitch (or both absent)
  const seen = new Map<string, { pitch: number | undefined; indices: number[] }[]>();
  rows.forEach((row, i) => {
    const existing = seen.get(row.reading) ?? [];
    const match = existing.find((e) =>
      e.pitch === row.pitch
    );
    if (match) {
      match.indices.push(i);
    } else {
      existing.push({ pitch: row.pitch, indices: [i] });
    }
    seen.set(row.reading, existing);
  });

  const duplicateWarnings: DuplicateWarning[] = [];
  seen.forEach((groups, reading) => {
    groups.forEach(({ pitch, indices }) => {
      if (indices.length > 1) {
        duplicateWarnings.push({
          reading,
          pitch,
          rows: indices.map((i) => i + 2), // 1-based + header
        });
      }
    });
  });

  return { rows, missingFieldWarnings, duplicateWarnings };
}
