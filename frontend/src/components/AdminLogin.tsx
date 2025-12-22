import React, { useState } from "react";
import {
  Layout,
  Form,
  Input,
  Button,
  Typography,
  Card,
  Space,
  message,
} from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Content } = Layout;
const { Title, Text } = Typography;

//const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };

const AdminLoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = (values: { username: string; password: string }) => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      if (
        values.username === import.meta.env.VITE_ADMIN_USERNAME &&
        values.password === import.meta.env.VITE_ADMIN_PASSWORD
      ) {
        message.success("Logged in successfully");
        navigate("/admin/dashboard");
      } else {
        message.error("Incorrect username or password");
      }
    }, 500);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Card
          style={{
            width: "100%",
            maxWidth: 420,
          }}
        >
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ textAlign: "center" }}>
              <Title level={3} style={{ marginBottom: 0 }}>
                Admin Login
              </Title>
              <Text type="secondary">
                Sign in to access the dashboard
              </Text>
            </div>

            <Form
              layout="vertical"
              name="adminLogin"
              onFinish={onFinish}
              autoComplete="off"
              size="large"
            >
              <Form.Item
                label="Username"
                name="username"
                rules={[
                  { required: true, message: "Please enter your username" },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="admin"
                />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: "Please enter your password" },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="••••••••"
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                >
                  Sign in
                </Button>
              </Form.Item>
            </Form>
          </Space>
        </Card>
      </Content>
    </Layout>
  );
};

export default AdminLoginPage;
