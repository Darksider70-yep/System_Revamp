import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import InstalledApps from './pages/InstalledApps';
import MissingDrivers from './pages/MissingDrivers';
import LiveSystemMonitor from './pages/LiveSystemMonitor';
import ProtectionCenter from './pages/ProtectionCenter';
import Login from './pages/Login';
import { authSession } from './apiClient';

const PrivateRoute = ({ component: Component, ...rest }) => {
    const authenticated = authSession.isAuthenticated();
    if (!authenticated) {
        authSession.clear();
    }

    return (
        <Route
            {...rest}
            render={(props) =>
                authenticated ? (
                    <Layout>
                        <Component {...props} />
                    </Layout>
                ) : (
                    <Redirect to="/login" />
                )
            }
        />
    );
};

function App() {
    return (
        <Router>
            <Switch>
                <Route
                    path="/login"
                    render={(props) =>
                        authSession.isAuthenticated() ? <Redirect to="/" /> : <Login {...props} />
                    }
                />
                <PrivateRoute exact path="/" component={Dashboard} />
                <PrivateRoute path="/installed-apps" component={InstalledApps} />
                <PrivateRoute path="/missing-drivers" component={MissingDrivers} />
                <PrivateRoute path="/live-system-monitor" component={LiveSystemMonitor} />
                <PrivateRoute path="/protection-center" component={ProtectionCenter} />
                <Route render={() => <Redirect to="/" />} />
            </Switch>
        </Router>
    );
}

export default App;
