import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import ProtectionCenter from '../components/ProtectionCenter';
import { protectionApi } from '../apiClient';
import { formatTs } from '../utils';

const emptySummary = {
    malicious: 0,
    suspicious: 0,
    clean: 0,
    unknown: 0,
    error: 0,
};

const ProtectionCenterPage = () => {
    const [results, setResults] = useState([]);
    const [summary, setSummary] = useState(emptySummary);
    const [scanning, setScanning] = useState(false);
    const [serviceUnavailable, setServiceUnavailable] = useState(false);
    const [lastScanTime, setLastScanTime] = useState('');
    const [error, setError] = useState('');

    const runScan = useCallback(async () => {
        setScanning(true);
        setError('');
        try {
            const payload = await protectionApi.scan({ maxApps: 20 });
            setServiceUnavailable(false);
            setResults(Array.isArray(payload?.results) ? payload.results : []);
            setSummary(payload?.summary || emptySummary);
            setLastScanTime(new Date().toISOString());
        } catch (requestError) {
            const message = requestError?.message || 'Protection service request failed.';
            setError(message);
            setServiceUnavailable(true);
            setResults([]);
            setSummary(emptySummary);
        } finally {
            setScanning(false);
        }
    }, []);

    useEffect(() => {
        runScan();
    }, [runScan]);

    return (
        <Box>
            <Typography variant="h4" sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1 }}>
                Protection Center
            </Typography>
            <Typography sx={{ color: '#94a3b8', mb: 2 }}>
                Endpoint uses `POST /protection/scan` (configurable protection service).
            </Typography>
            {serviceUnavailable ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Protection service is unavailable or not deployed in this environment. Configure `REACT_APP_PROTECTION_API_URL` when service is running.
                </Alert>
            ) : null}
            {error && !serviceUnavailable ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}
            <ProtectionCenter
                results={results}
                summary={summary}
                scanning={scanning}
                onScan={runScan}
                lastScanTime={lastScanTime ? formatTs(lastScanTime) : null}
            />
        </Box>
    );
};

export default ProtectionCenterPage;
