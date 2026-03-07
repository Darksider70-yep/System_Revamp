import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import LiveSystemMonitor from '../components/LiveSystemMonitor';
import { monitorApi } from '../apiClient';
import { MONITOR_WS_ENDPOINTS } from '../apiConfig';

const defaultMetrics = {
    cpu_usage: 0,
    ram_usage: 0,
    disk_usage: 0,
    network_activity: 'low',
};

const defaultSystemInfo = {
    hostname: 'Unknown',
    os_version: 'Unknown',
    cpu: 'Unknown',
    gpu: 'Unavailable',
    ram_gb: 0,
    disk_total_gb: 0,
    disk_free_gb: 0,
};

const LiveSystemMonitorPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [socketStatus, setSocketStatus] = useState('disconnected');
    const [metrics, setMetrics] = useState(defaultMetrics);
    const [riskScore, setRiskScore] = useState(0);
    const [alerts, setAlerts] = useState([]);
    const [systemInfo, setSystemInfo] = useState(defaultSystemInfo);
    const socketRef = useRef(null);

    const loadSnapshot = useCallback(async () => {
        setError('');
        try {
            const [systemInfoPayload, metricsPayload, eventsPayload] = await Promise.all([
                monitorApi.getSystemInfo(),
                monitorApi.getSystemMetrics(),
                monitorApi.getSecurityEvents(),
            ]);
            setSystemInfo(systemInfoPayload || defaultSystemInfo);
            setMetrics(metricsPayload || defaultMetrics);
            setAlerts(Array.isArray(eventsPayload?.events) ? eventsPayload.events : []);
            setRiskScore(Number(eventsPayload?.riskScore || 0));
        } catch (requestError) {
            setError(requestError.message || 'Failed to load monitor snapshots.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSnapshot();
    }, [loadSnapshot]);

    useEffect(() => {
        let isAlive = true;
        const socket = new WebSocket(MONITOR_WS_ENDPOINTS.liveMonitor);
        socketRef.current = socket;

        socket.onopen = () => {
            if (!isAlive) {
                return;
            }
            setSocketStatus('connected');
        };

        socket.onmessage = (event) => {
            if (!isAlive) {
                return;
            }
            try {
                const payload = JSON.parse(event.data);
                setMetrics((current) => ({
                    ...current,
                    cpu_usage: Number(payload.cpu ?? current.cpu_usage),
                    ram_usage: Number(payload.ram ?? current.ram_usage),
                    disk_usage: Number(payload.disk ?? current.disk_usage),
                    network_activity: String(payload.networkActivity || current.network_activity || 'low'),
                }));
                setRiskScore(Number(payload.riskScore || 0));
                setAlerts(Array.isArray(payload.securityAlerts) ? payload.securityAlerts : []);
            } catch {
                // Ignore malformed live monitor packets.
            }
        };

        socket.onerror = () => {
            if (isAlive) {
                setSocketStatus('error');
            }
        };

        socket.onclose = () => {
            if (isAlive) {
                setSocketStatus('disconnected');
            }
        };

        return () => {
            isAlive = false;
            socket.close();
        };
    }, []);

    return (
        <Box>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.2}>
                <Box>
                    <Typography variant="h4" sx={{ color: '#e2e8f0', fontWeight: 800 }}>
                        Live System Monitor
                    </Typography>
                    <Typography sx={{ color: '#94a3b8' }}>
                        Monitor service telemetry + WebSocket stream.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ color: socketStatus === 'connected' ? '#34d399' : '#f59e0b', fontWeight: 700, fontSize: 13 }}>
                        WS: {socketStatus}
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={loadSnapshot}
                        sx={{
                            color: '#bae6fd',
                            borderColor: 'rgba(56, 189, 248, 0.45)',
                            '&:hover': { borderColor: '#38bdf8' },
                        }}
                    >
                        Refresh Snapshot
                    </Button>
                </Box>
            </Stack>

            {error ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            ) : null}

            {loading ? (
                <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress sx={{ color: '#38bdf8' }} />
                </Box>
            ) : (
                <LiveSystemMonitor metrics={metrics} riskScore={riskScore} alerts={alerts} systemInfo={systemInfo} />
            )}
        </Box>
    );
};

export default LiveSystemMonitorPage;
