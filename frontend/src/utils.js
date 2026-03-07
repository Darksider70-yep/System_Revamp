export const riskTone = (score) => {
    const v = Number(score || 0);
    if (v >= 85) return { label: 'Critical', color: '#ff5a67' };
    if (v >= 65) return { label: 'High', color: '#ff9852' };
    if (v >= 40) return { label: 'Medium', color: '#f5b642' };
    return { label: 'Low', color: '#34d399' };
};

export const formatTs = (value) => {
    const parsed = new Date(value || '');
    return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
};

export const formatTime = (value) => {
    const parsed = new Date(value || '');
    return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};