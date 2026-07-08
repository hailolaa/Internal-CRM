"use client";

import { useState } from "react";
import {
  Search,
  Inbox as InboxIcon,
  Mail,
  MessageSquare,
  Phone,
  Star,
  Archive,
  MoreHorizontal,
  Send,
  Paperclip,
  Smile,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { PageHeader, Card, AlertBanner } from "@/components/ui";
import { FilterTabs } from "@/components/ui/forms";

// ============================================================
// Conversation types
// ============================================================
export interface Conversation {
  id: string;
  contact: string;
  channel: string;
  preview: string;
  time: string;
  unread: boolean;
  starred: boolean;
  archived?: boolean;
  attachmentsSupported?: boolean;
  avatar: string;
}

const channelConfig: Record<
  string,
  { icon: typeof Mail; color: string; bg: string }
> = {
  email: { icon: Mail, color: "text-blue-500", bg: "bg-blue-50" },
  sms: { icon: MessageSquare, color: "text-green-500", bg: "bg-green-50" },
  whatsapp: {
    icon: MessageSquare,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  phone: { icon: Phone, color: "text-amber-500", bg: "bg-amber-50" },
};
const fallbackChannel = {
  icon: Mail,
  color: "text-gray-500",
  bg: "bg-gray-50",
};

// ============================================================
// ConversationItem
// ============================================================
export function ConversationItem({
  conv,
  isSelected,
  onClick,
}: {
  conv: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Channel = channelConfig[conv.channel] ?? fallbackChannel;
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-colors rounded-[16px] mx-2 my-1 ${
        isSelected
          ? "bg-[rgba(110,106,232,0.08)] border border-[rgba(110,106,232,0.18)]"
          : conv.unread
            ? "bg-[#FFFCF9]"
            : ""
      } hover:bg-[rgba(110,106,232,0.06)]`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6E6AE8] to-[#9B8FF5] flex items-center justify-center text-sm font-medium text-white flex-shrink-0">
          {conv.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`font-medium truncate ${conv.unread ? "text-[#111111]" : "text-[#374151]"}`}
              >
                {conv.contact}
              </span>
              <div
                className={`w-5 h-5 rounded flex items-center justify-center ${Channel.bg}`}
              >
                <Channel.icon className={`w-3 h-3 ${Channel.color}`} />
              </div>
              {conv.starred && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
              )}
            </div>
            <span className="text-xs text-[#6B7280] flex-shrink-0 ml-2">
              {conv.time}
            </span>
          </div>
          <p
            className={`text-sm truncate ${conv.unread ? "text-[#374151]" : "text-[#6B7280]"}`}
          >
            {conv.preview}
          </p>
        </div>
        {conv.unread && (
          <div className="w-2 h-2 rounded-full bg-[#6E6AE8] flex-shrink-0 mt-2" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// MessagePanel — now with working send handler + status feedback
// ============================================================

interface SentMessage {
  id: string;
  text: string;
  time: string;
  status: "sending" | "sent" | "delivered";
}

export function MessagePanel({
  conv,
  message,
  setMessage,
}: {
  conv: Conversation | undefined;
  message: string;
  setMessage: (v: string) => void;
}) {
  const [sentMessages, setSentMessages] = useState<
    Record<string, SentMessage[]>
  >({});
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim() || !conv || isSending) return;

    setIsSending(true);
    const msgId = `msg_${Date.now()}`;
    const newMsg: SentMessage = {
      id: msgId,
      text: message.trim(),
      time: "Just now",
      status: "sending",
    };

    setSentMessages((prev) => ({
      ...prev,
      [conv.id]: [...(prev[conv.id] || []), newMsg],
    }));
    setMessage("");

    setSentMessages((prev) => ({
      ...prev,
      [conv.id]: (prev[conv.id] || []).map((m) =>
        m.id === msgId ? { ...m, status: "sent" as const } : m,
      ),
    }));

    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#6B7280]">
        <div className="text-center">
          <InboxIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#6E6AE8]" />
          <p className="text-[#6B7280]">Select a conversation to view</p>
        </div>
      </div>
    );
  }

  const channel = channelConfig[conv.channel] ?? fallbackChannel;
  const convSentMessages = conv ? sentMessages[conv.id] || [] : [];

  return (
    <>
      {/* Message panel header */}
      <div className="p-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between bg-[#FFFCF9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6E6AE8] to-[#9B8FF5] flex items-center justify-center text-sm font-medium text-white">
            {conv.avatar}
          </div>
          <div>
            <p className="font-medium text-[#111111]">{conv.contact}</p>
            <p className="text-xs text-[#6B7280] flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${channel.color.replace("text-", "bg-")}`}
              />
              via {conv.channel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled
            title="Conversation starring is not integrated yet."
            aria-label={
              conv.starred ? "Unstar conversation" : "Star conversation"
            }
            className="p-2 rounded-lg opacity-40 cursor-not-allowed"
          >
            <Star
              className={`w-4 h-4 ${conv.starred ? "text-amber-400 fill-amber-400" : "text-[#6B7280]"}`}
            />
          </button>
          <button
            type="button"
            disabled
            title="Conversation archiving is not integrated yet."
            aria-label="Archive conversation"
            className="p-2 rounded-lg opacity-40 cursor-not-allowed"
          >
            <Archive className="w-4 h-4 text-[#6B7280]" />
          </button>
          <button
            type="button"
            disabled
            title="More conversation actions are not integrated yet."
            aria-label="More conversation options"
            className="p-2 rounded-lg opacity-40 cursor-not-allowed"
          >
            <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#FAF8F5]">
        {/* Incoming message bubble */}
        <div className="flex justify-start">
          <div className="max-w-[80%] bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[20px] rounded-tl-[6px] px-4 py-3 shadow-sm">
            <p className="text-sm text-[#111111]">{conv.preview}</p>
            <p className="text-xs text-[#6B7280] mt-1">{conv.time}</p>
          </div>
        </div>

        {/* Outgoing message bubble */}
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-[rgba(110,106,232,0.08)] border border-[rgba(110,106,232,0.14)] rounded-[20px] rounded-tr-[6px] px-4 py-3">
            <p className="text-sm text-[#111111]">
              Hi {conv.contact.split(" ")[0]}! Thanks for reaching out. I&apos;d
              be happy to help you with that. Let me check our availability...
            </p>
            <p className="text-xs text-[#6B7280] mt-1">Earlier</p>
          </div>
        </div>

        {/* Dynamically sent messages */}
        {convSentMessages.map((msg) => (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[80%] bg-[rgba(110,106,232,0.08)] border border-[rgba(110,106,232,0.14)] rounded-[20px] rounded-tr-[6px] px-4 py-3">
              <p className="text-sm text-[#111111]">{msg.text}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-xs text-[#6B7280]">{msg.time}</p>
                {msg.status === "sending" && (
                  <Loader2 className="w-3 h-3 text-[#6B7280] animate-spin" />
                )}
                {msg.status === "sent" && (
                  <CheckCircle className="w-3 h-3 text-[#6B7280]" />
                )}
                {msg.status === "delivered" && (
                  <CheckCircle className="w-3 h-3 text-[#6E6AE8]" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compose area */}
      <div className="p-4 border-t border-[rgba(0,0,0,0.06)] bg-[#FFFCF9]">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[20px] p-3 focus-within:border-[rgba(110,106,232,0.4)] transition-colors">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={2}
              className="w-full bg-transparent text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  title="Attachments are not integrated yet."
                  aria-label="Attach file"
                  className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
                >
                  <Paperclip className="w-4 h-4 text-[#6B7280]" />
                </button>
                <button
                  type="button"
                  disabled
                  title="Emoji insertion is not integrated yet."
                  aria-label="Insert emoji"
                  className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
                >
                  <Smile className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isSending}
                className="px-4 py-1.5 bg-[#6E6AE8] text-white rounded-[12px] text-sm font-medium hover:bg-[#5A56D4] flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Sending
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" /> Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
