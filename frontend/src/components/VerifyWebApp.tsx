import React, { useEffect, useState } from "react";
import { Typography, message as msgAntd, Button, Input, Form } from "antd";
import axios from "axios";

const BACKEND = "http://localhost:5000";

const VerifyWebApp: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get("token");
  const userId = urlParams.get("user_id");

  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!inviteToken) {
      msgAntd.error("❌ No invite token provided");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND}/api/verify-webapp`, {
        inviteToken,
        telegram_user_id: userId,
        initData: "" // optional Telegram initData
      });

      if (res.data.success) {
        msgAntd.success("✅ Verified successfully!");
        setVerified(true);
      } else {
        msgAntd.error("❌ Verification failed: " + res.data.error);
      }
    } catch (err: any) {
      msgAntd.error("❌ Verification error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // const submitId = async (values: { user_private_id: string, name: string, surname: string }) => {
  //   try {
  //     // Receive Id user name sure name emailaddres teelegram id
  //     // await axios.post(`${BACKEND}/api/store-user-id`, {
  //     //   inviteToken,
  //     //   userId: values.user_private_id,
  //     //   name: values.name,
  //     //   surname: values.surname,
  //     //   telegramUserId: userId
  //     // });
  //     msgAntd.success("✅ ID submitted successfully!");
  //     // once get info send to the user link to the chat
  //   } catch (err: any) {
  //     msgAntd.error("❌ Error submitting ID: " + err.message);
  //   }
  // };

  useEffect(() => {
    verify();
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <Typography.Title level={2}>Telegram Verification</Typography.Title>

      {!verified ? (
        <Button type="primary" onClick={verify} loading={loading}>
          Retry Verification
        </Button>
      ) : (
        <Form layout="vertical" /*onFinish={submitId}*/>
          <Form.Item
            label="Enter Your ID"
            name="user_private_id"
            rules={[{ required: true, message: "Please enter your ID" }]}
          >
            <Input placeholder="Enter your ID" />
          </Form.Item>
                    <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Please enter your name" }]}
          >
            <Input placeholder="Enter your name" />
          </Form.Item>
                    <Form.Item
            label="Suername"
            name="surname"
            rules={[{ required: true, message: "Please enter your surname" }]}
          >
            <Input placeholder="Enter your surname" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Submit ID
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
};

export default VerifyWebApp;
