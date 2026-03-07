import React from 'react';
import { Card, CardContent, Typography, alpha } from '@mui/material';

const monoSx = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' };
const panelSx = {
    borderRadius: 4,
    border: '1px solid rgba(145,166,191,0.22)',
    background: 'linear-gradient(160deg, rgba(9,16,28,.94) 0%, rgba(7,12,21,.95) 100%)',
    boxShadow: '0 14px 40px rgba(0,0,0,.32)',
    backdropFilter: 'blur(10px)',
};

const StatCard = ({ title, value, hint, tone }) => (
    <Card sx={{ ...panelSx, borderColor: alpha(tone, 0.36), ':hover': { transform: 'translateY(-2px)' }, transition: 'all .2s ease' }}>
        <CardContent sx={{ py: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#8fa4c1' }}>
                {title}
            </Typography>
            <Typography variant="h4" sx={{ ...monoSx, color: '#edf4ff', mt: 0.3 }}>
                {value}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8fa4c1' }}>
                {hint}
            </Typography>
        </CardContent>
    </Card>
);

export default StatCard;