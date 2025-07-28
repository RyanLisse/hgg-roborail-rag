import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { supabaseRAG } from "@/lib/rag/supabase-rag";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, limit = 5, threshold = 0.7 } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Search for similar content
    const results = await supabaseRAG.searchSimilar(query, limit, threshold);

    return NextResponse.json({
      results,
      query,
      totalResults: results.length,
    });
  } catch (error) {
    console.error("Supabase search error:", error);
    return NextResponse.json(
      { error: "Failed to search vector store" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "5");
    const threshold = parseFloat(searchParams.get("threshold") || "0.7");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 },
      );
    }

    // Search for similar content
    const results = await supabaseRAG.searchSimilar(query, limit, threshold);

    return NextResponse.json({
      results,
      query,
      totalResults: results.length,
    });
  } catch (error) {
    console.error("Supabase search error:", error);
    return NextResponse.json(
      { error: "Failed to search vector store" },
      { status: 500 },
    );
  }
}
