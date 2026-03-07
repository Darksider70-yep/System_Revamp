import React from 'react';
import { useHistory } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { AppBar, Box, Button, Chip, Toolbar, Typography } from '@mui/material';
import { authSession } from '../apiClient';

const Navbar = () => {
    const history = useHistory();
    const role = authSession.getRole() || 'analyst';

    const handleLogout = () => {
        authSession.clear();
        history.push('/login');
    };

    const activeStyle = {
        fontWeight: 'bold',
        color: '#7dd3fc',
    };

    return (
        <AppBar
            position="sticky"
            elevation={0}
            sx={{
                background: 'rgba(3, 10, 24, 0.92)',
                borderBottom: '1px solid rgba(125, 211, 252, 0.2)',
                backdropFilter: 'blur(10px)',
            }}
        >
            <Toolbar sx={{ gap: 1.5, alignItems: 'center', py: 1, flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, flexGrow: 1, color: '#e0f2fe', minWidth: 180 }}>
                    System Revamp
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button color="inherit" component={NavLink} exact to="/" activeStyle={activeStyle}>
                        Dashboard
                    </Button>
                    <Button color="inherit" component={NavLink} to="/installed-apps" activeStyle={activeStyle}>
                        Installed Apps
                    </Button>
                    <Button color="inherit" component={NavLink} to="/missing-drivers" activeStyle={activeStyle}>
                        Missing Drivers
                    </Button>
                    <Button color="inherit" component={NavLink} to="/live-system-monitor" activeStyle={activeStyle}>
                        Live Monitor
                    </Button>
                    <Button color="inherit" component={NavLink} to="/protection-center" activeStyle={activeStyle}>
                        Protection
                    </Button>
                </Box>
                <Chip
                    label={role.toUpperCase()}
                    size="small"
                    sx={{
                        fontWeight: 700,
                        background: 'rgba(14, 116, 144, 0.3)',
                        border: '1px solid rgba(125, 211, 252, 0.4)',
                        color: '#bae6fd',
                    }}
                />
                <Button
                    onClick={handleLogout}
                    variant="outlined"
                    sx={{
                        color: '#e2e8f0',
                        borderColor: 'rgba(148, 163, 184, 0.4)',
                        '&:hover': { borderColor: 'rgba(125, 211, 252, 0.7)' },
                    }}
                >
                    Logout
                </Button>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;
