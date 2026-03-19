import { useState, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useNavigate } from 'react-router-dom';
import { parseCSV, type ParseResult } from '../import/parseCSV';
import { db } from '../db';
import type { AudioEntry, ImportBatch } from '../db/schema';

type Step = 'input' | 'confirm' | 'importing' | 'done';

const CHUNK_SIZE = 500;

export default function Import() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('input');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input step
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [choonpuIsDistinct, setChoonpuIsDistinct] = useState(true);
  const [distinguishesNasalG, setDistinguishesNasalG] = useState(true);
  const [particleSpelling, setParticleSpelling] = useState<'phonetic' | 'orthographic'>('phonetic');

  // Confirm step
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Import step
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFileContent(ev.target?.result as string ?? null);
    reader.readAsText(file, 'utf-8');
  }

  function handleParse() {
    if (!fileContent) return;
    setParseResult(parseCSV(fileContent));
    setStep('confirm');
  }

  function handleReset() {
    setStep('input');
    setFileName(null);
    setFileContent(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleConfirm() {
    if (!parseResult) return;
    setStep('importing');
    setProgress(0);
    setImportedCount(0);

    const batchId = crypto.randomUUID();
    const batch: ImportBatch = {
      id: batchId,
      importedAt: Date.now(),
      choonpuIsDistinct,
      distinguishesNasalG,
      particleSpelling,
    };
    await db.importBatches.add(batch);

    const entries: AudioEntry[] = parseResult.rows.map((row) => ({
      id: crypto.randomUUID(),
      reading: row.reading,
      audioUrl: row.audioUrl,
      written: row.written,
      pitch: row.pitch,
      batchId,
      disabled: false,
    }));

    let written = 0;
    while (written < entries.length) {
      await db.audioEntries.bulkAdd(entries.slice(written, written + CHUNK_SIZE));
      written = Math.min(written + CHUNK_SIZE, entries.length);
      setImportedCount(written);
      setProgress(Math.round((written / entries.length) * 100));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setStep('done');
  }

  if (step === 'input') {
    return (
      <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h5" gutterBottom>Import Audio Entries</Typography>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <Paper
          variant="outlined"
          onClick={() => fileInputRef.current?.click()}
          sx={{
            p: 4,
            mb: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            borderStyle: 'dashed',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <UploadFileIcon fontSize="large" color="action" />
          {fileName ? (
            <Typography variant="body1" fontWeight="bold">{fileName}</Typography>
          ) : (
            <>
              <Typography variant="body1">Click to select a CSV or TSV file</Typography>
              <Typography variant="caption" color="text.secondary">
                Expected columns: reading, audio_url, written (optional), pitch (optional)
              </Typography>
            </>
          )}
        </Paper>

        <Typography variant="subtitle1" gutterBottom>Batch metadata</Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={<Switch checked={choonpuIsDistinct} onChange={(e) => setChoonpuIsDistinct(e.target.checked)} />}
            label="ー is phonemically distinct (センセー ≠ センセイ)"
          />
          <FormControlLabel
            control={<Switch checked={distinguishesNasalG} onChange={(e) => setDistinguishesNasalG(e.target.checked)} />}
            label="Distinguishes nasalized ガ行 (カ゚キ゚ク゚ケ゚コ゚)"
          />
          <FormControl>
            <FormLabel>Particle spelling convention</FormLabel>
            <RadioGroup
              row
              value={particleSpelling}
              onChange={(e) => setParticleSpelling(e.target.value as 'phonetic' | 'orthographic')}
            >
              <FormControlLabel value="phonetic" control={<Radio />} label="Phonetic (コンニチワ)" />
              <FormControlLabel value="orthographic" control={<Radio />} label="Orthographic (コンニチハ)" />
            </RadioGroup>
          </FormControl>
        </Paper>

        <Button
          variant="contained"
          fullWidth
          disabled={!fileContent}
          onClick={handleParse}
        >
          Parse & Preview
        </Button>
      </Box>
    );
  }

  if (step === 'confirm' && parseResult) {
    const { rows, missingFieldWarnings, duplicateWarnings } = parseResult;

    return (
      <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h5" gutterBottom>Confirm Import</Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          {rows.length} entries ready to import
        </Alert>

        {missingFieldWarnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              {missingFieldWarnings.length} row(s) skipped — missing required fields:
            </Typography>
            {missingFieldWarnings.slice(0, 5).map((w) => (
              <Typography key={w.row} variant="body2">Row {w.row}: {w.message}</Typography>
            ))}
            {missingFieldWarnings.length > 5 && (
              <Typography variant="body2">…and {missingFieldWarnings.length - 5} more</Typography>
            )}
          </Alert>
        )}

        {duplicateWarnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              {duplicateWarnings.length} functionally duplicate group(s):
            </Typography>
            {duplicateWarnings.slice(0, 5).map((w, i) => (
              <Typography key={i} variant="body2">
                {w.reading} (pitch: {w.pitch ?? 'none'}) — rows {w.rows.join(', ')}
              </Typography>
            ))}
            {duplicateWarnings.length > 5 && (
              <Typography variant="body2">…and {duplicateWarnings.length - 5} more</Typography>
            )}
          </Alert>
        )}

        {rows.length > 0 && (
          <Box sx={{ mb: 2, overflowX: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom>
              Sample (first {Math.min(rows.length, 5)} of {rows.length} rows)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reading</TableCell>
                  <TableCell>Written</TableCell>
                  <TableCell>Pitch</TableCell>
                  <TableCell>Audio URL</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 5).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.reading}</TableCell>
                    <TableCell>{row.written ?? '—'}</TableCell>
                    <TableCell>{row.pitch ?? '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.audioUrl}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={() => setStep('input')}>Back</Button>
          <Button variant="contained" disabled={rows.length === 0} onClick={handleConfirm} sx={{ flex: 1 }}>
            Import {rows.length} entries
          </Button>
        </Box>
      </Box>
    );
  }

  if (step === 'importing') {
    return (
      <Box sx={{ p: 2, maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>Importing…</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {importedCount} / {parseResult?.rows.length ?? 0} entries written
        </Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>Import complete!</Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        {importedCount} entries added to your library.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button variant="outlined" onClick={handleReset}>Import more</Button>
        <Button variant="contained" onClick={() => navigate('/library')}>Go to Library</Button>
      </Box>
    </Box>
  );
}
