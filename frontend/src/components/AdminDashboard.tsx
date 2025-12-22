import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  Layout,
  Menu,
  Typography,
  Button,
  Input,
  List,
  Avatar,
  Spin,
  Drawer,
  Modal,
  Form,
  message,
  Divider,
  Space,
  Popconfirm,
  Tag,
} from "antd";
import {
  TeamOutlined,
  LinkOutlined,
  SettingOutlined,
  LogoutOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const PAGE_SIZE = 20;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  user_name?: string;
  email?: string;
  created_at?: string;
}

type MenuKey = "users" | "invites" | "settings";

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMenu, setSelectedMenu] = useState<MenuKey>("users");
  const [collapsed, setCollapsed] = useState(false);

  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const [inviteLink, setInviteLink] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(false);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TelegramUser | null>(null);

  const [searchText, setSearchText] = useState("");

  // Add / Edit user modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // Pending users state
  const [pendingUsers, setPendingUsers] = useState<TelegramUser[]>([]);


  console.log(import.meta.env);
  const [form] = Form.useForm();

  const onLogout = () => navigate("/admin/login", { replace: true });

  // Fetch users with deduplication
  const fetchUsers = async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .order("created_at", { ascending: true });

      if (error) {
        message.error("Error fetching users: " + error.message);
      } else {
        if (!data || data.length < PAGE_SIZE) setHasMore(false);

        setUsers((prev) => {
          const combined = [...prev, ...(data || [])];
          const uniqueUsers = combined.filter(
            (user, index, self) =>
              self.findIndex((u) => u.id === user.id) === index
          );
          return uniqueUsers;
        });

        setPage((prev) => prev + 1);
      }
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending users
  const fetchPendingUsers = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    message.error("Failed to load invites");
    return [];
  }

  return data || [];
};

  const refreshUsers = () => {
    setUsers([]);
    setPage(0);
    setHasMore(true);
    fetchUsers();
  };

  useEffect(() => {
    if (selectedMenu === "users") fetchUsers();
    else if (selectedMenu === "invites") fetchPendingUsers().then(setPendingUsers);
  }, [selectedMenu]);

  const generateInvite = async () => {
    setLoadingInvite(true);
    try {
      const res = await axios.get(`${BACKEND}/generate-invite`);
      setInviteLink(res.data.invite);
      message.success("Invite generated");
    } catch (e: any) {
      message.error(e.message);
    }
    setLoadingInvite(false);
  };

  const openDrawer = (user: TelegramUser) => {
    setSelectedUser(user);
    setDrawerVisible(true);
  };
  const closeDrawer = () => {
    setDrawerVisible(false);
    setSelectedUser(null);
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) fetchUsers();
  };

  const filteredUsers = users.filter((user) => {
    const text = searchText.toLowerCase();
    return (
      user.first_name.toLowerCase().includes(text) ||
      (user.last_name?.toLowerCase().includes(text) ?? false) ||
      (user.user_name?.toLowerCase().includes(text) ?? false) ||
      (user.email?.toLowerCase().includes(text) ?? false)
    );
  });

/** Add / Edit user handler */
const handleAddUser = async (values: any) => {
  try {
    if (selectedUser) {
      // Editing an existing user
      const { error } = await supabase
        .from("users")
        .update(values)
        .eq("id", selectedUser.id);

      if (error) throw error;
      message.success("User updated successfully");
    } else {
      // Adding new user
      const { data, error } = await supabase.from("users").insert([values]);
      if (error) throw error;
      message.success("User added successfully");
    }

    setAddModalVisible(false);
    setDrawerVisible(false);
    setSelectedUser(null);
    form.resetFields();
    refreshUsers();
  } catch (err: any) {
    message.error(err.message);
  }
};

  /** Delete User handler */
  const handleDeleteUser = async (user: TelegramUser | null) => {
    if (!selectedUser && !user) return;
    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", selectedUser ? selectedUser.id : user!.id);
      if (error) throw error;
      message.success("User deleted successfully");
      setDeleteModalVisible(false);
      setDrawerVisible(false);
      refreshUsers();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Sidebar */}
      <Sider
        collapsible
        breakpoint="lg"
        collapsedWidth={80}
        theme="light"
        width={280}
        collapsed={collapsed}
        onCollapse={(val) => setCollapsed(val)}
        style={{
          padding: 16,
          //background: "linear-gradient(180deg, #1890ff 0%, #40a9ff 100%)",
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 20,
            marginBottom: 24,
            textShadow: "1px 1px 4px rgba(0,0,0,0.3)",
          }}
        >
          Admin Panel
        </div>

        {/* Sidebar Menu */}
        <Menu
          theme="light"
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedMenu]}
          onClick={(e) => setSelectedMenu(e.key as MenuKey)}
          items={[
            { key: "users", icon: <TeamOutlined />, label: "Users" },
            { key: "invites", icon: <LinkOutlined />, label: "Invites" },
            { key: "settings", icon: <SettingOutlined />, label: "Settings" },
          ]}
          style={{ borderRadius: 12, overflow: "hidden" }}
        />
      </Sider>

      {/* Main */}
      <Layout>
        <Header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            //background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingInline: 24,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Admin Dashboard
          </Title>
          <Button
            icon={<LogoutOutlined />}
            style={{ fontWeight: 600 }}
            onClick={onLogout}
          >
            Logout
          </Button>
        </Header>

        <Content
          style={{
            padding: 24,
            overflow: "auto",
            //background: "#f0f2f5",
          }}
          onScroll={onScroll}
        >
          {selectedMenu === "users" && (
            <>
              {/* Filter + Add User next to each other */}
              <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Input.Search
                  placeholder="Search by name, username, or email"
                  allowClear
                  enterButton
                  onSearch={(value) => setSearchText(value)}
                  style={{ flex: 1, minWidth: 200, borderRadius: 8 }}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddModalVisible(true)}
                >
                  Add User
                </Button>
                <Button onClick={() => setSearchText("")}>Clear</Button>
              </div>

              <List
                dataSource={filteredUsers}
                renderItem={(user) => (
                  <List.Item
                    key={user.id}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      marginBottom: 12,
                      borderRadius: 12,
                      //background: "#fff",
                      padding: 16,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                    }}
                    onClick={() => openDrawer(user)}
                  >
                    <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: "#1890ff" }}>{user.first_name[0]}</Avatar>}
                      title={user.user_name || user.first_name}
                      description={user.email}
                    />
                  </List.Item>
                )}
              />

              {loading && (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <Spin />
                </div>
              )}
            </>
          )}

          {selectedMenu === "invites" && (
            <>
              <Typography.Title level={3}>Pending Invites</Typography.Title>

              <List
                dataSource={pendingUsers}
                locale={{ emptyText: "No pending invites" }}
                renderItem={(user) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        title="Cancel invite?"
                        onConfirm={() => handleDeleteUser(user)}
                      >
                        <Button danger size="small">
                          Cancel
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={user.user_name || user.email || "Invited user"}
                      description={
                        <>
                          <Typography.Text type="secondary">
                            Invited on {dayjs(user.created_at).format("DD MMM YYYY")}
                          </Typography.Text>
                          <br />
                          <Tag color="gold">Pending</Tag>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}

        </Content>
      </Layout>

      {/* Drawer */}
      <Drawer
        title={selectedUser?.user_name || selectedUser?.first_name}
        placement="right"
        onClose={closeDrawer}
        visible={drawerVisible}
        width={360}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0 8px",
            }}
          >
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setDrawerVisible(false);
                setAddModalVisible(true);
                form.setFieldsValue(selectedUser);
              }}
            >
              Edit
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setDrawerVisible(false);
                setDeleteModalVisible(true);
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        {selectedUser && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Text>
              <b>Full Name:</b> {selectedUser.first_name}{" "}
              {selectedUser.last_name || ""}
            </Text>
            <Text>
              <b>Email:</b> {selectedUser.email || "—"}
            </Text>
            <Text>
              <b>User ID:</b> {selectedUser.id}
            </Text>
          </div>
        )}
      </Drawer>

      {/* Add/Edit User Modal */}
      <Modal
        open={addModalVisible}
        title={selectedUser ? "Edit User" : "Add User"}
        okText={selectedUser ? "Update User" : "Add User"}
        onCancel={() => {
          setAddModalVisible(false);
          setSelectedUser(null);
          setInviteLink("");
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddUser}
        >
          <Form.Item name="first_name" label="First name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="last_name" label="Last name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="user_name" label="Username">
            <Input />
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Please enter a valid email' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="user_id" label="ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          {/* INVITE SECTION */}
          {!selectedUser && (
            <>
              <Divider orientation="left">Invite via Telegram</Divider>

              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  icon={<LinkOutlined />}
                  loading={loadingInvite}
                  onClick={generateInvite}
                >
                  Generate Invite Link
                </Button>

                {inviteLink && (
                  <Input.TextArea
                    value={inviteLink}
                    readOnly
                    autoSize
                    onClick={(e) => {
                      navigator.clipboard.writeText(inviteLink);
                      message.success("Invite link copied");
                    }}
                  />
                )}
              </Space>
            </>
          )}
        </Form>
      </Modal>

      {/* Delete User Modal */}
      <Modal
        title="Delete User"
        open={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onOk={() => handleDeleteUser(null)}
        okButtonProps={{ danger: true }}
      >
        Are you sure you want to delete{" "}
        <b>{selectedUser?.user_name || selectedUser?.first_name}</b>?
      </Modal>
    </Layout>
  );
};

export default AdminDashboard;
