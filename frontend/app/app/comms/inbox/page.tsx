"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Inbox as InboxIcon,
  Mail,
  MessageSquare,
  Phone,
  Star,
  Archive,
  ArrowLeft,
  Send,
  Smile,
  Loader2,
  X,
} from "lucide-react";
import { PageHeader, Card, AlertBanner } from "@/components/ui";
import { FilterTabs } from "@/components/ui/forms";
import { ConversationItem } from "@/components/templates/inbox-page";
import type { Conversation } from "@/components/templates/inbox-page";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  InboxConversationRecord,
  InboxThreadMessageRecord,
  InboxThreadRecord,
  WhatsAppAiReplyRecord,
  WhatsAppConversationRecord,
  WhatsAppMessageRecord,
} from "@/lib/api-types";

const channelConfig: Record<
  string,
  { icon: typeof Mail; color: string; bg: string }
> = {
  email: { icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10" },
  sms: { icon: MessageSquare, color: "text-green-400", bg: "bg-green-500/10" },
  whatsapp: {
    icon: MessageSquare,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  phone: { icon: Phone, color: "text-amber-400", bg: "bg-amber-500/10" },
};

type InboxConversation = Conversation & {
  contactId?: string;
};

const AI_DRAFT_DISMISS_STORAGE_KEY = "mission-control.dismissed-whatsapp-ai-replies";
const INBOX_REFRESH_INTERVAL_MS = 8000;

function formatInboxTime(value: string) {
  if (!value.includes("T")) return value;

  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 60) return `${Math.max(diffMinutes, 1)} mins ago`;
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)} hrs ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function parseMessageTimestamp(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T");
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatMessageTime(value: string) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) return value;

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function createWhatsAppIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `whatsapp-manual:${crypto.randomUUID()}`;
  }
  return `whatsapp-manual:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function getWhatsAppMessageTime(message: WhatsAppMessageRecord) {
  return (
    message.receivedAt ||
    message.sentAt ||
    message.createdAt ||
    new Date().toISOString()
  );
}

function withWhatsAppMessage(
  thread: WhatsAppConversationRecord | null,
  message: WhatsAppMessageRecord,
) {
  if (!thread) return thread;

  const messages = [
    ...thread.messages.filter((existing) => existing.id !== message.id),
    message,
  ].sort(
    (a, b) =>
      parseMessageTimestamp(getWhatsAppMessageTime(a)) -
      parseMessageTimestamp(getWhatsAppMessageTime(b)),
  );

  return {
    ...thread,
    conversation: {
      ...thread.conversation,
      lastMessageAt: getWhatsAppMessageTime(message),
      updatedAt: new Date().toISOString(),
    },
    messages,
  };
}

function mapConversation(record: InboxConversationRecord): InboxConversation {
  return {
    id: record.id,
    contactId: record.contactId,
    contact: record.contact,
    channel: record.channel,
    preview: record.preview,
    time: formatInboxTime(record.time),
    unread: record.unread,
    starred: record.starred,
    archived: record.archived || false,
    attachmentsSupported: record.attachmentsSupported || false,
    avatar: record.avatar,
  };
}

export default function InboxPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationRows, setConversationRows] = useState<InboxConversation[]>(
    [],
  );
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [thread, setThread] = useState<InboxThreadRecord | null>(null);
  const [whatsappThread, setWhatsappThread] =
    useState<WhatsAppConversationRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [threadStatusMessage, setThreadStatusMessage] = useState<string | null>(
    null,
  );
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAiSending, setIsAiSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [dismissedAiReplyIds, setDismissedAiReplyIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();

    try {
      const saved = window.localStorage.getItem(AI_DRAFT_DISMISS_STORAGE_KEY);
      const ids = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
    } catch {
      return new Set();
    }
  });
  const unreadCount = conversationRows.filter((c) => c.unread).length;
  const selectedConv = conversationRows.find(
    (c) => c.id === selectedConversation,
  );
  const selectedChannelConfig =
    selectedConv && channelConfig[selectedConv.channel]
      ? channelConfig[selectedConv.channel]
      : channelConfig.email;
  const latestWhatsAppReply: WhatsAppAiReplyRecord | null =
    whatsappThread?.aiReplies?.[0] || null;
  const actionableWhatsAppReply =
    latestWhatsAppReply &&
    !["sent", "auto_sent", "discarded"].includes(latestWhatsAppReply.status)
      ? latestWhatsAppReply
      : null;
  const visibleWhatsAppReply =
    actionableWhatsAppReply && !dismissedAiReplyIds.has(actionableWhatsAppReply.id)
      ? actionableWhatsAppReply
      : null;
  const visibleWhatsAppOutbound = visibleWhatsAppReply?.outboundMessageId
    ? whatsappThread?.messages.find((item) => item.id === visibleWhatsAppReply.outboundMessageId) || null
    : null;
  const visibleWhatsAppRetryNeedsConfirmation =
    visibleWhatsAppOutbound?.metadata?.retrySafe === false;
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversationRows.filter((conversation) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && conversation.unread) ||
        (filter === "starred" && conversation.starred) ||
        (filter === "archived" && conversation.archived) ||
        conversation.channel.toLowerCase() === filter;
      const matchesSearch =
        !query ||
        [conversation.contact, conversation.preview, conversation.channel].some(
          (value) => value.toLowerCase().includes(query),
        );

      return matchesFilter && matchesSearch;
    });
  }, [conversationRows, filter, searchQuery]);

  useEffect(() => {
    window.localStorage.setItem(
      AI_DRAFT_DISMISS_STORAGE_KEY,
      JSON.stringify(Array.from(dismissedAiReplyIds)),
    );
  }, [dismissedAiReplyIds]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadInbox() {
      setIsLoading(true);
      try {
        const rows =
          filter === "archived"
            ? await api.comms.archivedInbox(authToken)
            : await api.comms.inbox(authToken);
        if (cancelled) return;
        const mapped = rows.map(mapConversation);
        setConversationRows(mapped);
        setSelectedConversation((current) =>
          current && mapped.some((conversation) => conversation.id === current)
            ? current
            : mapped[0]?.id || null,
        );
        setStatusMessage(null);
      } catch (error) {
        console.error("Failed to load inbox", error);
        if (!cancelled) {
          setConversationRows([]);
          setSelectedConversation(null);
          setStatusMessage(
            error instanceof Error ? error.message : "Unable to load inbox.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadInbox();

    return () => {
      cancelled = true;
    };
  }, [token, filter]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    const refreshInbox = async () => {
      try {
        const rows =
          filter === "archived"
            ? await api.comms.archivedInbox(authToken)
            : await api.comms.inbox(authToken);
        if (!cancelled) {
          setConversationRows(rows.map(mapConversation));
        }
      } catch (error) {
        console.error("Failed to refresh inbox", error);
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshInbox();
    }, INBOX_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token, filter]);

  useEffect(() => {
    if (!token || !selectedConv?.contactId) {
      return;
    }

    let cancelled = false;
    const authToken = token;
    const contactId = selectedConv.contactId;
    const channel = selectedConv.channel;

    async function loadThread() {
      try {
        const [conversation, whatsappConversation] = await Promise.all([
          api.comms.getConversation(authToken, contactId),
          channel === "whatsapp"
            ? api.comms.getWhatsAppConversation(authToken, contactId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setThread(conversation);
          setWhatsappThread(whatsappConversation);
          setThreadStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load inbox thread", error);
        if (!cancelled) {
          setThread(null);
          setWhatsappThread(null);
          setThreadStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load this conversation thread.",
          );
        }
      }
    }

    void loadThread();

    return () => {
      cancelled = true;
    };
  }, [token, selectedConv?.contactId, selectedConv?.channel]);

  useEffect(() => {
    if (!token || selectedConv?.channel !== "whatsapp" || !selectedConv.contactId) {
      return;
    }

    let cancelled = false;
    const authToken = token;
    const contactId = selectedConv.contactId;
    const conversationId = selectedConv.id;

    const refreshWhatsAppThread = async () => {
      try {
        const updatedThread = await api.comms.getWhatsAppConversation(authToken, contactId);
        if (cancelled) return;

        setWhatsappThread(updatedThread);
        const latestMessage = updatedThread.messages.at(-1);
        if (latestMessage) {
          updateConversationPreview(conversationId, {
            preview: latestMessage.body,
            time: formatInboxTime(getWhatsAppMessageTime(latestMessage)),
            unread: latestMessage.direction === "inbound" ? true : selectedConv.unread,
            channel: "whatsapp",
          }, { moveToTop: false });
        }
      } catch (error) {
        console.error("Failed to refresh WhatsApp thread", error);
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshWhatsAppThread();
    }, INBOX_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token, selectedConv?.id, selectedConv?.contactId, selectedConv?.channel, selectedConv?.unread]);

  const upsertConversation = (updated: InboxConversation) => {
    setConversationRows((current) => {
      const shouldKeep =
        filter === "archived" ? updated.archived : !updated.archived;
      const exists = current.some((conversation) => conversation.id === updated.id);

      if (!shouldKeep) {
        return current.filter((conversation) => conversation.id !== updated.id);
      }

      if (!exists) return [updated, ...current];
      return current.map((conversation) =>
        conversation.id === updated.id ? updated : conversation,
      );
    });
  };

  function updateConversationPreview(
    conversationId: string,
    changes: Pick<InboxConversation, "preview" | "time"> &
      Partial<Pick<InboxConversation, "unread" | "channel">>,
    options: { moveToTop?: boolean } = { moveToTop: true },
  ) {
    setConversationRows((current) => {
      const existing = current.find((conversation) => conversation.id === conversationId);
      if (!existing) return current;

      const updated = {
        ...existing,
        ...changes,
      };

      if (options.moveToTop === false) {
        return current.map((conversation) =>
          conversation.id === conversationId ? updated : conversation,
        );
      }

      return [
        updated,
        ...current.filter((conversation) => conversation.id !== conversationId),
      ];
    });
  }

  const selectedContactId = selectedConv?.contactId || selectedConv?.id;

  const setComposerValue = (value: string) => {
    setMessage(value);
    if (replyTextareaRef.current) {
      replyTextareaRef.current.value = value;
    }
  };

  const clearComposer = () => {
    setComposerValue("");
  };

  const handleMarkAllRead = async () => {
    if (!token || pendingAction) return;

    setPendingAction("read-all");
    setStatusMessage("Marking inbox conversations read...");
    try {
      await api.comms.markAllRead(token);
      setConversationRows((current) =>
        current.map((conversation) => ({ ...conversation, unread: false })),
      );
      setStatusMessage("Inbox conversations marked read.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to mark inbox conversations read.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setThread(null);
    setWhatsappThread(null);
    clearComposer();
  };

  const handleToggleRead = async () => {
    if (!token || !selectedConv || !selectedContactId || pendingAction) return;

    const unread = !selectedConv.unread;
    setPendingAction("read");
    setStatusMessage(unread ? "Marking conversation unread..." : "Marking conversation read...");
    try {
      const updated = await api.comms.updateReadState(token, selectedContactId, {
        unread,
      });
      upsertConversation(mapConversation(updated));
      setStatusMessage(unread ? "Conversation marked unread." : "Conversation marked read.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to update conversation read state.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleStar = async () => {
    if (!token || !selectedConv || !selectedContactId || pendingAction) return;

    const starred = !selectedConv.starred;
    setPendingAction("star");
    setStatusMessage(starred ? "Starring conversation..." : "Unstarring conversation...");
    try {
      const updated = await api.comms.updateStarState(token, selectedContactId, {
        starred,
      });
      upsertConversation(mapConversation(updated));
      setStatusMessage(starred ? "Conversation starred." : "Conversation unstarred.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to update starred state.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleArchive = async () => {
    if (!token || !selectedConv || !selectedContactId || pendingAction) return;

    const archived = !selectedConv.archived;
    setPendingAction("archive");
    setStatusMessage(archived ? "Archiving conversation..." : "Restoring conversation...");
    try {
      const updated = await api.comms.updateArchiveState(token, selectedContactId, {
        archived,
      });
      upsertConversation(mapConversation(updated));
      setSelectedConversation((current) => {
        if (current !== selectedConv.id) return current;
        const remaining = conversationRows.filter((conversation) =>
          conversation.id === selectedConv.id ? false : true,
        );
        return remaining[0]?.id || null;
      });
      setThread(null);
      setStatusMessage(archived ? "Conversation archived." : "Conversation restored.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to update archive state.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || isSending) return;

    if (!token || !selectedConv?.contactId) {
      setStatusMessage("Select a live backend conversation before sending.");
      return;
    }

    if (selectedConv.channel === "whatsapp") {
      setIsSending(true);
      const body = message.trim();
      clearComposer();
      try {
        const sentMessage = await api.comms.sendWhatsAppMessage(token, selectedConv.contactId, {
          body,
          idempotencyKey: createWhatsAppIdempotencyKey(),
        });
        clearComposer();
        const updatedThread = await api.comms
          .getWhatsAppConversation(token, selectedConv.contactId)
          .catch(() => null);
        setWhatsappThread((current) =>
          withWhatsAppMessage(updatedThread || current, sentMessage),
        );
        if (actionableWhatsAppReply) {
          setDismissedAiReplyIds((current) => new Set(current).add(actionableWhatsAppReply.id));
        }
        updateConversationPreview(selectedConversation, {
          preview: sentMessage.body || body,
          time: "Just now",
          unread: false,
          channel: "whatsapp",
        });
        setStatusMessage("WhatsApp message sent.");
      } catch (err) {
        setComposerValue(body);
        setStatusMessage(
          err instanceof Error ? err.message : "Could not send WhatsApp message.",
        );
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    const body = message.trim();
    clearComposer();

    try {
      const sent = await api.comms.sendMessage(token, selectedConv.contactId, {
        channel: selectedConv.channel === "sms" ? "sms" : "email",
        body,
      });
      clearComposer();
      setThread((current) =>
        current
          ? {
              ...current,
              messages: [...current.messages, sent],
              counts: {
                ...current.counts,
                messages: current.counts.messages + 1,
              },
            }
          : current,
      );
      setConversationRows((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation
            ? {
                ...conversation,
                preview: body,
                time: "Just now",
                unread: false,
              }
            : conversation,
        ),
      );
      setStatusMessage("Message sent.");
    } catch (err) {
      setComposerValue(body);
      setStatusMessage(
        err instanceof Error ? err.message : "Could not send message.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleUseAiDraft = () => {
    if (!visibleWhatsAppReply?.draftBody) return;
    setComposerValue(visibleWhatsAppReply.draftBody);
  };

  const handleApproveAiDraft = async () => {
    if (!token || !selectedConv?.contactId || !visibleWhatsAppReply || isAiSending) return;

    setIsAiSending(true);
    try {
      const reply = await api.comms.approveWhatsAppReply(token, visibleWhatsAppReply.id, {
        body: message.trim() || visibleWhatsAppReply.draftBody,
        sendNow: true,
      });
      const updatedThread = await api.comms.getWhatsAppConversation(token, selectedConv.contactId);
      setWhatsappThread(updatedThread);
      clearComposer();
      if (reply.status !== "failed") {
        setDismissedAiReplyIds((current) => new Set(current).add(visibleWhatsAppReply.id));
        setConversationRows((current) =>
          current.map((conversation) =>
            conversation.id === selectedConversation
              ? {
                  ...conversation,
                  preview: reply.finalBody || reply.draftBody || message.trim(),
                  time: "Just now",
                  unread: false,
                }
              : conversation,
          ),
        );
      }
      setStatusMessage(
        reply.status === "failed"
          ? reply.failureReason || "WhatsApp send failed and is ready for retry."
          : "WhatsApp AI reply approved and sent.",
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not approve WhatsApp AI reply.",
      );
    } finally {
      setIsAiSending(false);
    }
  };

  const handleRetryAiDraft = async () => {
    if (!token || !selectedConv?.contactId || !visibleWhatsAppReply || isAiSending) return;

    let confirmProviderDidNotSend = false;
    if (visibleWhatsAppRetryNeedsConfirmation) {
      confirmProviderDidNotSend = window.confirm(
        "Meta's result is unknown. Check WhatsApp Manager first. Only continue if you have confirmed this message was not sent.",
      );
      if (!confirmProviderDidNotSend) return;
    }

    setIsAiSending(true);
    try {
      const reply = await api.comms.retryWhatsAppReply(token, visibleWhatsAppReply.id, {
        body: message.trim() || visibleWhatsAppReply.finalBody || visibleWhatsAppReply.draftBody,
        confirmProviderDidNotSend,
      });
      const updatedThread = await api.comms.getWhatsAppConversation(token, selectedConv.contactId);
      setWhatsappThread(updatedThread);
      if (reply.status !== "failed") {
        clearComposer();
        setDismissedAiReplyIds((current) => new Set(current).add(visibleWhatsAppReply.id));
      }
      setStatusMessage(
        reply.status === "failed"
          ? reply.failureReason || "WhatsApp retry failed."
          : "WhatsApp reply retried and sent.",
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not retry the WhatsApp reply.",
      );
    } finally {
      setIsAiSending(false);
    }
  };

  const handleInsertEmoji = () => {
    setComposerValue(`${message}${String.fromCodePoint(0x1f642)}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const threadMessages = useMemo<InboxThreadMessageRecord[]>(() => {
    const messagesByKey = new Map<string, InboxThreadMessageRecord>();

    for (const threadMessage of thread?.messages || []) {
      messagesByKey.set(`${threadMessage.channel}:${threadMessage.id}`, threadMessage);
    }

    if (selectedConv?.channel === "whatsapp") {
      for (const whatsappMessage of whatsappThread?.messages || []) {
        messagesByKey.set(`whatsapp:${whatsappMessage.id}`, {
          id: whatsappMessage.id,
          channel: "whatsapp",
          direction: whatsappMessage.direction,
          status: whatsappMessage.status,
          subject: null,
          body: whatsappMessage.body,
          timestamp:
            whatsappMessage.receivedAt ||
            whatsappMessage.sentAt ||
            whatsappMessage.createdAt ||
            new Date().toISOString(),
          sender:
            whatsappMessage.direction === "inbound"
              ? selectedConv.contact
              : "Mission Control",
          senderId: null,
          isInternal: false,
        });
      }
    }

    const messages = Array.from(messagesByKey.values()).sort(
      (a, b) => parseMessageTimestamp(a.timestamp) - parseMessageTimestamp(b.timestamp),
    );

    if (messages.length) return messages;

    return selectedConv
      ? [
          {
            id: selectedConv.id,
            body: selectedConv.preview,
            timestamp: selectedConv.time,
            direction: "inbound",
            channel: selectedConv.channel,
            status: null,
            sender: selectedConv.contact,
            senderId: null,
            isInternal: false,
          },
        ]
      : [];
  }, [selectedConv, thread?.messages, whatsappThread?.messages]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle="All your conversations in one place."
        right={
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6B7280]">{unreadCount} unread</span>
            <button
              onClick={() => void handleMarkAllRead()}
              disabled={pendingAction === "read-all" || unreadCount === 0}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {pendingAction === "read-all" ? "Marking..." : "Mark all read"}
            </button>
          </div>
        }
      />

      {statusMessage && (
        <AlertBanner
          icon={InboxIcon}
          title="Inbox status"
          description={statusMessage}
          variant="info"
        />
      )}

      <FilterTabs
        tabs={["All", "Unread", "Starred", "Archived", "Email", "SMS", "WhatsApp"]}
        active={filter}
        onChange={setFilter}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
        <Card
          padding="p-0"
          className="lg:col-span-1 overflow-hidden flex flex-col bg-[#FFFCF9]"
        >
          <div className="p-3 border-b border-[rgba(0,0,0,0.06)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                id="inbox-conversation-search"
                name="inbox-conversation-search"
                type="text"
                aria-label="Search conversations"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[14px] pl-10 pr-4 py-2 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 rounded-[18px] bg-[rgba(110,106,232,0.08)] animate-pulse"
                  />
                ))}
              </div>
            ) : filteredConversations.length ? (
              filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isSelected={selectedConversation === conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                />
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-[#6B7280]">
                No live conversations found.
              </div>
            )}
          </div>
        </Card>

        <Card
          padding="p-0"
          className="lg:col-span-2 overflow-hidden flex flex-col bg-[#FFFCF9]"
        >
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center text-[#6B7280]">
              <div className="text-center">
                <InboxIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#6E6AE8]" />
                <p>Select a conversation to view</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between bg-[#FFFCF9]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6E6AE8] to-[#9B8FF5] flex items-center justify-center text-sm font-medium text-white">
                    {selectedConv.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-[#111111]">
                      {selectedConv.contact}
                    </p>
                    <p className="text-xs text-[#6B7280] flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${selectedChannelConfig.color.replace("text-", "bg-")}`}
                      />
                      via {selectedConv.channel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setThread(null);
                      setWhatsappThread(null);
                      clearComposer();
                    }}
                    aria-label="Back to conversations"
                    className="p-2 rounded-lg hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#6B7280]" />
                  </button>
                  <button
                    onClick={() => void handleToggleRead()}
                    disabled={pendingAction === "read"}
                    aria-label={
                      selectedConv.unread
                        ? "Mark conversation read"
                        : "Mark conversation unread"
                    }
                    className="p-2 rounded-lg hover:bg-[rgba(110,106,232,0.06)] transition-colors disabled:opacity-50"
                  >
                    {pendingAction === "read" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
                    ) : (
                      <Mail className={`w-4 h-4 ${selectedConv.unread ? "text-[#6E6AE8]" : "text-[#6B7280]"}`} />
                    )}
                  </button>
                  <button
                    onClick={() => void handleToggleStar()}
                    disabled={pendingAction === "star"}
                    aria-label={
                      selectedConv.starred
                        ? "Unstar conversation"
                        : "Star conversation"
                    }
                    className="p-2 rounded-lg hover:bg-[rgba(110,106,232,0.06)] transition-colors disabled:opacity-50"
                  >
                    {pendingAction === "star" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
                    ) : (
                      <Star
                        className={`w-4 h-4 ${selectedConv.starred ? "text-amber-400 fill-amber-400" : "text-[#6B7280]"}`}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => void handleArchive()}
                    disabled={pendingAction === "archive"}
                    aria-label={
                      selectedConv.archived
                        ? "Restore conversation"
                        : "Archive conversation"
                    }
                    className="p-2 rounded-lg hover:bg-[rgba(110,106,232,0.06)] transition-colors disabled:opacity-50"
                  >
                    {pendingAction === "archive" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
                    ) : (
                      <Archive
                        className={`w-4 h-4 ${selectedConv.archived ? "text-[#6E6AE8]" : "text-[#6B7280]"}`}
                      />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#FAF8F5]">
                {threadStatusMessage && (
                  <AlertBanner
                    icon={InboxIcon}
                    title="Conversation status"
                    description={threadStatusMessage}
                    variant="info"
                  />
                )}

                {threadMessages.map((threadMessage) => {
                  const isOutbound = threadMessage.direction === "outbound";
                  return (
                    <div
                      key={threadMessage.id}
                      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] border rounded-[22px] px-4 py-3 ${
                          isOutbound
                            ? "bg-[rgba(110,106,232,0.08)] border-[rgba(110,106,232,0.14)] rounded-tr-[6px]"
                            : "bg-[#FFFCF9] border-[rgba(0,0,0,0.06)] rounded-tl-[6px] shadow-sm"
                        }`}
                      >
                        <p className="text-sm text-[#111111]">
                          {threadMessage.body}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-1">
                          {formatMessageTime(threadMessage.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-[rgba(0,0,0,0.06)]">
                {selectedConv.channel === "whatsapp" && actionableWhatsAppReply && !visibleWhatsAppReply && (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-[18px] border border-[rgba(16,185,129,0.14)] bg-emerald-50 px-4 py-3">
                    <p className="text-sm text-[#374151]">AI WhatsApp draft hidden.</p>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedAiReplyIds((current) => {
                          const next = new Set(current);
                          next.delete(actionableWhatsAppReply.id);
                          return next;
                        })
                      }
                      className="btn-secondary text-xs"
                    >
                      Bring back
                    </button>
                  </div>
                )}
                {selectedConv.channel === "whatsapp" && visibleWhatsAppReply && (
                  <div className="mb-3 rounded-[18px] border border-[rgba(16,185,129,0.18)] bg-emerald-50 px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#111111]">
                            AI WhatsApp draft
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setDismissedAiReplyIds((current) =>
                                new Set(current).add(visibleWhatsAppReply.id),
                              )
                            }
                            aria-label="Hide AI WhatsApp draft"
                            className="rounded-lg p-1 text-[#6B7280] transition-colors hover:bg-white/70 hover:text-[#111111]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-[#374151]">
                          {visibleWhatsAppReply.draftBody || "No draft body available."}
                        </p>
                        <p className="mt-2 text-xs text-[#6B7280]">
                          Status: {visibleWhatsAppReply.status.replace(/_/g, " ")}
                          {" | "}Confidence: {Math.round(visibleWhatsAppReply.confidence * 100)}%
                          {visibleWhatsAppReply.guardrailReason
                            ? ` | Human review: ${visibleWhatsAppReply.guardrailReason.replace(/_/g, " ")}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={handleUseAiDraft}
                          disabled={!visibleWhatsAppReply.draftBody}
                          className="btn-secondary text-xs disabled:opacity-50"
                        >
                          Use Draft
                        </button>
                        {visibleWhatsAppReply.status === "failed" ? (
                          <button
                            onClick={() => void handleRetryAiDraft()}
                            disabled={isAiSending}
                            className="btn-primary text-xs disabled:opacity-50"
                          >
                            {isAiSending
                              ? "Retrying..."
                              : visibleWhatsAppRetryNeedsConfirmation
                                ? "Confirm Not Sent & Retry"
                                : "Retry Send"}
                          </button>
                        ) : (
                          <button
                            onClick={() => void handleApproveAiDraft()}
                            disabled={
                              isAiSending ||
                              ["sent", "auto_sent"].includes(visibleWhatsAppReply.status)
                            }
                            className="btn-primary text-xs disabled:opacity-50"
                          >
                            {isAiSending ? "Sending..." : "Approve & Send"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1 bg-[#FAF8F5] border border-[rgba(0,0,0,0.08)] rounded-[18px] p-3">
                    <textarea
                      ref={replyTextareaRef}
                      id="inbox-reply-message"
                      name="inbox-reply-message"
                      aria-label="Reply message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message..."
                      rows={2}
                      className="block w-full min-h-[52px] resize-none appearance-none border-none bg-transparent px-2 py-1.5 text-sm leading-6 text-[#111111] shadow-none outline-none ring-0 placeholder:text-[#6B7280] [box-shadow:none!important] [caret-color:#111111] focus:border-none focus:outline-none focus:ring-0 focus:[box-shadow:none!important] focus-visible:outline-none focus-visible:[box-shadow:none!important] active:[box-shadow:none!important]"
                      style={{ boxShadow: "none" }}
                    />
                    <div className="flex items-center justify-between mt-2 text-[#6B7280]">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleInsertEmoji}
                          aria-label="Insert emoji"
                          className="p-1.5 rounded-[10px] hover:bg-[rgba(110,106,232,0.06)] transition-colors"
                        >
                          <Smile className="w-4 h-4 text-[#6B7280]" />
                        </button>
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!message.trim() || isSending}
                        className="px-4 py-1.5 bg-[#6E6AE8] text-white rounded-[14px] text-sm font-medium hover:bg-[#5A56D4] flex items-center gap-1 transition-colors disabled:opacity-40 shadow-sm"
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
          )}
        </Card>
      </div>
    </div>
  );
}
