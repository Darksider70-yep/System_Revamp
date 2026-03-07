import React, { useRef } from 'react';
import { Box, Chip, Stack, Typography, alpha } from '@mui/material';
import { Canvas, useFrame } from '@react-three/fiber';
import { riskTone } from '../utils';

function RiskOrbMesh({ score, prediction }) {
    const core = useRef(null);
    const shell = useRef(null);
    const ring = useRef(null);
    const accent = riskTone(Math.max(score, prediction * 100)).color;
    const intensity = Math.min(1.6, Math.max(0.2, score / 100 + prediction * 0.7));
    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (core.current) {
            core.current.rotation.x = t * 0.26;
            core.current.rotation.y = t * 0.42;
            core.current.scale.setScalar(1 + Math.sin(t * 2.3) * 0.05 * intensity);
        }
        if (shell.current) shell.current.rotation.y = -t * 0.2;
        if (ring.current) {
            ring.current.rotation.z = t * 0.5;
            ring.current.rotation.x = Math.PI / 2.8 + Math.sin(t * 1.2) * 0.15;
        }
    });
    return (
        <group>
            <mesh ref={core}>
                <icosahedronGeometry args={[1.0, 2]} />
                <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.2 + intensity * 0.22} metalness={0.64} roughness={0.2} />
            </mesh>
            <mesh ref={shell}>
                <icosahedronGeometry args={[1.33, 1]} />
                <meshBasicMaterial color={accent} wireframe transparent opacity={0.35} />
            </mesh>
            <mesh ref={ring} rotation={[Math.PI / 2.8, 0, 0]}>
                <torusGeometry args={[1.8, 0.034, 18, 100]} />
                <meshStandardMaterial color="#7cdff5" emissive="#7cdff5" emissiveIntensity={0.24} metalness={0.7} roughness={0.24} />
            </mesh>
        </group>
    );
}

const Risk3DPanel = ({ riskScore, prediction, level, modelState }) => (
    <Box sx={{ borderRadius: 3, border: '1px solid rgba(145,166,191,0.22)', p: 1, background: 'rgba(8,14,24,.72)' }}>
        <Box sx={{ height: 220, borderRadius: 3, overflow: 'hidden' }}>
            <Canvas camera={{ position: [0, 0, 4], fov: 50 }} dpr={[1, 2]}>
                <color attach="background" args={['#07101d']} />
                <ambientLight intensity={0.45} />
                <pointLight position={[2.3, 2.2, 2.5]} intensity={1.3} color="#8ce9ff" />
                <pointLight position={[-2.2, -2.1, -2]} intensity={0.9} color={riskTone(riskScore).color} />
                <RiskOrbMesh score={riskScore} prediction={prediction} />
            </Canvas>
        </Box>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
            <Typography sx={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace', color: '#eff6ff' }}>
                Risk {riskScore}
            </Typography>
            <Typography sx={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace', color: '#eff6ff' }}>
                Forecast {Math.round(prediction * 100)}%
            </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" sx={{ backgroundColor: alpha(riskTone(riskScore).color, 0.2), color: riskTone(riskScore).color }} label={level || riskTone(riskScore).label} />
            <Chip size="small" sx={{ backgroundColor: alpha('#31c7d5', 0.2), color: '#97f0ff' }} label={modelState || 'n/a'} />
        </Stack>
    </Box>
);

export default Risk3DPanel;