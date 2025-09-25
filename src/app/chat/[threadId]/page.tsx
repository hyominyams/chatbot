import ChatView from "@/components/ChatView";

export default function ThreadPage({ params }: { params: { threadId: string } }) {
  return <ChatView threadId={params.threadId} />;
}
