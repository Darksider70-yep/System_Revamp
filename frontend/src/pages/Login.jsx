import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, TextField, Typography } from '@mui/material';
import { authSession, cloudApi } from '../apiClient';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const history = useHistory();

    const handleLogin = async (event) => {
        event.preventDefault();
        if (submitting) {
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const payload = await cloudApi.login(username.trim(), password);
            authSession.save({
                accessToken: payload?.access_token,
                role: payload?.role,
                keyId: payload?.key_id,
                expiresInSeconds: payload?.expires_in,
            });
            history.push('/');
        } catch (requestError) {
            setError(requestError.message || 'Login failed. Please verify your credentials.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mt: 8,
                    borderRadius: 3,
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    background: 'linear-gradient(165deg, rgba(8, 15, 29, 0.98), rgba(10, 24, 45, 0.94))',
                    boxShadow: '0 20px 44px rgba(2, 6, 23, 0.48)',
                }}
            >
                <Typography component="h1" variant="h5" sx={{ color: '#e2e8f0', fontWeight: 800 }}>
                    Cloud Security Login
                </Typography>
                <Typography sx={{ color: '#94a3b8', mt: 1, fontSize: 13 }}>
                    Authenticate with Cloud Core to access fleet data.
                </Typography>
                <Box component="form" sx={{ width: '100%', mt: 2 }} noValidate onSubmit={handleLogin}>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        id="username"
                        label="Username"
                        name="username"
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={submitting}
                        sx={{
                            '& .MuiInputBase-root': { color: '#dbeafe' },
                            '& .MuiInputLabel-root': { color: '#94a3b8' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148, 163, 184, 0.35)' },
                        }}
                    />
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={submitting}
                        sx={{
                            '& .MuiInputBase-root': { color: '#dbeafe' },
                            '& .MuiInputLabel-root': { color: '#94a3b8' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148, 163, 184, 0.35)' },
                        }}
                    />
                    {error ? (
                        <Alert severity="error" sx={{ mt: 1.5 }}>
                            {error}
                        </Alert>
                    ) : null}
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        disabled={submitting || !username.trim() || !password}
                        sx={{
                            mt: 2,
                            py: 1.1,
                            fontWeight: 700,
                            background: 'linear-gradient(120deg, #0284c7, #2563eb)',
                            '&:hover': { background: 'linear-gradient(120deg, #0369a1, #1d4ed8)' },
                        }}
                    >
                        {submitting ? (
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={17} sx={{ color: '#e2e8f0' }} />
                                Signing in...
                            </Box>
                        ) : (
                            'Sign In'
                        )}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
};

export default Login;
