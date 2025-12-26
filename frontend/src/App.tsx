import React from "react";
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider, App, theme } from "antd";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AdminLoginPage from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import VerifyWebApp from "./components/VerifyWebApp";

const { darkAlgorithm } = theme;

const MyApp: React.FC = () => (
  <StyleProvider hashPriority="high">
  <ConfigProvider
    theme={{
      algorithm: darkAlgorithm,
      //token: { colorPrimary: "#0088cc", borderRadius: 6 },
    }}
  >
    <App>
      <Router>
        <Routes>
          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboard  />} />

          {/* Telegram verification route */}
          <Route path="/verify" element={<VerifyWebApp />} />

          {/* Default redirect to login */}
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </Router>
    </App>
  </ConfigProvider>
  </StyleProvider>
);

export default MyApp;
