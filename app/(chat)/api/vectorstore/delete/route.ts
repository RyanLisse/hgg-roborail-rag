import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getUnifiedVectorStoreService } from "@/lib/vectorstore/unified";

const DeleteRequest = z.object({
  documentId: z.string(),
  source: z.enum(["openai", "neon", "memory"]),
});

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, source } = DeleteRequest.parse(body);

    const vectorStoreService = await getUnifiedVectorStoreService();

    const success = await vectorStoreService.deleteDocument(documentId, source);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
