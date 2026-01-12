import { Modal, Form, Input, Divider, message, Select, Spin, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import ImgCrop from "antd-img-crop";
import { InboxOutlined } from "@ant-design/icons";
import { SendOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface BotChat {
  chat_id: string;
  chat_name: string;
}

interface SendMessageModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (
    message: string,
    chatIds: string[],
    image?: File
  ) => Promise<void>;
  sending?: boolean;
  supabase: SupabaseClient;
}


export const SendMessageModal: React.FC<SendMessageModalProps> = ({
  open,
  onClose,
  onSend,
  sending = false,
supabase
}) => {
  const [form] = Form.useForm();
  const [botChats, setBotChats] = useState<BotChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // Image preview handler
  const handlePreview = async (file: UploadFile) => {
  let src = file.url as string;

  if (!src && file.originFileObj) {
    src = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file.originFileObj as File);
      reader.onload = () => resolve(reader.result as string);
    });
  }

  const image = new Image();
  image.src = src;

  const imgWindow = window.open(src);
  imgWindow?.document.write(image.outerHTML);
};


  // Fetch chats from Supabase
  const fetchChats = async () => {
    setLoadingChats(true);
    try {
      const { data, error } = await supabase
        .from("bot_chats")
        .select("chat_id, chat_name")
        .order("chat_name", { ascending: true });

      if (error) throw error;
      setBotChats(data || []);
    } catch (err: any) {
      message.error("Failed to fetch chats: " + err.message);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    if (open) fetchChats();
  }, [open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const selectedChatIds: string[] = values.chat_ids || [];

      const imageFile =
        fileList.length > 0
          ? (fileList[0].originFileObj as File)
          : undefined;

      await onSend(values.message, selectedChatIds, imageFile);

      form.resetFields();
      setFileList([]);
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <Modal
      open={open}
      title="Send Message to Selected Chats"
      okText="Send"
      okButtonProps={{ icon: <SendOutlined />, loading: sending }}
      onCancel={onClose}
      onOk={handleOk}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        {/* Message */}
        <Divider orientation="left">Message</Divider>
        <Form.Item
          name="message"
          rules={[{ required: true, message: "Please enter a message" }]}
        >
          <Input.TextArea
            placeholder="Type your message here…"
            autoSize={{ minRows: 4, maxRows: 8 }}
          />
        </Form.Item>

       {/* Optional Image */}
      <Divider orientation="left">Optional Image</Divider>

      <Form.Item name="image">
        <ImgCrop
          rotationSlider
          showGrid
          aspectSlider 
          showReset
        >
          <Upload.Dragger
            multiple={false}
            accept="image/*"
            listType="picture"
            fileList={fileList}
            beforeUpload={() => false} // ⛔ prevent auto upload
            onPreview={handlePreview}
            onChange={({ fileList }) => setFileList(fileList.slice(-1))}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag an image here (optional)
            </p>
            <p className="ant-upload-hint">
              Phone screenshots, JPG, PNG, etc.
            </p>
          </Upload.Dragger>
        </ImgCrop>
      </Form.Item>

        {/* Select chats */}
        <Divider orientation="left">Select Chats</Divider>
        <Form.Item
          name="chat_ids"
          rules={[{ required: true, message: "Please select at least one chat" }]}
        >
          {loadingChats ? (
            <Spin />
          ) : (
            <Select
              mode="multiple"
              placeholder="Select chats"
              allowClear
              style={{ width: "100%" }}
              optionFilterProp="children"
            >
              {botChats.map(chat => (
                <Select.Option key={chat.chat_id} value={chat.chat_id}>
                  {chat.chat_name}
                </Select.Option>
              ))}
            </Select>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
};
