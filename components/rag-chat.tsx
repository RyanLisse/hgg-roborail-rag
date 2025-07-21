"use client";

import { AlertCircle, FileText, Send, Settings, Upload, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  DatabaseSelector,
  useDatabaseSelection,
} from "@/components/database-selector";
import { MessageFeedback } from "@/components/feedback-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useModelSelection } from "@/hooks/use-model-selection";
import { useRAG } from "@/hooks/use-rag";
import { cn } from "@/lib/utils";

export function RAGChat() {
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<
    Array<{
      role: "user" | "assistant";
      content: string;
      messageId?: string;
      runId?: string;
    }>
  >([]);

  const { data: session } = useSession();
  const { selectedModel } = useModelSelection();
  const {
    selectedSources,
    setSelectedSources,
    availableSources,
    sourceStats,
    isLoading: isLoadingSources,
    refreshStats,
  } = useDatabaseSelection();
  const {
    query,
    isLoading,
    response,
    error,
    documents,
    addDocument,
    removeDocument,
  } = useRAG();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(question.trim() && selectedModel)) return;

    const userMessage = { role: "user" as const, content: question };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);

    try {
      const result = await query({
        question,
        chatHistory: newHistory,
        modelId: selectedModel.id,
        options: {
          vectorStoreSources: selectedSources,
          useFileSearch: selectedSources.includes("openai"),
          useWebSearch: false, // Can be made configurable
        },
      });

      if (result) {
        // Generate unique messageId for this response
        const messageId = crypto.randomUUID();

        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.answer,
            messageId,
            runId: result.runId, // From RAG service LangSmith tracking
          },
        ]);
      }
    } catch (err) {
      console.error("Query failed:", err);
    }

    setQuestion("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      await addDocument({
        file,
        metadata: {
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date(),
        },
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Document Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={20} />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Vector Store Selector */}
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Settings size={16} />
                Data Sources
              </h4>
              <DatabaseSelector
                availableSources={availableSources}
                disabled={isLoadingSources}
                onSourcesChange={setSelectedSources}
                selectedSources={selectedSources}
                sourceStats={sourceStats}
              />
            </div>

            {/* File Upload */}
            <div className="rounded-lg border-2 border-muted-foreground/25 border-dashed p-6 text-center">
              <Upload className="mx-auto mb-4 size-12 text-muted-foreground/50" />
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Upload Documents</h3>
                <p className="text-muted-foreground text-xs">
                  Support for PDF, TXT, MD, and DOCX files
                </p>
                <Button asChild size="sm" variant="outline">
                  <label className="cursor-pointer" htmlFor="file-upload">
                    Browse Files
                    <input
                      accept=".pdf,.txt,.md,.docx"
                      aria-label="Upload documents"
                      className="sr-only"
                      id="file-upload"
                      multiple
                      onChange={handleFileUpload}
                      type="file"
                    />
                  </label>
                </Button>
              </div>
            </div>
          </div>

          {/* Documents List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Uploaded Documents</h4>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    className="flex items-center justify-between rounded-lg border p-3"
                    key={doc.id}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="text-muted-foreground" size={16} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {doc.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatFileSize(doc.size)} •{" "}
                          {doc.uploadedAt.toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        className="text-xs"
                        variant={
                          doc.status === "processed" ? "default" : "secondary"
                        }
                      >
                        {doc.status}
                      </Badge>
                    </div>
                    <Button
                      aria-label="Remove document"
                      onClick={() => removeDocument(doc.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Section */}
      <Card>
        <CardHeader>
          <CardTitle>RAG Chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div className="max-h-96 space-y-4 overflow-y-auto">
              {chatHistory.map((message, index) => (
                <div
                  className={cn(
                    "rounded-lg p-3",
                    message.role === "user"
                      ? "ml-8 bg-primary/10"
                      : "mr-8 bg-muted",
                  )}
                  key={`message-${index}-${message.content.slice(0, 10)}`}
                >
                  <div className="mb-1 font-medium text-xs capitalize">
                    {message.role}
                  </div>
                  <div className="text-sm">{message.content}</div>

                  {/* Add feedback component for assistant messages */}
                  {message.role === "assistant" &&
                    message.messageId &&
                    message.runId &&
                    session?.user?.id && (
                      <div className="mt-3 border-border/50 border-t pt-2">
                        <MessageFeedback
                          messageId={message.messageId}
                          runId={message.runId}
                          userId={session.user.id}
                        />
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}

          {/* Current Response */}
          {isLoading && (
            <div className="mr-8 rounded-lg bg-muted p-3">
              <div className="mb-2 font-medium text-xs">Assistant</div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <p className="text-muted-foreground text-xs">
                  Generating response...
                </p>
              </div>
            </div>
          )}

          {response && !isLoading && (
            <div className="space-y-4">
              <div className="mr-8 rounded-lg bg-muted p-3">
                <div className="mb-2 font-medium text-xs">Assistant</div>
                <div className="whitespace-pre-wrap text-sm">
                  {response.answer}
                </div>

                {/* Add feedback for current response if user is logged in */}
                {response.runId && session?.user?.id && (
                  <div className="mt-3 border-border/50 border-t pt-2">
                    <MessageFeedback
                      messageId={crypto.randomUUID()} // Temporary ID for current response
                      runId={response.runId}
                      userId={session.user.id}
                    />
                  </div>
                )}
              </div>

              {/* Sources */}
              {response.sources.length > 0 && (
                <div className="space-y-2">
                  <Separator />
                  <div className="font-medium text-muted-foreground text-xs">
                    Sources
                  </div>
                  <div className="grid gap-2">
                    {response.sources.map((source, index) => (
                      <div
                        className="rounded border p-2 text-xs"
                        key={`source-${source.documentId}-${index}`}
                      >
                        <div className="mb-1 font-medium">
                          {source.metadata?.title || source.documentId}
                          <Badge className="ml-2 text-xs" variant="outline">
                            {Math.round(source.score * 100)}% match
                          </Badge>
                        </div>
                        <div className="line-clamp-2 text-muted-foreground">
                          {source.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle size={16} />
                <span className="font-medium text-sm">Error</span>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                {error.message ||
                  "An error occurred while processing your request."}
              </p>
            </div>
          )}

          {/* Question Input */}
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <Textarea
              className="min-h-[60px] resize-none"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask a question about RoboRail documentation..."
              value={question}
            />
            <Button
              aria-label="Send"
              className="self-end"
              disabled={!question.trim() || isLoading || !selectedModel}
              type="submit"
            >
              <Send size={16} />
            </Button>
          </form>

          {!selectedModel && (
            <p className="text-center text-muted-foreground text-xs">
              Please select a model to start chatting
            </p>
          )}

          {/* Vector Store Info */}
          {selectedSources.includes("openai") && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2 font-medium text-green-800 text-sm">
                <div className="size-2 rounded-full bg-green-600" />
                Connected to RoboRail Documentation
              </div>
              <div className="mt-1 text-green-700 text-xs">
                Using OpenAI vector store vs_6849955367a88191bf89d7660230325f
                with RoboRail technical documentation
              </div>
            </div>
          )}

          {/* RoboRail Example Questions */}
          {chatHistory.length === 0 && selectedModel && (
            <div className="space-y-3">
              <div className="font-medium text-muted-foreground text-sm">
                Try asking about RoboRail:
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  "How do I calibrate the RoboRail system?",
                  "What are the safety procedures for RoboRail?",
                  "What is the measurement accuracy of RoboRail?",
                  "How do I troubleshoot RoboRail issues?",
                  "What are the operating procedures for RoboRail?",
                  "How do I maintain the RoboRail system?",
                ].map((exampleQuestion) => (
                  <Button
                    className="h-auto justify-start px-3 py-2 text-left text-xs"
                    disabled={isLoading}
                    key={exampleQuestion}
                    onClick={() => setQuestion(exampleQuestion)}
                    size="sm"
                    variant="outline"
                  >
                    {exampleQuestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
