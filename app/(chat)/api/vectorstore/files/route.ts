import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getUnifiedVectorStoreService } from "@/lib/vectorstore/unified";

const ListFilesRequest = z.object({
  source: z.enum(["openai", "neon", "memory"]).optional(),
  vectorStoreId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") as
      | "openai"
      | "neon"
      | "memory"
      | null;
    const vectorStoreId = searchParams.get("vectorStoreId");

    const vectorStoreService = await getUnifiedVectorStoreService();

    // If a specific source is requested, get files from that source
    if (source === "openai") {
      const files = await vectorStoreService.openaiService.listFiles(
        vectorStoreId || undefined,
      );
      return NextResponse.json({
        files: files.map((file: any) => ({
          id: file.id,
          name: `file-${file.id}`, // OpenAI doesn't store original filename in vector store
          status: file.status,
          createdAt: new Date(file.created_at * 1000),
          source: "openai",
          vectorStoreId: file.vector_store_id,
        })),
      });
    }

    if (source === "neon") {
      // Note: Neon service would need a listDocuments method
      // For now, return empty array
      return NextResponse.json({ files: [] });
    }

    if (source === "memory") {
      // Memory documents are handled by localStorage in the client
      return NextResponse.json({ files: [] });
    }

    // If no source specified, get available sources and their stats
    const [availableSources, sourceStats] = await Promise.all([
      vectorStoreService.getAvailableSources(),
      vectorStoreService.getSourceStats(),
    ]);

    const allFiles = [];

    // Get files from OpenAI if available
    if (availableSources.includes("openai")) {
      try {
        const openaiFiles = await vectorStoreService.openaiService.listFiles();
        allFiles.push(
          ...openaiFiles.map((file: any) => ({
            id: file.id,
            name: `file-${file.id}`,
            status: file.status,
            createdAt: new Date(file.created_at * 1000),
            source: "openai" as const,
            vectorStoreId: file.vector_store_id,
          })),
        );
      } catch (error) {
        console.warn("Failed to list OpenAI files:", error);
      }
    }

    return NextResponse.json({
      files: allFiles,
      availableSources,
      sourceStats,
    });
  } catch (error) {
    console.error("Failed to list files:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 },
    );
  }
}
