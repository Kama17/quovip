import React from 'react';
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider, App, theme } from 'antd';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import AdminLoginPage from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import VerifyWebApp from './components/VerifyWebApp';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

const { darkAlgorithm } = theme;

const MyApp: React.FC = () => (
  <StyleProvider hashPriority="high">
    <ConfigProvider theme={{ algorithm: darkAlgorithm }}>
      <App>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/admin/login" element={<AdminLoginPage />} />

              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              <Route path="/verify" element={<VerifyWebApp />} />

              <Route path="*" element={<Navigate to="/admin/login" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </App>
    </ConfigProvider>
  </StyleProvider>
);

export default MyApp;
