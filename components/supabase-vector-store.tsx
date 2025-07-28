"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, Search, Database, FileText } from "lucide-react";
import { fetcher } from "@/lib/utils";

interface VectorStoreStats {
  totalDocuments: number;
  totalEmbeddings: number;
}

interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
  documentId: string;
}

const EMBEDDING_MODELS = [
  {
    id: "embed-v4.0",
    name: "Cohere Embed v4.0",
    provider: "Cohere",
    dimensions: 1024,
  },
  {
    id: "text-embedding-ada-002",
    name: "OpenAI Ada v2",
    provider: "OpenAI",
    dimensions: 1536,
  },
  {
    id: "text-embedding-3-small",
    name: "OpenAI Embedding v3 Small",
    provider: "OpenAI",
    dimensions: 1536,
  },
];

export function SupabaseVectorStore() {
  const [selectedModel, setSelectedModel] = useState("embed-v4.0");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadContent, setUploadContent] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Get vector store stats
  const { data: stats, mutate: mutateStats } = useSWR<{
    stats: VectorStoreStats;
    message: string;
  }>("/api/vectorstore/supabase-upload", fetcher);

  const handleFileUpload = async () => {
    if (!uploadFile && !uploadContent) {
      alert("Please provide either a file or content to upload");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();

      if (uploadFile) {
        formData.append("file", uploadFile);
      }

      if (uploadContent) {
        formData.append("content", uploadContent);
      }

      if (uploadTitle) {
        formData.append("title", uploadTitle);
      }

      formData.append(
        "metadata",
        JSON.stringify({
          embeddingModel: selectedModel,
          uploadedAt: new Date().toISOString(),
        }),
      );

      const response = await fetch("/api/vectorstore/supabase-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      alert(`Document uploaded successfully: ${result.title}`);

      // Reset form
      setUploadFile(null);
      setUploadContent("");
      setUploadTitle("");

      // Refresh stats
      mutateStats();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert("Please enter a search query");
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("/api/vectorstore/supabase-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
          threshold: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const result = await response.json();
      setSearchResults(result.results);
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectedModelInfo = EMBEDDING_MODELS.find(
    (m) => m.id === selectedModel,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Supabase Vector Store
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {stats?.stats.totalDocuments || 0}
              </div>
              <div className="text-sm text-muted-foreground">Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {stats?.stats.totalEmbeddings || 0}
              </div>
              <div className="text-sm text-muted-foreground">Embeddings</div>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="text-sm">
                {selectedModelInfo?.name}
              </Badge>
              <div className="text-sm text-muted-foreground mt-1">
                Current Model
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Embedding Model Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-select">Choose Embedding Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select embedding model" />
                </SelectTrigger>
                <SelectContent>
                  {EMBEDDING_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.provider} • {model.dimensions}D
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedModelInfo && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                <strong>{selectedModelInfo.name}</strong> by{" "}
                {selectedModelInfo.provider}
                <br />
                Vector dimensions: {selectedModelInfo.dimensions}
                <br />
                {selectedModelInfo.id === "embed-v4.0" && (
                  <span className="text-green-600">
                    ✓ Recommended for Supabase pgvector
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-title">Document Title (Optional)</Label>
              <Input
                id="upload-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Enter document title..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-file">Upload File</Label>
              <Input
                id="upload-file"
                type="file"
                accept=".txt,.md,text/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="text-center text-muted-foreground">OR</div>

            <div className="space-y-2">
              <Label htmlFor="upload-content">Paste Content</Label>
              <Textarea
                id="upload-content"
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                placeholder="Paste your document content here..."
                rows={6}
              />
            </div>

            <Button
              onClick={handleFileUpload}
              disabled={isUploading || (!uploadFile && !uploadContent)}
              className="w-full"
            >
              {isUploading ? "Uploading..." : "Upload & Generate Embeddings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Vector Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter your search query..."
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <h4 className="font-medium">
                  Search Results ({searchResults.length})
                </h4>
                {searchResults.map((result, index) => (
                  <Card key={result.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary">
                          Similarity: {(result.similarity * 100).toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Doc: {result.documentId.slice(0, 8)}...
                        </span>
                      </div>
                      <p className="text-sm">{result.content}</p>
                      {result.metadata.title && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <FileText className="h-3 w-3 inline mr-1" />
                          {result.metadata.title}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
