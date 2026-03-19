import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { AudioEntry } from '../db/schema';

const ROW_HEIGHT = 56;
const DELETE_CHUNK_SIZE = 500;
const LOAD_CHUNK_SIZE = 10_000;

export default function Library() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AudioEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadTotal, setLoadTotal] = useState<number | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Deletion progress
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);

  // Disable dialog
  const [disableTarget, setDisableTarget] = useState<AudioEntry | null>(null);
  const [disableNote, setDisableNote] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) => e.reading.toLowerCase().includes(q) || (e.written ?? '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const loadEntries = useCallback(async () => {
    const total = await db.audioEntries.count();
    setLoadTotal(total);

    if (total === 0) {
      setInitialLoading(false);
      setLoadProgress(100);
      return;
    }

    const accumulated: AudioEntry[] = [];
    let lastKey: [string, string] | undefined;
    let firstChunk = true;

    while (true) {
      const chunk: AudioEntry[] = await (lastKey === undefined
        ? db.audioEntries.orderBy('[reading+id]').limit(LOAD_CHUNK_SIZE)
        : db.audioEntries.where('[reading+id]').above(lastKey).limit(LOAD_CHUNK_SIZE)
      ).toArray();

      if (chunk.length === 0) break;

      accumulated.push(...chunk);
      lastKey = [chunk[chunk.length - 1].reading, chunk[chunk.length - 1].id];

      setEntries(accumulated.slice());
      setLoadProgress(Math.round((accumulated.length / total) * 100));

      if (firstChunk) {
        setInitialLoading(false);
        firstChunk = false;
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((e) => next.add(e.id));
        return next;
      });
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected];
    const total = ids.length;
    setDeleting(true);
    setDeleteProgress(0);

    let deleted = 0;
    while (deleted < total) {
      await db.audioEntries.bulkDelete(ids.slice(deleted, deleted + DELETE_CHUNK_SIZE));
      deleted = Math.min(deleted + DELETE_CHUNK_SIZE, total);
      setDeleteProgress(Math.round((deleted / total) * 100));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // `selected` is already a Set — O(1) lookups, no conversion needed
    setEntries((prev) => prev.filter((e) => !selected.has(e.id)));
    setSelected(new Set());
    setDeleting(false);
  }

  function handlePlayAudio(url: string) {
    new Audio(url).play().catch(() => {
      // Phase 3: play error sound and flag entry
    });
  }

  function openDisableDialog(entry: AudioEntry) {
    setDisableTarget(entry);
    setDisableNote(entry.disabledNote ?? '');
  }

  async function handleDisableConfirm() {
    if (!disableTarget) return;
    await db.audioEntries.update(disableTarget.id, {
      disabled: true,
      disabledNote: disableNote.trim() || undefined,
    });
    setDisableTarget(null);
    await loadEntries();
  }

  async function handleEnable(entry: AudioEntry) {
    await db.audioEntries.update(entry.id, { disabled: false, disabledNote: undefined });
    await loadEntries();
  }

  if (initialLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          {loadTotal !== null ? `Loading ${loadTotal.toLocaleString()} entries…` : 'Loading…'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>
      {/* Toolbar */}
      <Box sx={{ p: 1, display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <TextField
          size="small"
          placeholder="Search reading or written…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            },
          }}
        />
        <Tooltip title="Import entries">
          <IconButton onClick={() => navigate('/import')}><AddIcon /></IconButton>
        </Tooltip>
        {selected.size > 0 && (
          <Tooltip title={`Delete ${selected.size} selected`}>
            <IconButton color="error" onClick={handleDeleteSelected} disabled={deleting}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {loadProgress < 100 && (
        <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Loading {entries.length.toLocaleString()} / {loadTotal?.toLocaleString() ?? '…'} entries ({loadProgress}%)
          </Typography>
          <LinearProgress variant="determinate" value={loadProgress} sx={{ height: 6, borderRadius: 3 }} />
        </Box>
      )}

      {deleting && (
        <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary">Deleting…</Typography>
          <LinearProgress variant="determinate" value={deleteProgress} sx={{ height: 6, borderRadius: 3 }} />
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 0.5, flexShrink: 0 }}>
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        {entries.length !== filtered.length && ` (of ${entries.length})`}
      </Typography>

      {/* Column headers */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tooltip title={allFilteredSelected ? 'Deselect all' : 'Select all'}>
          <Checkbox
            size="small"
            checked={allFilteredSelected}
            indeterminate={selected.size > 0 && !allFilteredSelected}
            onChange={toggleSelectAll}
            disabled={filtered.length === 0}
            sx={{ width: 40 }}
          />
        </Tooltip>
        <Typography variant="caption" sx={{ flex: '0 0 100px' }} fontWeight="bold">Reading</Typography>
        <Typography variant="caption" sx={{ flex: '0 0 100px' }} fontWeight="bold">Written</Typography>
        <Typography variant="caption" sx={{ flex: '0 0 48px' }} fontWeight="bold">Pitch</Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ width: 96 }} />
      </Box>

      {/* Virtualized list */}
      <Box ref={parentRef} sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const entry = filtered[item.index];
            const isSelected = selected.has(entry.id);

            return (
              <Box
                key={entry.id}
                sx={{
                  position: 'absolute',
                  top: item.start,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: entry.disabled ? 'action.disabledBackground' : isSelected ? 'action.selected' : 'background.paper',
                  opacity: entry.disabled ? 0.6 : 1,
                }}
              >
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onChange={() => toggleSelect(entry.id)}
                  sx={{ width: 40 }}
                />
                <Box sx={{ flex: '0 0 100px', overflow: 'hidden' }}>
                  <Typography variant="body2" noWrap>{entry.reading}</Typography>
                  {entry.disabled && entry.disabledNote && (
                    <Typography variant="caption" color="text.secondary" noWrap>{entry.disabledNote}</Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ flex: '0 0 100px' }} noWrap>
                  {entry.written ?? '—'}
                </Typography>
                <Typography variant="body2" sx={{ flex: '0 0 48px' }}>
                  {entry.pitch ?? '—'}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  {entry.disabled && <Chip label="disabled" size="small" color="warning" />}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, width: 96, justifyContent: 'flex-end' }}>
                  <Tooltip title="Play audio">
                    <IconButton size="small" onClick={() => handlePlayAudio(entry.audioUrl)}>
                      <PlayArrowIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {entry.disabled ? (
                    <Tooltip title="Re-enable">
                      <IconButton size="small" color="success" onClick={() => handleEnable(entry)}>
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Disable">
                      <IconButton size="small" onClick={() => openDisableDialog(entry)}>
                        <BlockIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {entries.length === 0 && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>No entries yet.</Typography>
          <Button variant="contained" onClick={() => navigate('/import')}>Import audio entries</Button>
        </Box>
      )}

      {/* Disable dialog */}
      <Dialog open={!!disableTarget} onClose={() => setDisableTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Disable entry</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {disableTarget?.reading}{disableTarget?.written ? ` (${disableTarget.written})` : ''}
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Reason (optional)"
            placeholder="e.g. audio is clipped, wrong reading"
            value={disableNote}
            onChange={(e) => setDisableNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableTarget(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleDisableConfirm}>Disable</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
