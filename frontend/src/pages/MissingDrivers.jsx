import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import MissingDrivers from '../components/MissingDrivers';
import { driverApi } from '../apiClient';

const normalizeMissing = (items) =>
    items.map((item) => ({
        ...item,
        Status: 'Missing',
        RiskScore: Number(item?.RiskScore || 0),
    }));

const MissingDriversPage = () => {
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [actionStatus, setActionStatus] = useState('');
    const [missing, setMissing] = useState([]);
    const [installed, setInstalled] = useState([]);
    const [riskSummary, setRiskSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0 });

    const loadDrivers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const payload = await driverApi.getDrivers();
            setMissing(normalizeMissing(payload.missingDrivers || []));
            setInstalled(payload.installedDrivers || []);
            setRiskSummary(payload.riskSummary || { critical: 0, high: 0, medium: 0, low: 0 });
        } catch (requestError) {
            setError(requestError.message || 'Failed to load driver intelligence.');
            setMissing([]);
            setInstalled([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDownloadDrivers = useCallback(async () => {
        setActionStatus('');
        setDownloading(true);
        try {
            const result = await driverApi.downloadDrivers();
            setActionStatus(
                result?.success
                    ? 'Driver update commands completed successfully.'
                    : 'Driver update commands executed, but one or more steps failed. Check backend logs.'
            );
            await loadDrivers();
        } catch (requestError) {
            setActionStatus(requestError.message || 'Driver download workflow failed.');
        } finally {
            setDownloading(false);
        }
    }, [loadDrivers]);

    useEffect(() => {
        loadDrivers();
    }, [loadDrivers]);

    return (
        <Box>
            <Typography variant="h4" sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1 }}>
                Driver Security
            </Typography>
            <Typography sx={{ color: '#94a3b8', mb: 2 }}>
                Data source: driver service (`GET /drivers`, `POST /drivers/download`).
            </Typography>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            {actionStatus ? <Alert severity="info" sx={{ mb: 2 }}>{actionStatus}</Alert> : null}
            {loading ? (
                <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress sx={{ color: '#38bdf8' }} />
                </Box>
            ) : (
                <MissingDrivers
                    missing={missing}
                    installed={installed}
                    riskSummary={riskSummary}
                    onDownloadDrivers={handleDownloadDrivers}
                    downloadingDrivers={downloading}
                />
            )}
        </Box>
    );
};

export default MissingDriversPage;
