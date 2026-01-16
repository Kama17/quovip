import { Modal, Form, Input, Divider, message, Spin, Upload, TreeSelect } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import ImgCrop from 'antd-img-crop';
import { InboxOutlined } from '@ant-design/icons';
import { SendOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type BackendPayload = {
  chat_id: string;
  topic?: string;
};

interface ChatTreeNode {
  title: string;
  value: string;
  key: string;
  selectable: boolean;
  children?: {
    title: string;
    value: string;
    key: string;
  }[];
}

interface SendMessageModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (
    message: string,
    targets: BackendPayload[], // ✅ FIXED
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
  supabase,
}) => {
  const [form] = Form.useForm();
  const [botChats, setBotChats] = useState<ChatTreeNode[]>([]);
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
        .from('bot_chats')
        .select('chat_id, chat_name, bot_chats_topics(message_thread_id, topic_name)')
        .order('chat_name', { ascending: true });

      if (error) throw error;
      const treeData: ChatTreeNode[] = data.map((chat) => {
        const hasTopics = !!chat.bot_chats_topics?.length;

        return {
          title: chat.chat_name,
          value: `chat:${chat.chat_id}`,
          key: `chat:${chat.chat_id}`,
          selectable: !hasTopics, // selectable ONLY if no topics
          children: hasTopics
            ? chat.bot_chats_topics!.map((topic) => ({
                title: topic.topic_name,
                value: `topic:${chat.chat_id}:${topic.message_thread_id}`,
                key: `topic:${chat.chat_id}:${topic.message_thread_id}`,
              }))
            : undefined,
        };
      });

      setBotChats(treeData || []);
      console.log('Fetched chats:', data);
    } catch (err: any) {
      message.error('Failed to fetch chats: ' + err.message);
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

      const selectedValues: string[] = values.chat_ids;
      const payload = mapSelectionToPayload(selectedValues);

      const imageFile = fileList.length > 0 ? (fileList[0].originFileObj as File) : undefined;

      await onSend(values.message, payload, imageFile);

      form.resetFields();
      setFileList([]);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const mapSelectionToPayload = (values?: unknown[]): BackendPayload[] => {
    if (!Array.isArray(values)) return [];

    return values.reduce<BackendPayload[]>((acc, v) => {
      if (typeof v !== 'string') return acc;

      // Topic selected
      if (v.startsWith('topic:')) {
        const [, chat_id, topic] = v.split(':');
        acc.push({ chat_id, topic });
        return acc;
      }

      // Chat without topics
      if (v.startsWith('chat:')) {
        const [, chat_id] = v.split(':');
        acc.push({ chat_id });
        return acc;
      }

      return acc;
    }, []);
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
        <Form.Item name="message" rules={[{ required: true, message: 'Please enter a message' }]}>
          <Input.TextArea
            placeholder="Type your message here…"
            autoSize={{ minRows: 4, maxRows: 8 }}
          />
        </Form.Item>

        {/* Optional Image */}
        <Divider orientation="left">Optional Image</Divider>

        <Form.Item name="image">
          <ImgCrop rotationSlider showGrid aspectSlider showReset>
            <Upload.Dragger
              multiple={false}
              accept="image/*"
              listType="picture"
              fileList={fileList}
              onPreview={handlePreview}
              onChange={({ fileList }) => setFileList(fileList.slice(-1))}
              maxCount={1}
              onRemove={(file) => {
                if (file.url) URL.revokeObjectURL(file.url);
                setFileList([]);
              }}
              customRequest={({ file, onSuccess }) => {
                const croppedFile = file as File;
                const previewUrl = URL.createObjectURL(croppedFile);

                setFileList([
                  {
                    uid: Date.now().toString(),
                    name: croppedFile.name,
                    status: 'done',
                    url: previewUrl, // ✅ preview
                  },
                ]);

                onSuccess?.('ok');
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag an image here (optional)</p>
              <p className="ant-upload-hint">Phone screenshots, JPG, PNG, etc.</p>
            </Upload.Dragger>
          </ImgCrop>
        </Form.Item>

        {/* Select chats */}
        <Divider orientation="left">Select Chats</Divider>
        <Form.Item
          name="chat_ids"
          rules={[{ required: true, message: 'Please select at least one chat' }]}
        >
          {loadingChats ? (
            <Spin />
          ) : (
            <TreeSelect
              treeData={botChats}
              treeCheckable
              placement="topRight"
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              placeholder="Select chats / channels"
              style={{ width: '100%' }}
              allowClear
            />
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
};
