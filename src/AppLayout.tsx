import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';

const navItems = [
  { label: 'Home', icon: <HomeIcon />, path: '/' },
  { label: 'Library', icon: <LibraryMusicIcon />, path: '/library' },
  { label: 'Practice', icon: <PlayCircleIcon />, path: '/session-setup' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentNav = navItems.findIndex((item) => location.pathname === item.path);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">Hiyodori</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto' }}>{children}</Box>

      <Paper sx={{ position: 'sticky', bottom: 0 }} elevation={3}>
        <BottomNavigation
          value={currentNav}
          onChange={(_, newValue) => navigate(navItems[newValue].path)}
          showLabels
        >
          {navItems.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
