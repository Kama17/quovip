import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  Layout,
  Typography,
  Button,
  Input,
  List,
  Avatar,
  Spin,
  Drawer,
  Modal,
  Form,
  Select,
  message,
  Divider,
  Space,
  Popconfirm,
  Tag,
  FloatButton,
} from "antd";
import {
  TeamOutlined,
  LinkOutlined,
  LogoutOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
  SendOutlined,
  RobotOutlined,
  UserAddOutlined,
  CloseOutlined,
  MoreOutlined,
  WechatOutlined,
  QuestionCircleOutlined,
  AuditOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
//import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const { Content } = Layout;
const { Text } = Typography;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const PAGE_SIZE = 20;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY!;
const ADMIN_JWT_TOKEN = import.meta.env.VITE_ADMIN_JWT_TOKEN || "";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

type UserChatInfo = {
  chat_id: string;
  chat_name: string;
  is_member_active: "active" | "pending";
};

interface TelegramUser {
  id: number;
  user_id?: string;
  first_name: string;
  last_name?: string;
  user_name?: string;
  status?: string;
  email?: string;
  telegram_id?: string;
  created_at?: string;
  is_member_active?: string;
  chats?: UserChatInfo[]; // 👈 joined chats
}


type MenuKey = "users" | "invites" | "bot";

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMenu, setSelectedMenu] = useState<MenuKey>("users");

  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const [inviteLink, setInviteLink] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(false);

  const [drawerUserVisible, setDrawerUserVisible] = useState(false);
  const [drawerChatVisible, setDrawerChatVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TelegramUser | null>(null);

  const [searchText, setSearchText] = useState("");

  // Add / Edit user modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // Pending users state
  const [pendingUsers, setPendingUsers] = useState<TelegramUser[]>([]);

  // Selected chat for user addition
  const [selectedChatId, setSelectedChatId] = useState<string>("all");

  const [inviteChatIds, setInviteChatIds] = useState<string[]>([]);

  // Form instance for Add/Edit User
  const [form] = Form.useForm();

  // Select component Option for chat names
  //const { Option } = Select;

  const [loadingBotChats, setLoadingBotChats] = useState(false);
  const [botChats, setBotChats] = useState<any[]>([]);

  const onLogout = () => {
    navigate("/admin/login", { replace: true })};

  // Separate chats into member and non-member based on selected user
  const memberChatIds = new Set(
  selectedUser?.chats?.map(c => c.chat_id)
  );

  // Chats where the user is a member vs not a member
  const memberChats = botChats.filter(c => memberChatIds.has(c.chat_id));
  const nonMemberChats = botChats.filter(c => !memberChatIds.has(c.chat_id));

  // Fetch users with deduplication
  const fetchUsers = async () => {

    // TODO: need to implemnt it here
    //  if (loading || !hasMore) return;
    hasMore; 

    if (loading ) return;
    setLoading(true);
    console.log("Fetching users, page:", page);
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

  const fetchUserChats = async (userId: number) => {
    const { data, error } = await supabase
      .from("chat_members")
      .select(`
        chat_id,
        is_member_active,
        bot_chats (
          chat_id,
          chat_name
        )
      `)
      .eq("user_id", userId);

    if (error) {
      message.error("Failed to fetch user chats");
      return [];
    }

    // Flatten the nested structure to match UserChatInfo type
    const flattened = (data ?? []).map((item: any) => ({
      chat_id: item.chat_id,
      chat_name: item.bot_chats?.[0]?.chat_name || "",
      is_member_active: item.is_member_active,
    }));

    return flattened;
  };


  // Fetch users for selected chat
const fetchChatMembers = async (chatId: string) => {
   const { data, error } = await supabase
    .from("chat_members")
    .select(`
      is_member_active,
      user_id,
      users (
        id,
        first_name,
        last_name,
        user_name,
        telegram_id,
        email,
        status,
        created_at
      )
    `)
    .eq("chat_id", chatId);

  if (error) {
    message.error(error.message);
    return [];
  }

  console.log("Fetched chat members data:", data);
  // Flatten the structure so each user object contains is_member_active
  const usersWithStatus = (data || []).map((item: any) => ({
    ...item.users,
    is_member_active: item.is_member_active,
  }));

  setUsers(usersWithStatus);
  };


  // Fetch chat members when selected chat changes
  useEffect(() => {
    console.log("Selected chat ID changed:", selectedChatId);
    if (selectedChatId === 'all') fetchUsers();
    else fetchChatMembers(selectedChatId);
  }, [selectedChatId]);

  // Fetch pending users
  const fetchPendingUsers = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .in("status", ["pending"]) // Adjust the condition as needed
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

  // Fetch bot chats
  const fetchBotChats = async () => {
    setLoadingBotChats(true);
    try {
      const { data, error } = await supabase
        .from("bot_chats") // table containing chat info
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBotChats(data || []);
    } catch (err: any) {
      message.error("Failed to load bot chats: " + err.message);
    } finally {
      setLoadingBotChats(false);
    }
  };

  // Invite user to chat
  const inviteUserToChat = async (chatId: string, userId: string) => {
    console.log("env variables:", BACKEND_URL, ADMIN_JWT_TOKEN);
    console.log(`Inviting user ${userId} to chat ${chatId}`);
    const res = await fetch(`https://${BACKEND_URL}/api/chats/sent-invitation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ADMIN_JWT_TOKEN}`
      },
      body: JSON.stringify({ chat_id: chatId, telegram_user_id: userId})

      
    });

    if (!res.ok) {
      const error = await res.json();
      console.log("Failed to invite user:", error);
      throw new Error(error.detail || "Failed to invite user");
    }

    const data = await res.json();
    if(!data.ok) {
      message.error("Failed to invite user: " + data.message);
      setInviteChatIds([]);
    } else {
      message.success("Invitation sent successfully");
    }
  };

  // Remove user from chat API call
  const removeUserFromChat = async (chatId: string, userId: string) => {
    console.log(`Removing user ${userId} from chat ${chatId}`);
  const res = await fetch(`https://${BACKEND_URL}/api/chats/remove-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ADMIN_JWT_TOKEN}`
    },
    body: JSON.stringify({ chat_id: chatId, telegram_user_id: userId })
    });

    if (!res.ok) {
      const error = await res.json();
      return message.error(error.detail || "Failed to remove user");
    }

  const data = await res.json();
  if(!data.ok) {
    message.error("Failed to remove user: " + data.message);
  } else {
    message.success("User removed successfully");
  }
  return data;
};

  // Fetch data on menu change
  useEffect(() => {
    if (selectedMenu === "bot") fetchBotChats();
    }, [selectedMenu]);
  
    // Fetch bot chats when add modal is opened for user addition
  useEffect(() => {
  if (addModalVisible && !selectedUser) {
    fetchBotChats();
  }
}, [addModalVisible]);

  useEffect(() => {
    if (selectedMenu === "users") fetchUsers();
    else if (selectedMenu === "invites") fetchPendingUsers().then(setPendingUsers);
  }, [selectedMenu]);

  // Generate random string for invite link
  function generateRandomString(length = 10) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }
    return result;
}

  const generateActivationCode = async () => {
    setLoadingInvite(true);
    const newLink = generateRandomString(10);
    setInviteLink(newLink);
    form.setFieldsValue({ activation_code: newLink });
    setLoadingInvite(false);
  };

  const openDrawer =  async (user: TelegramUser) => {
    const chats = await fetchUserChats(user.id);

      setSelectedUser({
    ...user,
    chats, // ✅ attach chats here
  });

   console.log("Opening drawer for user:", user);
   console.log("User chats:", chats);
   console.log("Selected user after attaching chats:", {
    ...user,
    chats,
   });

    setDrawerUserVisible(true);
  };


  const closeUserDrawer = () => {
    setDrawerUserVisible(false);
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
      (user.email?.toLowerCase().includes(text) ?? false) ||
      (user.status?.toLowerCase().includes(text) ?? false) ||
      (user.user_id?.toLowerCase().includes(text) ?? false) ||
      (user.telegram_id?.toLowerCase().includes(text) ?? false)
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
  try {
      const { chat_id, ...userData } = values;

      // 1️⃣ Insert user
      const { data: users, error: userError } = await supabase
        .from("users")
        .insert([userData])
        .select()
        .single();

      if (userError) throw userError;

      // 2️⃣ Insert relation into chat_members
      if (chat_id && chat_id.length > 0) {
        const rows = chat_id.map((cid: string) => ({
            user_id: users.id,
            chat_id: cid,
            is_member_active: "invided",
          }));

          const { error: memberError } = await supabase
            .from("chat_members")
            .insert(rows);

        if (memberError) throw memberError;
      }
      message.success("User added to chat successfully");
    } catch (err: any) {
      message.error(err.message);
    }
    }

    setAddModalVisible(false);
    setDrawerUserVisible(false);
    setSelectedUser(null);
    setInviteLink("");
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
      setDrawerUserVisible(false);
      refreshUsers();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
     
        <FloatButton.Group
          icon={<MoreOutlined />}
          closeIcon={<CloseOutlined />}
          trigger="click"
        >
          <Popconfirm
            icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
            title="Logout?"
            description="Are you sure you want to logout?"
            onConfirm={onLogout}
            okText="Yes"
            cancelText="No"
          >
            <FloatButton
              icon={<LogoutOutlined style={{ color: 'red' }} />}
            />
          </Popconfirm>
          <FloatButton
              icon={<TeamOutlined />}
              //description="Users"
              onClick={() => setSelectedMenu("users")}
            />
             <FloatButton
              icon={<AuditOutlined />}
              //description="Invites"
              onClick={() => setSelectedMenu("invites")}
            />
             <FloatButton
              icon={<RobotOutlined />}
              //description="Bot"
              onClick={() => setSelectedMenu("bot")}
            />
            <FloatButton 
              //description="Add User"
              icon={<UserAddOutlined />}
              onClick={() => setAddModalVisible(true)} />
        </FloatButton.Group>

        {selectedMenu === "users" && (
          <FloatButton 
          style={{insetInlineEnd: 90}}
          //description="Chats"
          icon={<WechatOutlined />}
          onClick={() => setDrawerChatVisible(true)} />
        )}


      <Layout>

        <Content
          style={{
            padding: 24,
            overflow: "auto",
          }}
          onScroll={onScroll}
        >
        
        {selectedMenu === "users" && (
          <>
              <Divider dashed>{selectedChatId === "all" ? "All members" : botChats.find(chat => chat.chat_id === selectedChatId)?.chat_name}</Divider>
              {/* Users list */}
              <List
                dataSource={filteredUsers}
                header={
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Input.Search
                      placeholder="Search"
                      allowClear
                      onClear={() => setSearchText("")}
                      onSearch={(value) => setSearchText(value)}
                    />
                  </Space>
                }
                renderItem={(user) => (
                  <List.Item
                    key={user.id}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      marginBottom: 12,
                      borderRadius: 12,
                      padding: 16,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                    }}
                    onClick={() => openDrawer(user)}
                  >
                    <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: "#1890ff" }}>{user.first_name[0]}</Avatar>}
                      title={user.first_name + (user.last_name ? ` ${user.last_name}` : "")}
                      description={
                        <>
                          <div>
                            {selectedChatId !== "all" ? (
                                <>
                                  <b>Is Active:</b>{" "}
                                  <Tag color={user.is_member_active === "invited" ? "gold" : "green"}>
                                    {user.is_member_active || "unknown"}
                                  </Tag>
                                </>
                              ) : (
                                <>
                                  <b>Status:</b>{" "}
                                  <Tag color={user.status === "verified" ? "green" : "gold"}>
                                    {user.status || "unknown"}
                                  </Tag>
                                </>
                              )}
                          </div>
                        </>
                      }
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
                          <br />{user.status == "pending" ? (
                          <Tag color="gold">{user.status}</Tag>
                          ) : (<Tag color="green">{user.status}</Tag>)
                          }
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}

          {selectedMenu === "bot" && (
             <>
            <Typography.Title level={3}>Bot Chats</Typography.Title>

            {loadingBotChats ? (
              <Spin />
            ) : (
              <List
                dataSource={botChats}
                renderItem={(chat) => (
                  <List.Item
                    key={chat.id}
                    style={{
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 12,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                      cursor: "pointer",
                    }}
                  >
                    <List.Item.Meta
                      title={`Chat ID: ${chat.chat_id} - ${chat.chat_name || "No title"}`}
                      description={`Users: ${chat.seen_members} | Joined: ${chat.created_at ? dayjs(chat.created_at).format("DD MMM YYYY") : "—"}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </>
          )}

        </Content>
      </Layout>
      

      {/* Drawer User*/}
      <Drawer
        title={selectedUser?.user_name || selectedUser?.first_name}
        placement="right"
        onClose={closeUserDrawer}
        open={drawerUserVisible}
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
                setDrawerUserVisible(false);
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
                setDrawerUserVisible(false);
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
              <b>User ID:</b> {selectedUser.user_id}
            </Text>
          </div>
        )}

           <Divider>Member of chats</Divider>

            <List
              size="small"
              dataSource={memberChats}
              locale={{ emptyText: "Not a member of any chat" }}
              renderItem={(chat) => {
                const status = selectedUser?.chats?.find(c => c.chat_id === chat.chat_id);

                return (
                  <List.Item>
                    <Space>
                      <b>{chat.chat_name}</b>
                      <Tag color={status?.is_member_active === "active" ? "green" : "gold"}>
                        {status?.is_member_active}
                      </Tag>
                    </Space>
                    {status?.is_member_active === "active" && (
                    <Button
                      size="small"
                      danger
                       onClick={() => removeUserFromChat(chat.chat_id, selectedUser?.telegram_id!)}
                       >Ban user</Button>
                    )}
                  </List.Item>
                );
              }}
            />

            <Divider>Invite to chat</Divider>

          {nonMemberChats.length === 0 ? ( // TODO: if status pending infor 
            <Text type="secondary">User is already in all chats</Text>
          ) : (
            <><Select
              status={selectedUser?.status === "verified" ? "" : "error"}
              mode="multiple"
              value={inviteChatIds}
              disabled={selectedUser?.status !== "verified"}
              placeholder={selectedUser?.status === "verified" ? "Select chats to invite" : "User must be verified."}
              style={{ width: "100%" }}
              onChange={(chatIds) => setInviteChatIds(chatIds)}
            >
              {nonMemberChats.map(chat => (
                <Select.Option key={chat.chat_id} value={chat.chat_id}>
                  {chat.chat_name}
                </Select.Option>
              ))}
            </Select>
            <Button 
            icon={<SendOutlined />}
            style={{
              marginTop: 12,
            }}
              type="primary"
              block
              disabled={!inviteChatIds?.length}
              onClick={() => {
                inviteChatIds.forEach(async (chatId) => {
                    await inviteUserToChat(chatId, selectedUser?.telegram_id!);
                });
              }}
            >
                Send Invites
              </Button></>
            
          )}
      </Drawer>

      {/* Drawer chats */}
      <Drawer
        title="Telegram Chats"
        placement="right"
        onClose={() => setDrawerChatVisible(false)}
        open={drawerChatVisible}
        width={360}
        footer={ <List.Item
        
            style={{cursor: "pointer"}} 
            onClick={() => setSelectedChatId("all")}>
            <List.Item.Meta
              title="All members"
            />
          </List.Item>}
        >
        {/* Chat content goes here */}
        <List
          dataSource={botChats}
          renderItem={(chat) => (
            <List.Item
              style={{cursor: "pointer"}} 
              onClick={() => setSelectedChatId(chat.chat_id)}
              key={chat.id}>
              <List.Item.Meta
                title={chat.chat_name || "No title"}
                description={`Chat ID: ${chat.chat_id}`}
              />
            </List.Item>
          )
        }
        >
        </List>
      </Drawer>

      {/* Drawer chats */}

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
            <Input placeholder="User first name"/>
          </Form.Item>

          <Form.Item name="last_name" label="Last name" rules={[{ required: true }]}>
            <Input placeholder="User last name"/>
          </Form.Item>

          <Form.Item name="user_name" label="User Name">
            <Input placeholder="User name"/>
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="User email"/>
          </Form.Item>

          <Form.Item name="user_id" label="ID" rules={[{ required: true }]}>
            <Input placeholder="User Quo ID"/>
          </Form.Item>

          {!selectedUser && ( // Maby not to invate then adding new user. Maby add after user is verified
            <Form.Item
              name="chat_id"
              label="Chats"
              tooltip="Optionally select chats to add user to after verification"
              //rules={[{ required: true, message: "Please select a chat!" }]}
            >
              {loadingBotChats ? (
                <Spin />
              ) : (
                <Select mode="multiple"   
                        placeholder="Select one or more chats"
                        allowClear
                >
                  {botChats.map((chat) => (
                    <Select.Option key={chat.id} value={chat.chat_id}>
                      {chat.chat_name}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </Form.Item>
          )}
          {/* INVITE SECTION */}
          {!selectedUser && (
            <>
              <Divider orientation="left">Activation Code</Divider>

                <Form.Item name="activation_code" style={{ display: 'none' }}  rules={[{ required: true }]}>
                  <Input />
                </Form.Item>

              <Space direction="horizontal" style={{ width: "100%" }}>

                  <Input.TextArea
                  required={true}
                    value={inviteLink}
                    readOnly
                    autoSize
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      message.success("Invite link copied");
                    }}
                  />
      
                 <Button
                  icon={<LinkOutlined />}
                  loading={loadingInvite}
                  onClick={generateActivationCode}
                >
                  Generate Activation Code
                </Button>
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
