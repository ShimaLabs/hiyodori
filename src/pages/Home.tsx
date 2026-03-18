import { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { wanakanaConverter } from '../kana';

export default function Home() {
  const navigate = useNavigate();
  const [romaji, setRomaji] = useState('');

  return (
    <Box sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        Hiyodori
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Kana listening practice
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 300, mx: 'auto' }}>
        <Button variant="contained" onClick={() => navigate('/session-setup')}>
          Start Practice
        </Button>
        <Button variant="outlined" onClick={() => navigate('/library')}>
          Audio Library
        </Button>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            KanaConverter demo
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Type romaji…"
            value={romaji}
            onChange={(e) => setRomaji(e.target.value)}
          />
          <Typography variant="h6" sx={{ mt: 1, letterSpacing: 2 }}>
            {wanakanaConverter.toKatakana(romaji) || '　'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
