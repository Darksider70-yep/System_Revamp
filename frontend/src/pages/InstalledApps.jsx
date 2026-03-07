import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import InstalledAppsTable from '../components/InstalledAppsTable';
import { scannerApi, versionApi } from '../apiClient';

const toInstalledMap = (apps) =>
    apps.reduce((accumulator, item) => {
        const name = String(item?.name || '').trim();
        const version = String(item?.version || 'Unknown').trim() || 'Unknown';
        if (name) {
            accumulator[name] = version;
        }
        return accumulator;
    }, {});

const InstalledApps = () => {
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadApps = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const scannedApps = await scannerApi.scan();
            const payload = toInstalledMap(scannedApps);
            const versioned = Object.keys(payload).length > 0 ? await versionApi.checkVersions(payload) : [];
            setApps(versioned);
        } catch (requestError) {
            setError(requestError.message || 'Failed to load installed applications.');
            setApps([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSimulateAttack = useCallback(async (row) => {
        return scannerApi.simulateAttack({
            software: row?.name || 'Unknown Software',
            current: row?.current,
            latest: row?.latest,
            riskLevel: row?.riskLevel,
        });
    }, []);

    useEffect(() => {
        loadApps();
    }, [loadApps]);

    return (
        <Box>
            <Typography sx={{ color: '#94a3b8', mb: 1.5 }}>
                Data source: scanner service + version intelligence service.
            </Typography>
            {error ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}
            <InstalledAppsTable
                data={apps}
                loading={loading}
                error=""
                onRefresh={loadApps}
                onSimulateAttack={handleSimulateAttack}
            />
        </Box>
    );
};

export default InstalledApps;
