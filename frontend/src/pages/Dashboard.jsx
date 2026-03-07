import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    Grid,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import StatCard from '../components/StatCard';
import Risk3DPanel from '../components/Risk3DPanel';
import { cloudApi } from '../apiClient';
import { CLOUD_WS_ENDPOINTS } from '../apiConfig';
import { formatTs, formatTime, riskTone } from '../utils';

const MAX_FEED_ITEMS = 8;

const initClusters = { critical: 0, high: 0, medium: 0, low: 0 };

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [error, setError] = useState('');
    const [actionStatus, setActionStatus] = useState('');
    const [overview, setOverview] = useState(null);
    const [machines, setMachines] = useState([]);
    const [groups, setGroups] = useState([]);
    const [heatmap, setHeatmap] = useState({ clusters: initClusters, points: [] });
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [machineDetail, setMachineDetail] = useState(null);
    const [riskData, setRiskData] = useState(null);
    const [predictionData, setPredictionData] = useState(null);
    const [vulnerabilities, setVulnerabilities] = useState([]);
    const [events, setEvents] = useState([]);
    const [patchItems, setPatchItems] = useState([]);
    const [liveFeed, setLiveFeed] = useState([]);
    const [alertFeed, setAlertFeed] = useState([]);
    const refreshTimerRef = useRef(null);

    const appendLiveEvent = useCallback((setter, payload) => {
        setter((current) => {
            const next = [payload, ...current];
            return next.slice(0, MAX_FEED_ITEMS);
        });
    }, []);

    const loadPrimary = useCallback(async () => {
        const [overviewPayload, machinesPayload, heatmapPayload, groupsPayload] = await Promise.all([
            cloudApi.getOverview(),
            cloudApi.getMachines(),
            cloudApi.getHeatmap(),
            cloudApi.getGroups(),
        ]);

        setOverview(overviewPayload || null);
        setMachines(Array.isArray(machinesPayload?.items) ? machinesPayload.items : []);
        setHeatmap({
            clusters: heatmapPayload?.clusters || initClusters,
            points: Array.isArray(heatmapPayload?.points) ? heatmapPayload.points : [],
        });
        setGroups(Array.isArray(groupsPayload?.items) ? groupsPayload.items : []);

        const firstMachineId = machinesPayload?.items?.[0]?.id || '';
        setSelectedMachineId((current) => current || firstMachineId);
        return firstMachineId;
    }, []);

    const loadMachineDetails = useCallback(async (machineId) => {
        if (!machineId) {
            setMachineDetail(null);
            setRiskData(null);
            setPredictionData(null);
            setVulnerabilities([]);
            setEvents([]);
            setPatchItems([]);
            return;
        }

        setLoadingDetails(true);
        const results = await Promise.allSettled([
            cloudApi.getMachineDetails(machineId),
            cloudApi.getRiskScore(machineId),
            cloudApi.getRiskPrediction(machineId),
            cloudApi.getVulnerabilities(machineId),
            cloudApi.getEvents(machineId),
            cloudApi.getPatchStatus(machineId),
        ]);

        const [machineDetailRes, riskRes, predictionRes, vulnRes, eventsRes, patchRes] = results;

        setMachineDetail(machineDetailRes.status === 'fulfilled' ? machineDetailRes.value : null);
        setRiskData(riskRes.status === 'fulfilled' ? riskRes.value : null);
        setPredictionData(predictionRes.status === 'fulfilled' ? predictionRes.value : null);
        setVulnerabilities(vulnRes.status === 'fulfilled' ? vulnRes.value?.findings || [] : []);
        setEvents(eventsRes.status === 'fulfilled' ? eventsRes.value?.events || [] : []);
        setPatchItems(patchRes.status === 'fulfilled' ? patchRes.value?.items || [] : []);
        setLoadingDetails(false);
    }, []);

    const refreshAll = useCallback(async () => {
        setError('');
        try {
            const fallbackMachineId = await loadPrimary();
            const targetMachine = selectedMachineId || fallbackMachineId;
            if (targetMachine) {
                await loadMachineDetails(targetMachine);
            }
        } catch (requestError) {
            setError(requestError.message || 'Failed to load cloud dashboard data.');
        } finally {
            setLoading(false);
        }
    }, [loadMachineDetails, loadPrimary, selectedMachineId]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    useEffect(() => {
        if (!selectedMachineId) {
            return;
        }
        loadMachineDetails(selectedMachineId).catch((requestError) => {
            setError(requestError.message || 'Failed to load selected machine details.');
        });
    }, [loadMachineDetails, selectedMachineId]);

    const scheduleRefresh = useCallback(() => {
        if (refreshTimerRef.current) {
            return;
        }
        refreshTimerRef.current = setTimeout(async () => {
            refreshTimerRef.current = null;
            await refreshAll();
        }, 1300);
    }, [refreshAll]);

    useEffect(() => {
        const liveSocket = new WebSocket(CLOUD_WS_ENDPOINTS.liveMachines);
        const alertSocket = new WebSocket(CLOUD_WS_ENDPOINTS.alerts);

        liveSocket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload?.type && payload.type !== 'connected') {
                    appendLiveEvent(setLiveFeed, payload);
                    scheduleRefresh();
                }
            } catch {
                // ignore malformed messages
            }
        };

        alertSocket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload?.type && payload.type !== 'connected') {
                    appendLiveEvent(setAlertFeed, payload);
                    scheduleRefresh();
                }
            } catch {
                // ignore malformed messages
            }
        };

        return () => {
            liveSocket.close();
            alertSocket.close();
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [appendLiveEvent, scheduleRefresh]);

    const handleQueueScan = useCallback(async () => {
        if (!selectedMachineId) {
            return;
        }
        setActionStatus('');
        try {
            await cloudApi.queueMachineScan(selectedMachineId, true);
            setActionStatus('Manual scan command queued.');
            await refreshAll();
        } catch (requestError) {
            setActionStatus(requestError.message || 'Unable to queue scan command.');
        }
    }, [refreshAll, selectedMachineId]);

    const handleQueuePatch = useCallback(async () => {
        if (!selectedMachineId) {
            return;
        }
        setActionStatus('');
        try {
            await cloudApi.queueMachinePatch(selectedMachineId, { patch_all: true });
            setActionStatus('Patch-all command queued.');
            await refreshAll();
        } catch (requestError) {
            setActionStatus(requestError.message || 'Unable to queue patch command.');
        }
    }, [refreshAll, selectedMachineId]);

    const selectedMachine = useMemo(
        () => machines.find((item) => String(item.id) === String(selectedMachineId)) || null,
        [machines, selectedMachineId]
    );

    const riskScore = Number(riskData?.risk_score ?? machineDetail?.risk_score ?? 0);
    const prediction = Number(predictionData?.risk_prediction ?? 0);

    const topStats = [
        { title: 'Fleet Size', value: overview?.total_machines ?? machines.length, hint: 'registered endpoints', tone: '#31c7d5' },
        { title: 'Machines Online', value: overview?.machines_online ?? 0, hint: 'active in window', tone: '#2fbf71' },
        { title: 'Vulnerabilities', value: overview?.total_vulnerabilities ?? 0, hint: 'open findings', tone: '#f5b642' },
        {
            title: 'Average Risk',
            value: Number(overview?.average_risk_score ?? 0).toFixed(1),
            hint: 'fleet weighted',
            tone: riskTone(overview?.average_risk_score ?? 0).color,
        },
    ];

    if (loading) {
        return (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: '#38bdf8' }} />
            </Box>
        );
    }

    return (
        <Box sx={{ flexGrow: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h4" sx={{ color: '#e2e8f0', fontWeight: 800 }}>
                        Cloud Security Dashboard
                    </Typography>
                    <Typography sx={{ color: '#94a3b8' }}>
                        Cloud Core overview with live machine and alert websockets.
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    onClick={refreshAll}
                    sx={{ color: '#bae6fd', borderColor: 'rgba(56, 189, 248, 0.45)', '&:hover': { borderColor: '#38bdf8' } }}
                >
                    Refresh
                </Button>
            </Stack>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}

            {actionStatus ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    {actionStatus}
                </Alert>
            ) : null}

            <Grid container spacing={3}>
                {topStats.map((s) => (
                    <Grid item xs={12} sm={6} md={3} key={s.title}>
                        <StatCard title={s.title} value={s.value} hint={s.hint} tone={s.tone} />
                    </Grid>
                ))}
                <Grid item xs={12} md={6}>
                    <Risk3DPanel
                        riskScore={riskScore}
                        prediction={prediction}
                        level={predictionData?.risk_level || riskTone(riskScore).label}
                        modelState={predictionData?.model || predictionData?.model_state || 'n/a'}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2.4, display: 'flex', flexDirection: 'column', gap: 1.2, height: '100%', background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)', borderRadius: 3 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                            <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 800 }}>
                                Machine Focus
                            </Typography>
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel sx={{ color: '#93c5fd' }}>Selected Machine</InputLabel>
                                <Select
                                    label="Selected Machine"
                                    value={selectedMachineId}
                                    onChange={(event) => setSelectedMachineId(event.target.value)}
                                    sx={{ color: '#dbeafe' }}
                                >
                                    {machines.map((machine) => (
                                        <MenuItem key={machine.id} value={machine.id}>
                                            {machine.hostname} ({machine.os})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={handleQueueScan} disabled={!selectedMachineId}>
                                Queue Scan
                            </Button>
                            <Button size="small" onClick={handleQueuePatch} disabled={!selectedMachineId}>
                                Queue Patch
                            </Button>
                        </Stack>
                        {loadingDetails ? <CircularProgress size={20} sx={{ color: '#38bdf8', my: 1 }} /> : null}
                        <Typography sx={{ color: '#cbd5e1' }}>Hostname: {selectedMachine?.hostname || machineDetail?.hostname || 'N/A'}</Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>OS: {selectedMachine?.os || machineDetail?.os || 'N/A'}</Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>
                            Last Scan: {machineDetail?.last_scan ? formatTs(machineDetail.last_scan) : 'N/A'}
                        </Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>
                            Model: {predictionData?.model || 'RandomForestClassifier'} ({predictionData?.model_state || 'trained'})
                        </Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>Training Rows: {predictionData?.training_rows ?? 0}</Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>Lookback Days: {predictionData?.lookback_days ?? 0}</Typography>
                        <Divider sx={{ borderColor: 'rgba(56, 189, 248, 0.22)', my: 0.5 }} />
                        <Typography sx={{ color: '#cbd5e1' }}>Outdated Apps: {riskData?.breakdown?.outdated_apps ?? 0}</Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>Missing Drivers: {riskData?.breakdown?.missing_drivers ?? 0}</Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>Security Events: {riskData?.breakdown?.security_events ?? 0}</Typography>
                        <Typography sx={{ color: '#cbd5e1' }}>CPU Spikes: {riskData?.breakdown?.cpu_spikes ?? 0}</Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 3, background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)' }}>
                        <CardContent>
                            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1.2 }}>Vulnerability Intelligence</Typography>
                            {vulnerabilities.length === 0 ? (
                                <Typography sx={{ color: '#94a3b8' }}>No vulnerability intelligence available for selected machine.</Typography>
                            ) : (
                                <List dense sx={{ maxHeight: 240, overflowY: 'auto' }}>
                                    {vulnerabilities.slice(0, 6).map((item, index) => (
                                        <ListItem key={`${item.cve}-${index}`} disableGutters>
                                            <ListItemText
                                                primary={`${item.cve} - ${item.software}`}
                                                secondary={`${item.severity}${item.cvss_score ? ` (CVSS ${item.cvss_score})` : ''}`}
                                                primaryTypographyProps={{ sx: { color: '#dbeafe', fontWeight: 700, fontSize: 13 } }}
                                                secondaryTypographyProps={{ sx: { color: '#94a3b8' } }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 3, background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)' }}>
                        <CardContent>
                            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1.2 }}>Recent Security Events</Typography>
                            {events.length === 0 ? (
                                <Typography sx={{ color: '#94a3b8' }}>No security events recorded for this machine.</Typography>
                            ) : (
                                <List dense sx={{ maxHeight: 240, overflowY: 'auto' }}>
                                    {events.slice(-8).reverse().map((item, index) => (
                                        <ListItem key={`${item.event_type}-${item.timestamp}-${index}`} disableGutters>
                                            <ListItemText
                                                primary={`${item.event_type} (${item.risk_level})`}
                                                secondary={formatTime(item.timestamp)}
                                                primaryTypographyProps={{ sx: { color: '#dbeafe', fontWeight: 700, fontSize: 13 } }}
                                                secondaryTypographyProps={{ sx: { color: '#94a3b8' } }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ borderRadius: 3, background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)' }}>
                        <CardContent>
                            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1.2 }}>Fleet Heatmap</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip label={`Critical: ${heatmap.clusters.critical || 0}`} color="error" size="small" />
                                <Chip label={`High: ${heatmap.clusters.high || 0}`} color="warning" size="small" />
                                <Chip label={`Medium: ${heatmap.clusters.medium || 0}`} size="small" />
                                <Chip label={`Low: ${heatmap.clusters.low || 0}`} color="success" size="small" />
                            </Stack>
                            <Typography sx={{ color: '#94a3b8', mt: 1 }}>
                                Heatmap points tracked: {heatmap.points.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ borderRadius: 3, background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)' }}>
                        <CardContent>
                            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1.2 }}>Fleet Groups</Typography>
                            {groups.length === 0 ? (
                                <Typography sx={{ color: '#94a3b8' }}>No groups configured.</Typography>
                            ) : (
                                <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {groups.map((group) => (
                                        <ListItem key={group.id} disableGutters>
                                            <ListItemText
                                                primary={group.name}
                                                secondary={`${group.machine_count} machines`}
                                                primaryTypographyProps={{ sx: { color: '#dbeafe', fontWeight: 700, fontSize: 13 } }}
                                                secondaryTypographyProps={{ sx: { color: '#94a3b8' } }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ borderRadius: 3, background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)' }}>
                        <CardContent>
                            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1.2 }}>Patch Status</Typography>
                            {patchItems.length === 0 ? (
                                <Typography sx={{ color: '#94a3b8' }}>No patch command history available.</Typography>
                            ) : (
                                <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {patchItems.slice(0, 6).map((item, index) => (
                                        <ListItem key={`${item.command_id || item.timestamp}-${index}`} disableGutters>
                                            <ListItemText
                                                primary={`${item.software} - ${item.status}`}
                                                secondary={`${item.provider} | ${formatTime(item.timestamp)}`}
                                                primaryTypographyProps={{ sx: { color: '#dbeafe', fontWeight: 700, fontSize: 13 } }}
                                                secondaryTypographyProps={{ sx: { color: '#94a3b8' } }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 3, background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)' }}>
                        <CardContent>
                            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1.2 }}>Live Machine Feed</Typography>
                            {liveFeed.length === 0 ? (
                                <Typography sx={{ color: '#94a3b8' }}>Waiting for live machine updates.</Typography>
                            ) : (
                                <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {liveFeed.map((item, index) => (
                                        <ListItem key={`${item.type}-${item.timestamp}-${index}`} disableGutters>
                                            <ListItemText
                                                primary={`${item.type} - ${item.hostname || item.machine_id || ''}`}
                                                secondary={item.timestamp ? formatTs(item.timestamp) : 'Live update'}
                                                primaryTypographyProps={{ sx: { color: '#dbeafe', fontWeight: 700, fontSize: 13 } }}
                                                secondaryTypographyProps={{ sx: { color: '#94a3b8' } }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 3, background: 'rgba(8,14,24,.72)', border: '1px solid rgba(145,166,191,.22)' }}>
                        <CardContent>
                            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, mb: 1.2 }}>Alert Feed</Typography>
                            {alertFeed.length === 0 ? (
                                <Typography sx={{ color: '#94a3b8' }}>Waiting for security alerts.</Typography>
                            ) : (
                                <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {alertFeed.map((item, index) => (
                                        <ListItem key={`${item.type}-${item.timestamp}-${index}`} disableGutters>
                                            <ListItemText
                                                primary={item.message || item.type}
                                                secondary={item.timestamp ? formatTs(item.timestamp) : 'Live alert'}
                                                primaryTypographyProps={{ sx: { color: '#dbeafe', fontWeight: 700, fontSize: 13 } }}
                                                secondaryTypographyProps={{ sx: { color: '#94a3b8' } }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
