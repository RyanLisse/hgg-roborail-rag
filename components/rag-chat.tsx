'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useRAG } from '@/hooks/use-rag';
import { useModelSelection } from '@/hooks/use-model-selection';
import { MessageFeedback } from '@/components/feedback-system';
import { DatabaseSelector, useDatabaseSelection } from '@/components/database-selector';
import { Upload, Send, X, FileText, AlertCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';

export function RAGChat() {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ 
    role: 'user' | 'assistant'; 
    content: string; 
    messageId?: string;
    runId?: string;
  }>>([]);
  
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
    if (!question.trim() || !selectedModel) return;

    const userMessage = { role: 'user' as const, content: question };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);

    try {
      const result = await query({
        question,
        chatHistory: newHistory,
        modelId: selectedModel.id,
        options: {
          vectorStoreSources: selectedSources,
          useFileSearch: selectedSources.includes('openai'),
          useWebSearch: false, // Can be made configurable
        },
      });

      if (result) {
        // Generate unique messageId for this response
        const messageId = crypto.randomUUID();
        
        setChatHistory(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: result.answer,
            messageId,
            runId: result.runId // From RAG service LangSmith tracking
          }
        ]);
      }
    } catch (err) {
      console.error('Query failed:', err);
    }

    setQuestion('');
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
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Settings size={16} />
                Data Sources
              </h4>
              <DatabaseSelector
                selectedSources={selectedSources}
                onSourcesChange={setSelectedSources}
                availableSources={availableSources}
                sourceStats={sourceStats}
                disabled={isLoadingSources}
              />
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="mx-auto size-12 text-muted-foreground/50 mb-4" />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Upload Documents</h3>
                <p className="text-xs text-muted-foreground">
                  Support for PDF, TXT, MD, and DOCX files
                </p>
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Browse Files
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md,.docx"
                      onChange={handleFileUpload}
                      className="sr-only"
                      aria-label="Upload documents"
                    />
                  </label>
                </Button>
              </div>
            </div>
          </div>

          {/* Documents List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Uploaded Documents</h4>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.size)} • {doc.uploadedAt.toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant={doc.status === 'processed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {doc.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(doc.id)}
                      aria-label="Remove document"
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
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {chatHistory.map((message, index) => (
                <div key={`message-${index}-${message.content.slice(0,10)}`} className={cn(
                  'p-3 rounded-lg',
                  message.role === 'user' 
                    ? 'bg-primary/10 ml-8' 
                    : 'bg-muted mr-8'
                )}>
                  <div className="text-xs font-medium mb-1 capitalize">
                    {message.role}
                  </div>
                  <div className="text-sm">{message.content}</div>
                  
                  {/* Add feedback component for assistant messages */}
                  {message.role === 'assistant' && message.messageId && message.runId && session?.user?.id && (
                    <div className="mt-3 pt-2 border-t border-border/50">
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
            <div className="p-3 bg-muted rounded-lg mr-8">
              <div className="text-xs font-medium mb-2">Assistant</div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <p className="text-xs text-muted-foreground">Generating response...</p>
              </div>
            </div>
          )}

          {response && !isLoading && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg mr-8">
                <div className="text-xs font-medium mb-2">Assistant</div>
                <div className="text-sm whitespace-pre-wrap">{response.answer}</div>
                
                {/* Add feedback for current response if user is logged in */}
                {response.runId && session?.user?.id && (
                  <div className="mt-3 pt-2 border-t border-border/50">
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
                  <div className="text-xs font-medium text-muted-foreground">Sources</div>
                  <div className="grid gap-2">
                    {response.sources.map((source, index) => (
                      <div key={`source-${source.documentId}-${index}`} className="p-2 border rounded text-xs">
                        <div className="font-medium mb-1">
                          {source.metadata?.title || source.documentId}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {Math.round(source.score * 100)}% match
                          </Badge>
                        </div>
                        <div className="text-muted-foreground line-clamp-2">
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
            <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Error</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {error.message || 'An error occurred while processing your request.'}
              </p>
            </div>
          )}

          {/* Question Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about RoboRail documentation..."
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button 
              type="submit" 
              disabled={!question.trim() || isLoading || !selectedModel}
              className="self-end"
              aria-label="Send"
            >
              <Send size={16} />
            </Button>
          </form>

          {!selectedModel && (
            <p className="text-xs text-muted-foreground text-center">
              Please select a model to start chatting
            </p>
          )}

          {/* Vector Store Info */}
          {selectedSources.includes('openai') && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                <div className="size-2 bg-green-600 rounded-full" />
                Connected to RoboRail Documentation
              </div>
              <div className="text-xs text-green-700 mt-1">
                Using OpenAI vector store vs_6849955367a88191bf89d7660230325f with RoboRail technical documentation
              </div>
            </div>
          )}

          {/* RoboRail Example Questions */}
          {chatHistory.length === 0 && selectedModel && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Try asking about RoboRail:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  "How do I calibrate the RoboRail system?",
                  "What are the safety procedures for RoboRail?",
                  "What is the measurement accuracy of RoboRail?",
                  "How do I troubleshoot RoboRail issues?",
                  "What are the operating procedures for RoboRail?",
                  "How do I maintain the RoboRail system?"
                ].map((exampleQuestion) => (
                  <Button
                    key={exampleQuestion}
                    variant="outline"
                    size="sm"
                    className="text-left text-xs h-auto py-2 px-3 justify-start"
                    onClick={() => setQuestion(exampleQuestion)}
                    disabled={isLoading}
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