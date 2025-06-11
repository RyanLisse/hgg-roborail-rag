import { registerOTel } from '@vercel/otel';
import { AISDKExporter } from 'langsmith/vercel';

export function register() {
  // Enable LangSmith tracing if configured
  if (process.env.LANGSMITH_TRACING === 'true' && process.env.LANGSMITH_API_KEY) {
    registerOTel({
      serviceName: 'rra-rag-chatbot',
      traceExporter: new AISDKExporter({
        projectName: process.env.LANGSMITH_PROJECT || 'rra',
      }),
    });
  } else {
    registerOTel({ serviceName: 'rra-rag-chatbot' });
  }
}
