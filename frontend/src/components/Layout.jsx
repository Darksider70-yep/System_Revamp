import React from 'react';
import Navbar from './Navbar';
import { Box, Container } from '@mui/material';

const Layout = ({ children }) => {
    return (
        <Box sx={{ minHeight: '100vh' }}>
            <Navbar />
            <Container
                maxWidth="xl"
                sx={{
                    py: 3,
                    px: { xs: 2, md: 3 },
                }}
            >
                <main>{children}</main>
            </Container>
        </Box>
    );
};

export default Layout;
